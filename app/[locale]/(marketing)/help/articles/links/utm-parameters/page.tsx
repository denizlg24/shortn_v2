import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function UTMParameters({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("help-utm-parameters");
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
          <h2 className="text-2xl font-semibold">{t("what-title")}</h2>
          <p className="text-muted-foreground">{t("what-text")}</p>
          {/* [SCREENSHOT: Example URL with UTM parameters highlighted] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("five-title")}</h2>
          <div className="space-y-3">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">{t("source-title")}</p>
              <p className="text-sm text-muted-foreground">
                {t("source-text")}
              </p>
              <code className="text-xs bg-background px-2 py-1 rounded mt-2 block">
                {t("source-examples")}
              </code>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">{t("medium-title")}</p>
              <p className="text-sm text-muted-foreground">
                {t("medium-text")}
              </p>
              <code className="text-xs bg-background px-2 py-1 rounded mt-2 block">
                {t("medium-examples")}
              </code>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">{t("campaign-title")}</p>
              <p className="text-sm text-muted-foreground">
                {t("campaign-text")}
              </p>
              <code className="text-xs bg-background px-2 py-1 rounded mt-2 block">
                {t("campaign-examples")}
              </code>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">{t("term-title")}</p>
              <p className="text-sm text-muted-foreground">{t("term-text")}</p>
              <code className="text-xs bg-background px-2 py-1 rounded mt-2 block">
                {t("term-examples")}
              </code>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">{t("content-title")}</p>
              <p className="text-sm text-muted-foreground">
                {t("content-text")}
              </p>
              <code className="text-xs bg-background px-2 py-1 rounded mt-2 block">
                {t("content-examples")}
              </code>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("adding-title")}</h2>
          <p className="text-muted-foreground">{t("adding-intro")}</p>
          <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
            <li>{t("adding-step1")}</li>
            <li>{t("adding-step2")}</li>
            <li>{t("adding-step3")}</li>
            <li>{t("adding-step4")}</li>
          </ol>
          {/* [SCREENSHOT: UTM builder interface] */}
          <div className="bg-muted p-4 rounded-lg mt-4">
            <p className="text-sm text-muted-foreground">{t("tip-text")}</p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("best-title")}</h2>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>{t("best-item1")}</li>
            <li>{t("best-item2")}</li>
            <li>{t("best-item3")}</li>
            <li>{t("best-item4")}</li>
            <li>{t("best-item5")}</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("example-title")}</h2>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">{t("example-original")}</p>
              <code className="text-xs bg-background px-2 py-1 rounded block">
                https://example.com/products/shoes
              </code>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">{t("example-with-utm")}</p>
              <code className="text-xs bg-background px-2 py-1 rounded block break-all">
                https://example.com/products/shoes?utm_source=twitter&utm_medium=social&utm_campaign=spring_sale
              </code>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("campaigns-title")}</h2>
          <p className="text-muted-foreground">{t("campaigns-text")}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("next-title")}</h2>
          <div className="grid gap-3 mt-4">
            <Button
              asChild
              variant="outline"
              className="justify-between h-auto p-4"
            >
              <Link href="/help/articles/analytics/understanding-analytics">
                <span>{t("link-analytics")}</span>
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
          <Link href="/help/articles/links/managing-links">
            <ArrowLeft className="w-4 h-4" />
            {tCommon("previous", { title: "Managing Links" })}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/help/articles/qr-codes/creating-qr-codes">
            {tCommon("next", { title: t("next-analytics") })}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </main>
  );
}
