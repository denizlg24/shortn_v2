import { getTranslations } from "next-intl/server";
import { AnalyticsSkeleton } from "@/components/analytics/skeleton";

export default async function AnalyticsLoading() {
  const t = await getTranslations("nav");
  return <AnalyticsSkeleton title={t("analytics")} />;
}
