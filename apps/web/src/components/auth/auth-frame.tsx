"use client";

import { cn, ShortnMark } from "@shortn/ui";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { locales } from "@/i18n/locale";
import { useLocaleSwitch } from "@/lib/use-locale-switch";

export function AuthFrame({ children }: { children: ReactNode }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const switchLocale = useLocaleSwitch();
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex flex-1 justify-center px-4 pt-[max(3rem,12vh)] pb-12">
        <div className="flex w-full max-w-[380px] flex-col">
          <div className="mb-8 flex items-center justify-center gap-2.5">
            <ShortnMark size={28} />
            <span className="text-emphasis font-semibold tracking-[-0.01em]">
              {t("brand")}
            </span>
          </div>
          {children}
        </div>
      </main>
      <footer className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 pb-6 text-meta text-fg-subtle">
        <div
          role="group"
          aria-label={t("language")}
          className="flex items-center gap-1"
        >
          {locales.map((option) => (
            <button
              key={option}
              type="button"
              lang={option}
              aria-pressed={option === locale}
              onClick={() => switchLocale(option)}
              className={cn(
                "cursor-pointer rounded-chip px-1.5 py-0.5 hover:text-fg",
                option === locale && "font-medium text-fg",
              )}
            >
              {t(`languages.${option}`)}
            </button>
          ))}
        </div>
        <a
          href={`https://shortn.at/${locale}/terms`}
          className="hover:text-fg hover:underline"
        >
          {t("terms")}
        </a>
        <a
          href={`https://shortn.at/${locale}/privacy`}
          className="hover:text-fg hover:underline"
        >
          {t("privacy")}
        </a>
      </footer>
    </div>
  );
}
