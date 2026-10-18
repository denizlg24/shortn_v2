import "server-only";
import { campaignLinks, getCampaign, toLinkView } from "@shortn/core";
import { notFound } from "next/navigation";
import { cache } from "react";
import { serviceContext } from "./context";
import { featureAccess } from "./plan";

// The whole section is a plan feature: every page checks it first.
export const campaignsAccess = (workspace: string) =>
  featureAccess(workspace, "campaigns");

// One lookup per request for the campaign pages and their metadata.
export const loadCampaign = cache(async (workspace: string, id: string) => {
  const ctx = await serviceContext(workspace);
  const [campaign, members] = await Promise.all([
    getCampaign(ctx, id),
    campaignLinks(ctx, id),
  ]);
  if (!campaign || !members) notFound();
  return {
    ctx,
    campaign,
    links: members.links.map((link) => toLinkView(link, ctx.linkDomain)),
  };
});

export type CampaignTab = "overview" | "analytics" | "builder" | "edit";

export const campaignTabs = (
  workspace: string,
  id: string,
  editable: boolean,
  label: (key: CampaignTab) => string,
) => {
  const base = `/${workspace}/campaigns/${id}`;
  return [
    { label: label("overview"), href: base },
    { label: label("analytics"), href: `${base}/analytics` },
    { label: label("builder"), href: `${base}/builder` },
    ...(editable ? [{ label: label("edit"), href: `${base}/edit` }] : []),
  ];
};
