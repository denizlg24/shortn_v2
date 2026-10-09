import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function CreatingBioPages({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("help-creating-bio");
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
          {/* [SCREENSHOT: Example bio page on mobile] */}
          <div className="bg-muted p-4 rounded-lg mt-4">
            <p className="text-sm font-medium mb-2">Pro Feature:</p>
            <p className="text-sm text-muted-foreground">{t("available")}</p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("create-title")}</h2>
          <p className="text-muted-foreground">{t("create-intro")}</p>
          <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
            <li>{t("create-step1")}</li>
            <li>{t("create-step2")}</li>
            <li>{t("create-step3")}</li>
            <li>{t("create-step4")}</li>
            <li>{t("create-step5")}</li>
          </ol>
          {/* [SCREENSHOT: Bio page creation dialog] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("elements-title")}</h2>
          <p className="text-muted-foreground">{t("elements-intro")}</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              {t.rich("elements-item1", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
            <li>
              {t.rich("elements-item2", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
            <li>
              {t.rich("elements-item3", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
            <li>
              {t.rich("elements-item4", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
          </ul>
          {/* [SCREENSHOT: Add link dialog on bio page] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("customize-title")}</h2>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>{t("customize-item1")}</li>
            <li>{t("customize-item2")}</li>
            <li>{t("customize-item3")}</li>
            <li>{t("customize-item4")}</li>
          </ul>
          {/* [SCREENSHOT: Link customization on bio page] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("analytics-title")}</h2>
          <p className="text-muted-foreground">{t("analytics-text")}</p>
          {/* [SCREENSHOT: Bio page analytics] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("tips-title")}</h2>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>{t("tips-item1")}</li>
            <li>{t("tips-item2")}</li>
            <li>{t("tips-item3")}</li>
            <li>{t("tips-item4")}</li>
            <li>{t("tips-item5")}</li>
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
              <Link href="/help/articles/bio-pages/customizing-bio-pages">
                <span>{t("link-customizing-bio")}</span>
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
          <Link href="/help/articles/bio-pages/customizing-bio-pages">
            {tCommon("next", { title: t("next-customizing-bio") })}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </main>
  );
}
