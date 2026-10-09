import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function PlansPricing({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("help-plans");
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
          <div className="grid gap-4">
            <div className="p-6 bg-muted rounded-lg space-y-3">
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold">{t("free-title")}</h3>
                <span className="text-muted-foreground">{t("free-price")}</span>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  {t("free-item1")}
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  {t("free-item2")}
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  {t("free-item3")}
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  {t("free-item4")}
                </li>
              </ul>
            </div>

            <div className="p-6 bg-muted rounded-lg space-y-3">
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold">{t("basic-title")}</h3>
                <span className="text-muted-foreground">
                  {t("basic-price")}
                </span>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  {t("basic-item1")}
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  {t("basic-item2")}
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  {t("basic-item3")}
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  {t("basic-item4")}
                </li>
              </ul>
            </div>

            <div className="p-6 bg-muted rounded-lg space-y-3">
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold">{t("plus-title")}</h3>
                <span className="text-muted-foreground">{t("plus-price")}</span>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  {t("plus-item1")}
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  {t("plus-item2")}
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  {t("plus-item3")}
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  {t("plus-item4")}
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  {t("plus-item5")}
                </li>
              </ul>
            </div>

            <div className="p-6 bg-muted rounded-lg border-2 border-primary space-y-3">
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold">{t("pro-title")}</h3>
                <span className="text-muted-foreground">{t("pro-price")}</span>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  {t("pro-item1")}
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  {t("pro-item2")}
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  {t("pro-item3")}
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  {t("pro-item4")}
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  {t("pro-item5")}
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  {t("pro-item6")}
                </li>
                <li className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  {t("pro-item7")}
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("compare-title")}</h2>
          <p className="text-muted-foreground">{t("compare-text")}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("changing-title")}</h2>
          <p className="text-muted-foreground">{t("changing-text")}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("next-title")}</h2>
          <div className="grid gap-3 mt-4">
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
            <Button
              asChild
              variant="outline"
              className="justify-between h-auto p-4"
            >
              <Link href="/help/articles/getting-started">
                <span>{t("link-getting-started")}</span>
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
          <Link href="/help/articles/billing/upgrading-plans">
            {tCommon("next", { title: t("next-upgrading") })}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </main>
  );
}
