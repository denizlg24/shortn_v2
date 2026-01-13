import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function UpgradingPlans({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("help-upgrading");
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
          <h2 className="text-2xl font-semibold">{t("upgrade-title")}</h2>
          <p className="text-muted-foreground">{t("upgrade-intro")}</p>
          <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
            <li>{t("upgrade-step1")}</li>
            <li>{t("upgrade-step2")}</li>
            <li>{t("upgrade-step3")}</li>
            <li>{t("upgrade-step4")}</li>
          </ol>
          {/* [SCREENSHOT: Subscription page with upgrade buttons] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("billing-title")}</h2>
          <p className="text-muted-foreground">{t("billing-intro")}</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>{t("billing-item1")}</li>
            <li>{t("billing-item2")}</li>
            <li>{t("billing-item3")}</li>
            <li>{t("billing-item4")}</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("immediate-title")}</h2>
          <p className="text-muted-foreground">{t("immediate-text")}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("downgrade-title")}</h2>
          <p className="text-muted-foreground">{t("downgrade-text")}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("cancel-title")}</h2>
          <p className="text-muted-foreground">{t("cancel-text")}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("next-title")}</h2>
          <p className="text-muted-foreground">{t("next-text")}</p>
          <div className="grid gap-3 mt-4">
            <Button
              asChild
              variant="outline"
              className="justify-between h-auto p-4"
            >
              <Link href="/contact">
                <span>{t("link-contact")}</span>
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
          <Link href="/help/articles/billing/plans-pricing">
            <ArrowLeft className="w-4 h-4" />
            {tCommon("previous", { title: "Plans & Pricing" })}
          </Link>
        </Button>
      </div>
    </main>
  );
}
