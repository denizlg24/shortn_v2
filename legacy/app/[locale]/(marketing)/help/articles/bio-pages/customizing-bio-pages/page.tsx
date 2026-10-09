import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function CustomizingBioPages({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("help-customizing-bio");
  const tCommon = await getTranslations("help-common");

  return (
    <main className="flex flex-col items-start w-full max-w-4xl mx-auto px-4 py-12 gap-8">
      <Button asChild variant="ghost" size="sm">
        <Link href="/help">
          <ArrowLeft className="w-4 h-4" />
          {tCommon("back-to-help")}
        </Link>
      </Button>

      <div className="w-full space-y-2">
        <h1 className="text-4xl md:text-5xl font-bold">{t("title")}</h1>
        <p className="text-lg text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Separator />

      <article className="w-full space-y-8 text-base leading-relaxed">
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("themes-title")}</h2>
          <p className="text-muted-foreground">{t("themes-text")}</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>{t("themes-item1")}</li>
            <li>{t("themes-item2")}</li>
            <li>{t("themes-item3")}</li>
            <li>{t("themes-item4")}</li>
          </ul>
          {/* [SCREENSHOT: Customize tab on bio page] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("colors-title")}</h2>
          <p className="text-muted-foreground">{t("colors-intro")}</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              {t.rich("colors-item1", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
            <li>
              {t.rich("colors-item2", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
            <li>
              {t.rich("colors-item3", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
            <li>
              {t.rich("colors-item4", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
          </ul>
          {/* [SCREENSHOT: Color picker interface] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("layout-title")}</h2>
          <p className="text-muted-foreground">{t("layout-text")}</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>{t("layout-item1")}</li>
            <li>{t("layout-item2")}</li>
            <li>{t("layout-item3")}</li>
            <li>{t("layout-item4")}</li>
          </ul>
          {/* [SCREENSHOT: Layout options] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("branding-title")}</h2>
          <p className="text-muted-foreground">{t("branding-intro")}</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>{t("branding-item1")}</li>
            <li>{t("branding-item2")}</li>
            <li>{t("branding-item3")}</li>
            <li>{t("branding-item4")}</li>
          </ul>
          {/* [SCREENSHOT: Branding options] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("preview-title")}</h2>
          <p className="text-muted-foreground">{t("preview-text")}</p>
          {/* [SCREENSHOT: Live preview pane] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("next-title")}</h2>
          <div className="grid gap-3 mt-4">
            <Button
              asChild
              variant="outline"
              className="justify-between h-auto p-4"
            >
              <Link href="/help/articles/campaigns/organizing-campaigns">
                <span>{t("link-campaigns")}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="justify-between h-auto p-4"
            >
              <Link href="/help/articles/billing/plans-pricing">
                <span>{t("link-plans")}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </section>
      </article>

      <Separator />

      <div className="w-full flex justify-between items-center">
        <Button asChild variant="ghost">
          <Link href="/help/articles/bio-pages/creating-bio-pages">
            <ArrowLeft className="w-4 h-4" />
            {tCommon("previous", { title: "Creating Bio Pages" })}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/help/articles/analytics/understanding-analytics">
            {tCommon("next", { title: t("next-campaigns") })}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </main>
  );
}
