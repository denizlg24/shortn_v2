import { collection } from "@shortn/db";
import type { Db, ObjectId } from "mongodb";
import { z } from "zod";
import { fail, ok } from "../result";

type Deps = { db: Db; now?: () => Date };

/** Poll now instead of waiting for the backoff (23 §3.8). */
export async function reverifyDomain(deps: Deps, domainId: ObjectId) {
  const result = await collection(deps.db, "domains").updateOne(
    {
      _id: domainId,
      status: { $nin: ["disabled", "suspended"] },
      removing: { $ne: true },
    },
    {
      $set: { nextAttemptAt: deps.now?.() ?? new Date() },
      $unset: { leaseUntil: "", lease: "" },
    },
  );
  return result.matchedCount ? ok(null) : fail("not_found" as const);
}

const suspendInput = z
  .object({ by: z.string().min(1), reason: z.string().min(1).max(1000) })
  .strict();

/** Stops serving at once: activeDomain requires `active`. The hostname stays
 * taken, polls can't flip it back, and the owner can't remove it to free the
 * hostname. Mutation only; permission and audit belong to the admin action. */
export async function suspendDomain(
  deps: Deps,
  domainId: ObjectId,
  input: z.input<typeof suspendInput>,
) {
  const parsed = suspendInput.safeParse(input);
  if (!parsed.success) return fail("invalid_input" as const);
  const domains = collection(deps.db, "domains");
  const domain = await domains.findOne(
    { _id: domainId, status: { $nin: ["disabled", "suspended"] } },
    { projection: { status: 1 } },
  );
  if (!domain) return fail("not_found" as const);
  const result = await domains.updateOne(
    { _id: domainId, status: domain.status },
    {
      $set: {
        status: "suspended",
        suspension: {
          at: deps.now?.() ?? new Date(),
          ...parsed.data,
          previousStatus: domain.status,
        },
      },
      $unset: { nextAttemptAt: "", leaseUntil: "", lease: "" },
    },
  );
  return result.modifiedCount
    ? ok({ previousStatus: domain.status })
    : fail("conflict" as const);
}

/** Re-verifies from pending rather than trusting the pre-suspension state. */
export async function unsuspendDomain(deps: Deps, domainId: ObjectId) {
  const result = await collection(deps.db, "domains").updateOne(
    { _id: domainId, status: "suspended" },
    {
      $set: {
        status: "pending",
        attempts: 0,
        nextAttemptAt: deps.now?.() ?? new Date(),
      },
      $unset: { suspension: "" },
    },
  );
  return result.modifiedCount ? ok(null) : fail("not_suspended" as const);
}
