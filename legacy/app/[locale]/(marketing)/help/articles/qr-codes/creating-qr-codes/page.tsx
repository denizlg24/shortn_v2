import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function CreatingQRCodes({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("help-creating-qr");
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
          {/* [SCREENSHOT: Example QR code being scanned with phone] */}
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
          {/* [SCREENSHOT: QR code creation interface] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("customize-title")}</h2>
          <p className="text-muted-foreground">{t("customize-intro")}</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              {t.rich("customize-color", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
            <li>
              {t.rich("customize-pattern", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
            <li>
              {t.rich("customize-corners", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
            <li>
              {t.rich("customize-logo", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
          </ul>
          {/* [SCREENSHOT: QR code customization options] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("download-title")}</h2>
          <p className="text-muted-foreground">{t("download-text")}</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              {t.rich("download-png", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
            <li>
              {t.rich("download-svg", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
            <li>
              {t.rich("download-jpeg", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
          </ul>
          {/* [SCREENSHOT: Download format options] */}
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
          <h2 className="text-2xl font-semibold">{t("linking-title")}</h2>
          <p className="text-muted-foreground">{t("linking-text")}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("next-title")}</h2>
          <div className="grid gap-3 mt-4">
            <Button
              asChild
              variant="outline"
              className="justify-between h-auto p-4"
            >
              <Link href="/help/articles/qr-codes/managing-qr-codes">
                <span>{t("link-managing-qr")}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="justify-between h-auto p-4"
            >
              <Link href="/help/articles/bio-pages/creating-bio-pages">
                <span>{t("link-bio-pages")}</span>
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
          <Link href="/help/articles/qr-codes/managing-qr-codes">
            {tCommon("next", { title: t("next-managing-qr") })}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </main>
  );
}
