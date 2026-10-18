import { getTranslations } from "next-intl/server";
import { AnalyticsPageSkeleton } from "@/components/analytics/skeleton";

export default async function AnalyticsLoading() {
  const t = await getTranslations("nav");
  return <AnalyticsPageSkeleton crumb={t("analytics")} />;
}
