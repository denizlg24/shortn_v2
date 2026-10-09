import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function UnderstandingAnalytics({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("help-analytics");
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
          <h2 className="text-2xl font-semibold">{t("overview-title")}</h2>
          <p className="text-muted-foreground">{t("overview-text")}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("by-plan-title")}</h2>
          <div className="space-y-3">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">{t("free-title")}</p>
              <p className="text-sm text-muted-foreground">{t("free-text")}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">{t("basic-title")}</p>
              <p className="text-sm text-muted-foreground">{t("basic-text")}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">{t("plus-title")}</p>
              <p className="text-sm text-muted-foreground">{t("plus-text")}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">{t("pro-title")}</p>
              <p className="text-sm text-muted-foreground">{t("pro-text")}</p>
            </div>
          </div>
          {/* [SCREENSHOT: Analytics dashboard comparison] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("link-title")}</h2>
          <p className="text-muted-foreground">{t("link-intro")}</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              {t.rich("link-item1", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
            <li>
              {t.rich("link-item2", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
            <li>
              {t.rich("link-item3", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
            <li>
              {t.rich("link-item4", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
            <li>
              {t.rich("link-item5", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
            <li>
              {t.rich("link-item6", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
          </ul>
          {/* [SCREENSHOT: Link details page with analytics] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("geo-title")}</h2>
          <p className="text-muted-foreground">{t("geo-intro")}</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>{t("geo-item1")}</li>
            <li>{t("geo-item2")}</li>
            <li>{t("geo-item3")}</li>
            <li>{t("geo-item4")}</li>
          </ul>
          {/* [SCREENSHOT: Geographic analytics with map] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("time-title")}</h2>
          <p className="text-muted-foreground">{t("time-intro")}</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>{t("time-item1")}</li>
            <li>{t("time-item2")}</li>
            <li>{t("time-item3")}</li>
            <li>{t("time-item4")}</li>
          </ul>
          {/* [SCREENSHOT: Time series chart with date range selector] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("campaign-title")}</h2>
          <p className="text-muted-foreground">{t("campaign-text")}</p>
          {/* [SCREENSHOT: Campaign analytics dashboard] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("export-title")}</h2>
          <p className="text-muted-foreground">{t("export-text")}</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>{t("export-item1")}</li>
            <li>{t("export-item2")}</li>
            <li>{t("export-item3")}</li>
          </ul>
          {/* [SCREENSHOT: Export button and options] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("tips-title")}</h2>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>{t("tips-item1")}</li>
            <li>{t("tips-item2")}</li>
            <li>{t("tips-item3")}</li>
            <li>{t("tips-item4")}</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("next-title")}</h2>
          <div className="grid gap-3 mt-4">
            <Button
              asChild
              variant="outline"
              className="justify-between h-auto p-4"
            >
              <Link href="/help/articles/qr-codes/creating-qr-codes">
                <span>{t("link-qr")}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
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
          </div>
        </section>
      </article>

      <Separator />

      <div className="w-full flex justify-between items-center">
        <Button asChild variant="ghost">
          <Link href="/help">
            <ArrowLeft className="w-4 h-4" />
            {tCommon("back-to-help")}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/help/articles/campaigns/organizing-campaigns">
            {tCommon("next", { title: t("next-qr-codes") })}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </main>
  );
}
