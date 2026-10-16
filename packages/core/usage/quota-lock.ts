import { collection, physicalNames } from "@shortn/db";
import type { Db, ClientSession } from "mongodb";
import type { Workspace } from "../workspaces/service";
import { withMutation } from "../webhooks/events";

/** A stable legacy identity fence also covers workspace provisioning races. */
export async function ensureLegacyQuotaLock(db: Db, sub: string) {
  await db
    .collection<{ _id: string; revision: number }>(
      physicalNames.legacy_quota_locks,
    )
    .updateOne(
      { _id: sub },
      { $setOnInsert: { revision: 0 } },
      { upsert: true },
    );
}
export async function lockLegacyQuota(
  db: Db,
  sub: string,
  session: ClientSession,
) {
  await db
    .collection<{ _id: string; revision: number }>(
      physicalNames.legacy_quota_locks,
    )
    .updateOne({ _id: sub }, { $inc: { revision: 1 } }, { session });
}
export async function withQuotaMutation<T>(
  ctx: { db: Db; workspace: Workspace },
  action: (session: ClientSession) => Promise<T>,
) {
  const sub = ctx.workspace.personal ? ctx.workspace.legacySub : undefined;
  if (sub) await ensureLegacyQuotaLock(ctx.db, sub);
  return withMutation(ctx.db, async (session) => {
    if (sub) await lockLegacyQuota(ctx.db, sub, session);
    await collection(ctx.db, "workspaces").updateOne(
      { _id: ctx.workspace._id },
      { $inc: { linkMutationRevision: 1 } },
      { session },
    );
    return action(session);
  });
}
