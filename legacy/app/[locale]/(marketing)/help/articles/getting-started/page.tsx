import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { setRequestLocale, getTranslations } from "next-intl/server";

export default async function GettingStarted({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("help-getting-started");
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
          <h2 className="text-2xl font-semibold">{t("welcome-title")}</h2>
          <p className="text-muted-foreground">{t("welcome-text")}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("first-link-title")}</h2>
          <p className="text-muted-foreground">{t("first-link-intro")}</p>
          <ol className="list-decimal pl-6 space-y-3 text-muted-foreground">
            <li>{t("first-link-step1")}</li>
            <li>{t("first-link-step2")}</li>
            <li>{t("first-link-step3")}</li>
          </ol>
          <p className="text-muted-foreground mt-4">{t("first-link-outro")}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("plans-title")}</h2>
          <p className="text-muted-foreground">{t("plans-intro")}</p>
          <div className="space-y-4 mt-4">
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">{t("plan-free-title")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("plan-free-text")}
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">{t("plan-basic-title")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("plan-basic-text")}
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">{t("plan-plus-title")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("plan-plus-text")}
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">{t("plan-pro-title")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("plan-pro-text")}
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("nav-title")}</h2>
          <p className="text-muted-foreground">{t("nav-intro")}</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              {t.rich("nav-home", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
            <li>
              {t.rich("nav-links", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
            <li>
              {t.rich("nav-qr", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
            <li>
              {t.rich("nav-campaigns", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
            <li>
              {t.rich("nav-pages", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
            <li>
              {t.rich("nav-settings", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("next-title")}</h2>
          <p className="text-muted-foreground">{t("next-intro")}</p>
          <div className="grid gap-3 mt-4">
            <Button
              asChild
              variant="outline"
              className="justify-between h-auto p-4"
            >
              <Link href="/help/articles/links/creating-links">
                <span>{t("link-advanced")}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
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
              <Link href="/help/articles/analytics/understanding-analytics">
                <span>{t("link-analytics")}</span>
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
          <Link href="/help/articles/links/creating-links">
            {tCommon("next", { title: t("next-creating-links") })}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </main>
  );
}
