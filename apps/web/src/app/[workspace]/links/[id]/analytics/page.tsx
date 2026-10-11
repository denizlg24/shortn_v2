import { getTranslations } from "next-intl/server";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { Page } from "@/components/page/page";
import { gateOf } from "@/lib/plan-features";
import { linkTabs, loadLink } from "@/server/link-page";
import { featureAccess, planFeatures } from "@/server/plan";

export async function generateMetadata() {
  const t = await getTranslations("linkPages.tabs");
  return { title: t("analytics") };
}

export default async function LinkAnalyticsPage({
  params,
}: PageProps<"/[workspace]/links/[id]/analytics">) {
  const { workspace, id } = await params;
  const t = await getTranslations("linkPages");
  const [{ link }, features, csv] = await Promise.all([
    loadLink(workspace, id),
    planFeatures(workspace),
    featureAccess(workspace, "csvExport"),
  ]);
  return (
    <Page
      crumbs={[
        { label: t("crumb"), href: `/${workspace}/links` },
        {
          label: `${link.domain}/${link.key}`,
          href: `/${workspace}/links/${id}`,
        },
        { label: t("tabs.analytics") },
      ]}
      title={`${link.domain}/${link.key}`}
      tabs={linkTabs(workspace, id, (key) => t(`tabs.${key}`))}
      tabsLabel={t("tabs.label")}
    >
      <AnalyticsView
        workspace={workspace}
        scope={{ type: "link", id }}
        title={t("tabs.analytics")}
        breakdownGate={gateOf(features.analyticsBreakdowns)}
        embedded
        csvExport={{ params: { link: id }, gate: gateOf(csv) }}
      />
    </Page>
  );
}
