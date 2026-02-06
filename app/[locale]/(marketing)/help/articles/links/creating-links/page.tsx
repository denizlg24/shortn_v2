import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function CreatingLinks({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("help-creating-links");
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
          <h2 className="text-2xl font-semibold">{t("quick-create-title")}</h2>
          <p className="text-muted-foreground">{t("quick-create-intro")}</p>
          <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
            <li>{t("quick-create-step1")}</li>
            <li>{t("quick-create-step2")}</li>
            <li>{t("quick-create-step3")}</li>
          </ol>
          {/* [SCREENSHOT: Quick create widget on dashboard home] */}
          <p className="text-muted-foreground mt-4">
            {t("quick-create-outro")}
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("advanced-title")}</h2>
          <p className="text-muted-foreground">{t("advanced-intro")}</p>
          <ol className="list-decimal pl-6 space-y-3 text-muted-foreground">
            <li>
              {t.rich("advanced-step1", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
            <li>{t("advanced-step2")}</li>
            <li>{t("advanced-step3")}</li>
            <li>{t("advanced-step4")}</li>
            <li>{t("advanced-step5")}</li>
            <li>{t("advanced-step6")}</li>
          </ol>
          {/* [SCREENSHOT: Link creation form with all fields visible] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("backhalf-title")}</h2>
          <p className="text-muted-foreground">{t("backhalf-intro")}</p>
          {/* [SCREENSHOT: Custom back-half input field] */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <p className="text-sm font-medium">{t("backhalf-example")}</p>
            <p className="text-sm text-muted-foreground">
              {t("backhalf-instead")}{" "}
              <code className="bg-background px-2 py-1 rounded">
                shortn.at/a8K9xR
              </code>
            </p>
            <p className="text-sm text-muted-foreground">
              {t("backhalf-create")}{" "}
              <code className="bg-background px-2 py-1 rounded">
                shortn.at/summer-sale
              </code>
            </p>
          </div>
          <p className="text-muted-foreground mt-4">{t("backhalf-rules")}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("titles-title")}</h2>
          <p className="text-muted-foreground">{t("titles-text1")}</p>
          {/* [SCREENSHOT: Link title field and automatic title fetching] */}
          <p className="text-muted-foreground">{t("titles-text2")}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("tags-title")}</h2>
          <p className="text-muted-foreground">{t("tags-intro")}</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>{t("tags-item1")}</li>
            <li>{t("tags-item2")}</li>
            <li>{t("tags-item3")}</li>
            <li>{t("tags-item4")}</li>
          </ul>
          {/* [SCREENSHOT: Tag selector with multiple tags applied] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("password-title")}</h2>
          <p className="text-muted-foreground">{t("password-intro")}</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>{t("password-use1")}</li>
            <li>{t("password-use2")}</li>
            <li>{t("password-use3")}</li>
            <li>{t("password-use4")}</li>
          </ul>
          {/* [SCREENSHOT: Password protection fields with hint] */}
          <p className="text-muted-foreground mt-4">{t("password-when")}</p>
          <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
            <li>{t("password-feature1")}</li>
            <li>{t("password-feature2")}</li>
            <li>{t("password-feature3")}</li>
            <li>{t("password-feature4")}</li>
          </ol>
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
          <h2 className="text-2xl font-semibold">{t("next-title")}</h2>
          <div className="grid gap-3 mt-4">
            <Button
              asChild
              variant="outline"
              className="justify-between h-auto p-4"
            >
              <Link href="/help/articles/links/managing-links">
                <span>{t("link-managing")}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
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
          <Link href="/help/articles/links/managing-links">
            {tCommon("next", { title: t("next-managing-links") })}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </main>
  );
}
