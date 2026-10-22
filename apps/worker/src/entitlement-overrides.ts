import { collection, physicalNames } from "@shortn/db";
import { resolveEntitlements } from "@shortn/billing";
import {
  withAdminAudit,
  enqueuePlatformNotification,
  type AdminContext,
} from "@shortn/core";
import { ObjectId } from "mongodb";
export async function sweepEntitlementOverrides(ctx: AdminContext) {
  const now = ctx.now();
  for await (const workspace of collection(ctx.db, "workspaces")
    .find({ "entitlementOverride.expiresAt": { $lte: now } })
    .limit(100)) {
    const subs = await collection(ctx.db, "subscriptions")
      .find({ workspaceId: workspace._id })
      .toArray();
    const plan = resolveEntitlements(subs, now).plan;
    await withAdminAudit(
      ctx,
      {
        action: "workspace.override.expire",
        targetType: "workspace",
        targetId: String(workspace._id),
        workspaceId: workspace._id,
        metadata: { before: workspace.entitlementOverride },
      },
      async () => {
        const result = await collection(ctx.db, "workspaces").updateOne(
          {
            _id: workspace._id,
            "entitlementOverride.grantedAt":
              workspace.entitlementOverride?.grantedAt,
          },
          {
            $set: { plan },
            $unset: { entitlementOverride: "", compNoticeAt: "" },
          },
        );
        return { ok: true as const, value: { changed: result.modifiedCount } };
      },
    );
  }
  const upcoming = ctx.db
    .collection(physicalNames.workspaces)
    .find({
      "entitlementOverride.plan": { $exists: true },
      "entitlementOverride.expiresAt": {
        $gt: now,
        $lte: new Date(now.getTime() + 7 * 86400000),
      },
      $expr: {
        $ne: [
          { $ifNull: ["$compNoticeAt", null] },
          "$entitlementOverride.expiresAt",
        ],
      },
    })
    .limit(100);
  for await (const workspace of upcoming) {
    if (!ObjectId.isValid(String(workspace.ownerUserId))) continue;
    const owner = await collection(ctx.db, "user").findOne({
      _id: new ObjectId(String(workspace.ownerUserId)),
    });
    if (!owner?.email) continue;
    const expiresAt = workspace.entitlementOverride.expiresAt as Date;
    await enqueuePlatformNotification(ctx.db, {
      key: `comp-expiring:${workspace._id}:${expiresAt.toISOString()}`,
      kind: "compExpiring",
      to: owner.email,
      payload: {
        workspaceName: String(workspace.name),
        plan: String(workspace.entitlementOverride.plan),
        expiresAt: expiresAt.toISOString(),
      },
      now,
    });
    await ctx.db
      .collection(physicalNames.workspaces)
      .updateOne(
        { _id: workspace._id, "entitlementOverride.expiresAt": expiresAt },
        { $set: { compNoticeAt: expiresAt } },
      );
  }
}
