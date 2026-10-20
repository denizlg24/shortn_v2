import type { Db, ObjectId } from "mongodb";
import { z } from "zod";
import { fail, ok } from "../result";
import { deliveries, endpoints } from "../webhooks/service";
import { withMutation } from "../webhooks/events";

const disableInput = z
  .object({ by: z.string().min(1), reason: z.string().min(1).max(1000) })
  .strict();

/** Staff disable (23 §3.9): the endpoint stops, queued deliveries are
 * cancelled, and the owner can't re-enable it until staff lift the flag.
 * Mutation only; permission and audit belong to the admin action. */
export async function adminDisableWebhook(
  deps: { db: Db; now?: () => Date },
  webhookId: ObjectId,
  input: z.input<typeof disableInput>,
) {
  const parsed = disableInput.safeParse(input);
  if (!parsed.success) return fail("invalid_input" as const);
  const now = deps.now?.() ?? new Date();
  return withMutation(deps.db, async (session) => {
    const endpoint = await endpoints(deps.db).findOneAndUpdate(
      { _id: webhookId },
      {
        $set: {
          enabled: false,
          adminDisabled: { at: now, ...parsed.data },
          updatedAt: now,
        },
      },
      { session, returnDocument: "after" },
    );
    if (!endpoint) return fail("not_found" as const);
    const cancelled = await deliveries(deps.db).updateMany(
      { webhookId, status: { $in: ["pending", "sending"] } },
      {
        $set: { status: "cancelled", lastError: "admin_disabled" },
        $unset: { leaseToken: "", leaseUntil: "" },
      },
      { session },
    );
    return ok({ cancelledDeliveries: cancelled.modifiedCount });
  });
}

/** Lifts the staff flag only; re-enabling stays the owner's decision. */
export async function adminEnableWebhook(
  deps: { db: Db; now?: () => Date },
  webhookId: ObjectId,
) {
  const result = await endpoints(deps.db).updateOne(
    { _id: webhookId, adminDisabled: { $exists: true } },
    {
      $unset: { adminDisabled: "" },
      $set: { updatedAt: deps.now?.() ?? new Date() },
    },
  );
  return result.modifiedCount ? ok(null) : fail("not_admin_disabled" as const);
}

/** Cancels an endpoint's queued deliveries without disabling it. */
export async function cancelWebhookDeliveries(
  deps: { db: Db },
  webhookId: ObjectId,
) {
  const cancelled = await deliveries(deps.db).updateMany(
    { webhookId, status: { $in: ["pending", "sending"] } },
    {
      $set: { status: "cancelled", lastError: "cancelled_by_staff" },
      $unset: { leaseToken: "", leaseUntil: "" },
    },
  );
  return ok({ cancelledDeliveries: cancelled.modifiedCount });
}
