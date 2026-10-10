import { can } from "@shortn/core";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { QrSummary } from "@/components/qr/qr-summary";
import { BreadcrumbTitle } from "@/components/shell/breadcrumb-title";
import { gateOf } from "@/lib/plan-features";
import { planFeatures } from "@/server/plan";
import { requireWorkspace } from "@/server/workspace";
import { loadQr } from "./load";

export async function generateMetadata({
  params,
}: PageProps<"/[workspace]/qr/[id]">): Promise<Metadata> {
  const { workspace, id } = await params;
  const result = await loadQr(workspace, id);
  if (result.ok) return { title: result.data.title || result.data.key };
  const t = await getTranslations("nav");
  return { title: t("qr") };
}

export default async function QrDetailPage({
  params,
}: PageProps<"/[workspace]/qr/[id]">) {
  const { workspace: slug, id } = await params;
  const { actor } = await requireWorkspace(slug);
  const [result, features, t] = await Promise.all([
    loadQr(slug, id),
    planFeatures(slug),
    getTranslations("qr"),
  ]);
  if (!result.ok) notFound();
  const qr = result.data;
  return (
    <AnalyticsView
      workspace={slug}
      scope={{ type: "qr", id: qr.id }}
      title={
        <BreadcrumbTitle trail={[{ href: `/${slug}/qr`, label: t("title") }]}>
          {qr.title || qr.key}
        </BreadcrumbTitle>
      }
      summary={
        <QrSummary
          workspace={slug}
          qr={qr}
          canEdit={can(actor, "resource.update")}
        />
      }
      breakdownGate={gateOf(features.analyticsBreakdowns)}
    />
  );
}
