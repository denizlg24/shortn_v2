import { can } from "@shortn/core";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { CampaignPage } from "@/components/campaigns/campaign-page";
import { campaignTabs } from "@/components/campaigns/campaign-tabs";
import { CampaignsGate } from "@/components/campaigns/campaigns-list";
import { gateOf } from "@/lib/plan-features";
import { tabFrom } from "@/lib/tabs";
import { featureAccess, planFeatures } from "@/server/plan";
import { requireWorkspace } from "@/server/workspace";
import { loadCampaign } from "./load";

export async function generateMetadata({
  params,
}: PageProps<"/[workspace]/campaigns/[id]">): Promise<Metadata> {
  const { workspace, id } = await params;
  const result = await loadCampaign(workspace, id);
  if (result.ok) return { title: result.data.campaign.title };
  const t = await getTranslations("nav");
  return { title: t("campaigns") };
}

export default async function CampaignDetailPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/campaigns/[id]">) {
  const { workspace: slug, id } = await params;
  const { tab } = await searchParams;
  const [{ actor }, access] = await Promise.all([
    requireWorkspace(slug),
    featureAccess(slug, "campaigns"),
  ]);
  if (!access.allowed) return <CampaignsGate plan={access.plan} />;
  const [result, exportAccess, features] = await Promise.all([
    loadCampaign(slug, id),
    featureAccess(slug, "campaignExport"),
    planFeatures(slug),
  ]);
  if (!result.ok) notFound();
  return (
    <CampaignPage
      key={result.data.campaign.id}
      workspace={slug}
      campaign={result.data.campaign}
      links={result.data.links}
      canEdit={can(actor, "resource.update")}
      exportGate={gateOf(exportAccess)}
      breakdownGate={gateOf(features.analyticsBreakdowns)}
      initialTab={tabFrom(campaignTabs, tab)}
    />
  );
}
