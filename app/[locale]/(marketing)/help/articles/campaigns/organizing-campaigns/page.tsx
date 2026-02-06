import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function OrganizingCampaigns({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("help-campaigns");
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
          {/* [SCREENSHOT: Campaigns dashboard view] */}
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
          </ol>
          {/* [SCREENSHOT: Campaign creation dialog] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("adding-title")}</h2>
          <p className="text-muted-foreground">{t("adding-intro")}</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>{t("adding-item1")}</li>
            <li>{t("adding-item2")}</li>
            <li>{t("adding-item3")}</li>
          </ul>
          {/* [SCREENSHOT: Adding links to campaign interface] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("utm-title")}</h2>
          <p className="text-muted-foreground">{t("utm-text")}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("analytics-title")}</h2>
          <p className="text-muted-foreground">{t("analytics-intro")}</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>{t("analytics-item1")}</li>
            <li>{t("analytics-item2")}</li>
            <li>{t("analytics-item3")}</li>
            <li>{t("analytics-item4")}</li>
            <li>{t("analytics-item5")}</li>
          </ul>
          {/* [SCREENSHOT: Campaign analytics dashboard] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("managing-title")}</h2>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>{t("managing-item1")}</li>
            <li>{t("managing-item2")}</li>
            <li>{t("managing-item3")}</li>
            <li>{t("managing-item4")}</li>
          </ul>
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
              <Link href="/help/articles/billing/plans-pricing">
                <span>{t("link-plans")}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="justify-between h-auto p-4"
            >
              <Link href="/help/articles/billing/upgrading-plans">
                <span>{t("link-upgrading")}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </section>
      </article>

      <Separator />

      <div className="w-full flex justify-between items-center">
        <Button asChild variant="ghost">
          <Link href="/help/articles/analytics/understanding-analytics">
            <ArrowLeft className="w-4 h-4" />
            {tCommon("previous", { title: "Understanding Analytics" })}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/help/articles/billing/plans-pricing">
            {tCommon("next", { title: t("next-plans") })}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </main>
  );
}
