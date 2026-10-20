import {
  collection,
  physicalNames,
  workspaceSuspensionSchema,
  type Documents,
} from "@shortn/db";
import {
  publishWorkspaceSuspension,
  type InvalidationStore,
} from "@shortn/redis";
import type { Db, ObjectId } from "mongodb";
import type { z } from "zod";
import { bioOutboxCollection } from "../bio/publishing";
import { fail, ok } from "../result";
import { ownedBy } from "../workspaces/service";

export type WorkspaceSuspension = z.infer<typeof workspaceSuspensionSchema>;

export interface PlatformDeps {
  db: Db;
  cache: Pick<InvalidationStore, "publish">;
  now?: () => Date;
}

/** Sets or clears a staff lock/suspension (23 §3.2). This is the mutation
 * only: permission checks and the write-ahead audit row belong to the admin
 * action that calls it (§3, B1/D3). Link documents are never touched; the
 * redirect learns through the suspension channel. */
export async function setWorkspaceSuspension(
  deps: PlatformDeps,
  workspaceId: ObjectId,
  input: WorkspaceSuspension | null,
) {
  const parsed = input ? workspaceSuspensionSchema.safeParse(input) : null;
  if (parsed && !parsed.success) return fail("invalid_input" as const);
  const next = parsed?.data;
  const before = await collection(deps.db, "workspaces").findOneAndUpdate(
    { _id: workspaceId },
    next ? { $set: { suspension: next } } : { $unset: { suspension: "" } },
    { returnDocument: "before" },
  );
  if (!before) return fail("not_found" as const);
  const was = before.suspension?.level === "suspended";
  const is = next?.level === "suspended";
  // Both effects are idempotent and run even when the stored level didn't
  // change, so a retry after a failed publish or purge finishes the job.
  await publishWorkspaceSuspension(deps.cache, {
    workspaceId: workspaceId.toHexString(),
    suspended: is,
  });
  if (was || is) await purgeBioPages(deps, before);
  return ok({
    before: before.suspension ?? null,
    after: next ?? null,
  });
}

// Published pages are cached by Next and at the edge; the bio outbox
// revalidates them, so suspension and restore both take effect within its
// next run rather than after the cache TTL.
async function purgeBioPages(
  deps: PlatformDeps,
  workspace: Documents["workspaces"],
) {
  const now = deps.now?.() ?? new Date();
  const pages = await deps.db
    .collection(physicalNames.bio_pages)
    .find(ownedBy(workspace, "userId"), { projection: { _id: 1 } })
    .toArray();
  for (const page of pages)
    await deps.db
      .collection(bioOutboxCollection)
      .updateOne(
        { bioPageId: page._id },
        { $set: { nextAttemptAt: now, attempts: 0, updatedAt: now } },
        { upsert: true },
      );
  return pages.length;
}
