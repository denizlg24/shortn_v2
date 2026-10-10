import { can } from "@shortn/core";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  CampaignsGate,
  CampaignsList,
} from "@/components/campaigns/campaigns-list";
import { listCampaignsAction } from "@/server/actions/campaigns";
import { featureAccess } from "@/server/plan";
import { requireWorkspace } from "@/server/workspace";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("campaigns") };
}

export default async function CampaignsPage({
  params,
}: PageProps<"/[workspace]/campaigns">) {
  const { workspace: slug } = await params;
  const [{ actor }, access] = await Promise.all([
    requireWorkspace(slug),
    featureAccess(slug, "campaigns"),
  ]);
  if (!access.allowed) return <CampaignsGate plan={access.plan} />;
  const campaigns = await listCampaignsAction(slug);
  return (
    <CampaignsList
      workspace={slug}
      canEdit={can(actor, "resource.update")}
      campaigns={campaigns}
    />
  );
}
