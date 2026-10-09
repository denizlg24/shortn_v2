import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function ManagingQRCodes({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("help-managing-qr");
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
          {/* [SCREENSHOT: QR codes dashboard] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("editing-title")}</h2>
          <p className="text-muted-foreground">{t("editing-intro")}</p>
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
          </ul>
          <div className="bg-muted p-4 rounded-lg mt-4">
            <p className="text-sm text-muted-foreground">{t("editing-note")}</p>
          </div>
          {/* [SCREENSHOT: QR code edit interface] */}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("analytics-title")}</h2>
          <p className="text-muted-foreground">{t("analytics-text")}</p>
          {/* [SCREENSHOT: QR code analytics page] */}
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
              <Link href="/help/articles/bio-pages/creating-bio-pages">
                <span>{t("link-bio")}</span>
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
          <Link href="/help/articles/qr-codes/creating-qr-codes">
            <ArrowLeft className="w-4 h-4" />
            {tCommon("previous", { title: "Creating QR Codes" })}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/help/articles/bio-pages/creating-bio-pages">
            {tCommon("next", { title: t("next-bio") })}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </main>
  );
}
