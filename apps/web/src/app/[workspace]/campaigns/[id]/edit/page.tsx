import { can } from "@shortn/core";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { CampaignEdit } from "@/components/campaigns/campaign-edit";
import { CampaignsGate } from "@/components/campaigns/campaigns-list";
import { featureAccess } from "@/server/plan";
import { requireWorkspace } from "@/server/workspace";
import { loadCampaign } from "../load";

export async function generateMetadata({
  params,
}: PageProps<"/[workspace]/campaigns/[id]/edit">): Promise<Metadata> {
  const { workspace, id } = await params;
  const [result, t] = await Promise.all([
    loadCampaign(workspace, id),
    getTranslations("campaigns.editPage"),
  ]);
  return {
    title: result.ok
      ? `${t("title")} · ${result.data.campaign.title}`
      : t("title"),
  };
}

export default async function EditCampaignPage({
  params,
}: PageProps<"/[workspace]/campaigns/[id]/edit">) {
  const { workspace: slug, id } = await params;
  const [{ actor }, access] = await Promise.all([
    requireWorkspace(slug),
    featureAccess(slug, "campaigns"),
  ]);
  if (!access.allowed) return <CampaignsGate plan={access.plan} />;
  if (!can(actor, "resource.update")) redirect(`/${slug}/campaigns/${id}`);
  const result = await loadCampaign(slug, id);
  if (!result.ok) notFound();
  return (
    <CampaignEdit
      key={result.data.campaign.id}
      workspace={slug}
      campaign={result.data.campaign}
    />
  );
}
