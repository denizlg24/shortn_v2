import { buttonVariants, cn } from "@shortn/ui";
import { getLocale, getTranslations } from "next-intl/server";

export default async function MarketingNotFound() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "marketing.notFound" });
  return (
    <section className="band flex-1">
      <div className="mx-auto flex max-w-[1200px] flex-col items-start gap-6 px-4 pt-20 pb-28 md:px-6 md:pt-28">
        <h1 className="max-w-[18ch] font-display text-headline font-extrabold tracking-[-0.03em] text-balance">
          {t("title")}
        </h1>
        <p className="max-w-[52ch] text-lede text-pretty text-fg-muted">
          {t("body")}
        </p>
        <a
          href={`/${locale}`}
          className={cn(
            buttonVariants({ variant: "primary", size: "lg" }),
            "h-11 px-5",
          )}
        >
          {t("home")}
        </a>
        <p className="max-w-[52ch] text-body text-fg-muted">{t("shortLink")}</p>
      </div>
    </section>
  );
}
