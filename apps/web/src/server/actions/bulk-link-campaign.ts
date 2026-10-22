"use server";
import { hasFeature, loadEntitlements } from "@shortn/billing";
import { can, moveLinksToCampaign, pageCampaigns } from "@shortn/core";
import { revalidatePath } from "next/cache";
import { serviceContext } from "../context";
import { readCampaignSelection } from "../bulk-link-campaign";
export async function searchCampaignTargetsAction(
  workspace: string,
  search: string,
  cursor?: string,
) {
  const ctx = await serviceContext(workspace);
  if (!can(ctx.actor, "resource.update"))
    return { error: "forbidden" as const };
  if (!hasFeature(await loadEntitlements(ctx.db, ctx.workspace), "campaigns"))
    return { error: "feature_required" as const };
  if (
    typeof search !== "string" ||
    search.length > 200 ||
    (cursor !== undefined && !/^[a-f\d]{24}$/.test(cursor))
  )
    return { error: "invalid_input" as const };
  const result = await pageCampaigns(ctx, {
    search,
    ...(cursor ? { cursor } : {}),
    limit: 25,
  });
  return {
    value: {
      items: result.items.map((campaign) => ({
        id: campaign.id,
        title: campaign.title,
        linkCount: campaign.linkCount,
      })),
      total: result.total,
      nextCursor: result.nextCursor,
    },
  };
}
export async function moveLinksToCampaignAction(
  workspace: string,
  ref: string,
  campaignId: string,
) {
  const ctx = await serviceContext(workspace);
  if (!can(ctx.actor, "resource.update"))
    return { error: "forbidden" as const };
  const ids = await readCampaignSelection(ctx, ref);
  if (!ids.length) return { error: "not_found" as const };
  const result = await moveLinksToCampaign(ctx, ids, campaignId);
  if (!result.ok) return { error: result.error };
  revalidatePath(`/${workspace}/links`);
  revalidatePath(`/${workspace}/campaigns`);
  return { value: result.value };
}
