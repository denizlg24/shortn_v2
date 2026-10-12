import { physicalNames } from "@shortn/db";
import { loadEntitlements } from "@shortn/billing";
import type { ServiceContext } from "../workspaces/context";
import { ownedBioDocument } from "./publishing";
export async function bioAnalytics(
  ctx: Pick<ServiceContext, "db" | "workspace">,
  id: string,
  days = 30,
) {
  const page = await ownedBioDocument(ctx, id);
  if (!page) return null;
  const entitlements = await loadEntitlements(ctx.db, ctx.workspace._id);
  const from = new Date(
    Date.now() -
      Math.min(days, entitlements.limits.analyticsDays ?? days, 365) * 86400000,
  );
  const match = {
    bioPageId: page._id,
    workspaceId: ctx.workspace._id,
    ts: { $gte: from },
  };
  const [views, clicks, referrers, blocks] = await Promise.all([
    ctx.db.collection(physicalNames.bio_views).countDocuments(match),
    ctx.db
      .collection(physicalNames.click_events)
      .countDocuments({
        "m.bioPageId": page._id,
        "m.workspaceId": ctx.workspace._id,
        ts: { $gte: from },
        bot: false,
      }),
    ctx.db
      .collection(physicalNames.bio_views)
      .aggregate<{ _id: string | null; count: number }>([
        { $match: match },
        { $group: { _id: "$refDomain", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ])
      .toArray(),
    ctx.db
      .collection(physicalNames.click_events)
      .aggregate<{ _id: string; count: number }>([
        {
          $match: {
            "m.bioPageId": page._id,
            "m.workspaceId": ctx.workspace._id,
            ts: { $gte: from },
            bot: false,
          },
        },
        { $group: { _id: "$m.bioBlockId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray(),
  ]);
  return { views, clicks, ctr: views ? clicks / views : 0, referrers, blocks };
}
