import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { TodaysDate } from "./todays-date";

export const Footer = async () => {
  const t = await getTranslations("footer");

  return (
    <footer className="mt-auto w-full border-t border-black/5">
      <div className="mx-auto grid w-full max-w-[72rem] gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,0.8fr))] lg:px-8 lg:py-20">
        <div className="space-y-5">
          <p className="font-[family-name:var(--font-editorial)] text-5xl font-semibold leading-none tracking-[-0.06em]">
            {t("shortn")}
          </p>
          <div className="space-y-2 text-sm leading-7 text-muted-foreground">
            <p>{t("url-shortener")}</p>
            <p>{t("qr-code-generator")}</p>
            <p>{t("pages")}</p>
            <p>{t("analytics")}</p>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {t("shortn")}
          </p>
          <div className="flex flex-col gap-3 text-sm text-foreground/75">
            <Link href="/" className="transition-colors hover:text-foreground">
              {t("home")}
            </Link>
            <Link
              href="/pricing"
              className="transition-colors hover:text-foreground"
            >
              {t("plans-pricing")}
            </Link>
            <Link
              href="/login"
              className="transition-colors hover:text-foreground"
            >
              {t("login")}
            </Link>
            <Link
              href="/register"
              className="transition-colors hover:text-foreground"
            >
              {t("register")}
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {t("platform-products")}
          </p>
          <div className="flex flex-col gap-3 text-sm text-foreground/75">
            <Link
              href="/products/url-shortener"
              className="transition-colors hover:text-foreground"
            >
              {t("url-shortener")}
            </Link>
            <Link
              href="/products/qr-code"
              className="transition-colors hover:text-foreground"
            >
              {t("qr-code-generator")}
            </Link>
            <Link
              href="/products/pages"
              className="transition-colors hover:text-foreground"
            >
              {t("pages")}
            </Link>
            <Link
              href="/products/analytics"
              className="transition-colors hover:text-foreground"
            >
              {t("analytics")}
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {t("help-resources")}
          </p>
          <div className="flex flex-col gap-3 text-sm text-foreground/75">
            <Link
              href="/help"
              className="transition-colors hover:text-foreground"
            >
              {t("help-center")}
            </Link>
            <Link
              href="/contact"
              className="transition-colors hover:text-foreground"
            >
              {t("contact-us")}
            </Link>
            <Link
              href="/about"
              className="transition-colors hover:text-foreground"
            >
              {t("about-us")}
            </Link>
            <Link
              href="/terms"
              className="transition-colors hover:text-foreground"
            >
              {t("terms-conditions")}
            </Link>
            <Link
              href="/privacy"
              className="transition-colors hover:text-foreground"
            >
              {t("privacy")}
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-black/5">
        <div className="mx-auto flex w-full max-w-[72rem] flex-col gap-3 px-4 py-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            &copy;{" "}
            <Suspense fallback={<>2026</>}>
              <TodaysDate />
            </Suspense>{" "}
            Shortn.at
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/terms"
              className="transition-colors hover:text-foreground"
            >
              {t("terms-conditions")}
            </Link>
            <Link
              href="/privacy"
              className="transition-colors hover:text-foreground"
            >
              {t("privacy")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
