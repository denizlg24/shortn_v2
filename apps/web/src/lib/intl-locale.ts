import { useLocale } from "next-intl";
import type { Locale } from "@/i18n/locale";

const intlLocales: Record<Locale, string> = {
  en: "en-GB",
  pt: "pt-PT",
  es: "es-ES",
};

/** BCP 47 tag for Intl formatters; `pt` alone would format as Brazilian Portuguese. */
export function useIntlLocale(): string {
  return intlLocales[useLocale()];
}
