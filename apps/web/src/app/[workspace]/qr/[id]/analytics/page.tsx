import { can } from "@shortn/core/authz";
import { getTranslations } from "next-intl/server";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { Page } from "@/components/page/page";
import { gateOf } from "@/lib/plan-features";
import { planFeatures } from "@/server/plan";
import { loadQr, qrName, qrTabs } from "@/server/qr-page";

export async function generateMetadata() {
  const t = await getTranslations("qr.tabs");
  return { title: t("analytics") };
}

export default async function QrAnalyticsPage({
  params,
}: PageProps<"/[workspace]/qr/[id]/analytics">) {
  const { workspace, id } = await params;
  const t = await getTranslations("qr");
  const [{ ctx, qr }, features] = await Promise.all([
    loadQr(workspace, id),
    planFeatures(workspace),
  ]);
  return (
    <Page
      crumbs={[
        { label: t("list.title"), href: `/${workspace}/qr` },
        { label: qrName(qr), href: `/${workspace}/qr/${id}` },
        { label: t("tabs.analytics") },
      ]}
      title={qrName(qr)}
      tabs={qrTabs(workspace, id, can(ctx.actor, "resource.update"), (key) =>
        t(`tabs.${key}`),
      )}
      tabsLabel={t("tabs.label")}
    >
      <AnalyticsView
        workspace={workspace}
        scope={{ type: "qr", id }}
        title={t("tabs.analytics")}
        breakdownGate={gateOf(features.analyticsBreakdowns)}
        embedded
      />
    </Page>
  );
}
