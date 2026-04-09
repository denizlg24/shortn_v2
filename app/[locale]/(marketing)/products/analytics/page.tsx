import { ProductPage } from "@/components/marketing/product-page";
import { Globe, MousePointer, Smartphone } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("products.analytics");
  const tc = await getTranslations("products.common");

  return (
    <ProductPage
      title={t("hero.title")}
      subtitle={t("hero.subtitle")}
      ctaLabel={tc("get-started")}
      featuresTitle={t("features.title")}
      features={[
        {
          title: t("features.geographic-data.title"),
          description: t("features.geographic-data.description"),
          icon: <Globe className="h-5 w-5" />,
        },
        {
          title: t("features.device-analytics.title"),
          description: t("features.device-analytics.description"),
          icon: <Smartphone className="h-5 w-5" />,
        },
        {
          title: t("features.referrer-tracking.title"),
          description: t("features.referrer-tracking.description"),
          icon: <MousePointer className="h-5 w-5" />,
        },
      ]}
      quotesTitle={tc("what-users-say")}
      quotes={[t("testimonials.1"), t("testimonials.2"), t("testimonials.3")]}
      finalTitle={t("cta.title")}
      finalSubtitle={t("cta.subtitle")}
    />
  );
}
