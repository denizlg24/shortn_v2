import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { Page } from "@/components/page/page";
import { gateOf } from "@/lib/plan-features";
import { linkOptions } from "@/server/analytics-page";
import { featureAccess, planFeatures } from "@/server/plan";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("analytics");
  return { title: t("title") };
}

export default async function AnalyticsPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/analytics">) {
  const { workspace } = await params;
  const { link } = await searchParams;
  const [t, features, csv, links] = await Promise.all([
    getTranslations("analytics"),
    planFeatures(workspace),
    featureAccess(workspace, "csvExport"),
    linkOptions(workspace, typeof link === "string" ? link : undefined),
  ]);
  return (
    <Page
      crumbs={[{ label: t("title") }]}
      title={t("title")}
      description={t("description")}
    >
      <AnalyticsView
        embedded
        workspace={workspace}
        scope={{ type: "workspace" }}
        title={t("title")}
        breakdownGate={gateOf(features.analyticsBreakdowns)}
        csvExport={{ params: {}, gate: gateOf(csv) }}
        links={links}
      />
    </Page>
  );
}
