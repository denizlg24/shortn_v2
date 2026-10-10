import { can } from "@shortn/core";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { CampaignCreateForm } from "@/components/campaigns/campaign-create-form";
import { CampaignsGate } from "@/components/campaigns/campaigns-list";
import { featureAccess } from "@/server/plan";
import { requireWorkspace } from "@/server/workspace";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("campaigns.createPage");
  return { title: t("title") };
}

export default async function NewCampaignPage({
  params,
}: PageProps<"/[workspace]/campaigns/new">) {
  const { workspace: slug } = await params;
  const [{ actor }, access] = await Promise.all([
    requireWorkspace(slug),
    featureAccess(slug, "campaigns"),
  ]);
  if (!access.allowed) return <CampaignsGate plan={access.plan} />;
  if (!can(actor, "resource.update")) redirect(`/${slug}/campaigns`);
  return <CampaignCreateForm workspace={slug} />;
}
