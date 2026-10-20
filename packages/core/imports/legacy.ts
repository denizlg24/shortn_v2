import { collection } from "@shortn/db";
import type { Db, ClientSession } from "mongodb";
import { loadEntitlements } from "@shortn/billing";
import { countUsage } from "../usage/service";
import { ensureLegacyQuotaLock, lockLegacyQuota } from "../usage/quota-lock";
import { withMutation } from "../webhooks/events";
import { importReservations, reservedImportUsage } from "./quota";
import { fail, ok } from "../result";

/** Use shared quota after a workspace accepts an import; preserve earlier legacy behavior. */
export async function coordinateLegacyCreation<T>(
  db: Db,
  sub: string,
  metric: "links" | "qrCodes",
  write: (session: ClientSession) => Promise<T>,
) {
  if (!sub || !["links", "qrCodes"].includes(metric))
    throw new Error("Invalid legacy creation identity");
  await ensureLegacyQuotaLock(db, sub);
  return withMutation(db, async (session) => {
    await lockLegacyQuota(db, sub, session);
    const workspace = await collection(db, "workspaces").findOne(
      { personal: true, legacySub: sub },
      { session },
    );
    if (workspace) {
      await collection(db, "workspaces").updateOne(
        { _id: workspace._id },
        { $inc: { linkMutationRevision: 1 } },
        { session },
      );
      const now = new Date();
      const active = await importReservations(db).findOne(
        {
          workspaceId: workspace._id,
          metric,
          state: "active",
          remaining: { $gt: 0 },
          expiresAt: { $gt: now },
        },
        { session, projection: { _id: 1 } },
      );
      if (active || workspace.importQuotaCoordinated === true) {
        const entitlements = await loadEntitlements(db, workspace),
          limit = entitlements.limits[metric];
        if (limit !== null) {
          const used = await countUsage(
            db,
            workspace,
            entitlements.period,
            session,
          );
          const held = await reservedImportUsage(
            db,
            workspace._id,
            entitlements.period,
            now,
            session,
          );
          if (used[metric] + held[metric] + 1 > limit)
            return fail("limit_reached" as const, {
              limit,
              used: used[metric],
              reserved: held[metric],
              requested: 1,
              available: Math.max(0, limit - used[metric] - held[metric]),
            });
        }
      }
    }
    return ok(await write(session));
  });
}
