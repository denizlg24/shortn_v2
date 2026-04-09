import { ProductPage } from "@/components/marketing/product-page";
import { ChartAreaIcon, LineSquiggle, Palette } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("products.qr-code");
  const tc = await getTranslations("products.common");

  return (
    <ProductPage
      title={t("hero.title")}
      subtitle={t("hero.subtitle")}
      ctaLabel={tc("get-started")}
      featuresTitle={t("features.title")}
      features={[
        {
          title: t("features.customizable-design.title"),
          description: t("features.customizable-design.description"),
          icon: <Palette className="h-5 w-5" />,
        },
        {
          title: t("features.dynamic-updates.title"),
          description: t("features.dynamic-updates.description"),
          icon: <LineSquiggle className="h-5 w-5" />,
        },
        {
          title: t("features.detailed-analytics.title"),
          description: t("features.detailed-analytics.description"),
          icon: <ChartAreaIcon className="h-5 w-5" />,
        },
      ]}
      quotesTitle={tc("what-users-say")}
      quotes={[t("testimonials.1"), t("testimonials.2"), t("testimonials.3")]}
      finalTitle={t("cta.title")}
      finalSubtitle={t("cta.subtitle")}
    />
  );
}
