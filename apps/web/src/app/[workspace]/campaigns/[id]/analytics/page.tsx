import { can } from "@shortn/core/authz";
import { getTranslations } from "next-intl/server";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { CampaignsGate } from "@/components/campaigns/campaigns-gate";
import { Page } from "@/components/page/page";
import { gateOf } from "@/lib/plan-features";
import {
  campaignsAccess,
  campaignTabs,
  loadCampaign,
} from "@/server/campaign-page";
import { featureAccess, planFeatures } from "@/server/plan";

export async function generateMetadata() {
  const t = await getTranslations("campaigns.tabs");
  return { title: t("analytics") };
}

export default async function CampaignAnalyticsPage({
  params,
}: PageProps<"/[workspace]/campaigns/[id]/analytics">) {
  const { workspace, id } = await params;
  const access = await campaignsAccess(workspace);
  if (!access.allowed) return <CampaignsGate plan={access.plan} />;
  const t = await getTranslations("campaigns");
  const [{ ctx, campaign }, features, csv] = await Promise.all([
    loadCampaign(workspace, id),
    planFeatures(workspace),
    featureAccess(workspace, "campaignExport"),
  ]);
  return (
    <Page
      crumbs={[
        { label: t("list.title"), href: `/${workspace}/campaigns` },
        { label: campaign.title, href: `/${workspace}/campaigns/${id}` },
        { label: t("tabs.analytics") },
      ]}
      title={campaign.title}
      tabs={campaignTabs(
        workspace,
        id,
        can(ctx.actor, "resource.update"),
        (key) => t(`tabs.${key}`),
      )}
      tabsLabel={t("tabs.label")}
    >
      <AnalyticsView
        workspace={workspace}
        scope={{ type: "campaign", id }}
        title={t("tabs.analytics")}
        breakdownGate={gateOf(features.analyticsBreakdowns)}
        embedded
        csvExport={{ params: { campaign: id }, gate: gateOf(csv) }}
      />
    </Page>
  );
}
