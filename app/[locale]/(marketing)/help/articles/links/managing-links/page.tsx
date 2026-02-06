import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function ManagingLinks({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("help-managing-links");
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
          <h2 className="text-2xl font-semibold">{t("dashboard-title")}</h2>
          <p className="text-muted-foreground">{t("dashboard-text")}</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>{t("dashboard-item1")}</li>
            <li>{t("dashboard-item2")}</li>
            <li>{t("dashboard-item3")}</li>
            <li>{t("dashboard-item4")}</li>
          </ul>
          {/* [SCREENSHOT: Links dashboard with filters and search] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("editing-title")}</h2>
          <p className="text-muted-foreground">{t("editing-intro")}</p>
          {/* [SCREENSHOT: Link card with all elements labeled] */}
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              {t.rich("editing-item1", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
            <li>
              {t.rich("editing-item2", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
            <li>
              {t.rich("editing-item3", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
            <li>
              {t.rich("editing-item4", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
            <li>
              {t.rich("editing-item5", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
          </ul>
          {/* [SCREENSHOT: Link edit dialog] */}
          <div className="bg-muted p-4 rounded-lg mt-4">
            <p className="text-sm text-muted-foreground">{t("editing-note")}</p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("details-title")}</h2>
          <p className="text-muted-foreground">{t("details-intro")}</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>{t("details-item1")}</li>
            <li>{t("details-item2")}</li>
            <li>{t("details-item3")}</li>
            <li>{t("details-item4")}</li>
            <li>{t("details-item5")}</li>
          </ul>
          {/* [SCREENSHOT: Copy button on link card] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("filtering-title")}</h2>
          <p className="text-muted-foreground">{t("filtering-intro")}</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              {t.rich("filtering-item1", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
            <li>
              {t.rich("filtering-item2", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
            <li>
              {t.rich("filtering-item3", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
            <li>
              {t.rich("filtering-item4", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
          </ul>
          {/* [SCREENSHOT: Link card action buttons] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("bulk-title")}</h2>
          <p className="text-muted-foreground">{t("bulk-intro")}</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>{t("bulk-item1")}</li>
            <li>{t("bulk-item2")}</li>
            <li>{t("bulk-item3")}</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("deleting-title")}</h2>
          <p className="text-muted-foreground">{t("deleting-text")}</p>
          <div className="bg-muted p-4 rounded-lg mt-4">
            <p className="text-sm text-muted-foreground">
              {t.rich("deleting-warning", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("next-title")}</h2>
          <div className="grid gap-3 mt-4">
            <Button
              asChild
              variant="outline"
              className="justify-between h-auto p-4"
            >
              <Link href="/help/articles/links/utm-parameters">
                <span>{t("link-utm")}</span>
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
          <Link href="/help/articles/links/creating-links">
            <ArrowLeft className="w-4 h-4" />
            {tCommon("previous", { title: "Creating Links" })}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/help/articles/links/utm-parameters">
            {tCommon("next", { title: t("next-utm-parameters") })}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </main>
  );
}
