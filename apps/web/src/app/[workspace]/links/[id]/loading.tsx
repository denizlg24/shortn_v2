import { getTranslations } from "next-intl/server";
import { AnalyticsSkeleton } from "@/components/analytics/skeleton";

export default async function LinkAnalyticsLoading() {
  const t = await getTranslations("nav");
  return <AnalyticsSkeleton title={t("links")} />;
}
