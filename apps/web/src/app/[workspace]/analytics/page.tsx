import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { planFeatures } from "@/server/plan";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("analytics") };
}

export default async function AnalyticsPage({
  params,
}: PageProps<"/[workspace]/analytics">) {
  const { workspace: slug } = await params;
  const [features, t] = await Promise.all([
    planFeatures(slug),
    getTranslations("nav"),
  ]);
  return (
    <AnalyticsView
      workspace={slug}
      scope={{ type: "workspace" }}
      title={t("analytics")}
      breakdownGate={
        features.analyticsBreakdowns.allowed
          ? null
          : features.analyticsBreakdowns.plan
      }
    />
  );
}
