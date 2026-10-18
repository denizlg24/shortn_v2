import type { Metadata } from "next";
import { locales, type Locale } from "@/i18n/locale";

// hreflang uses the language subtag only: pt is European Portuguese and es is
// Spain Spanish, and there is no second regional variant to disambiguate.
export function alternateUrls(
  origin: string,
  pathFor: (locale: Locale) => string,
) {
  const languages: Record<string, string> = {};
  for (const locale of locales)
    languages[locale] = new URL(pathFor(locale), origin).toString();
  languages["x-default"] = new URL(pathFor("en"), origin).toString();
  return languages;
}

export function pageMetadata({
  origin,
  locale,
  pathFor,
  title,
  description,
  siteName,
}: {
  origin: string;
  locale: Locale;
  pathFor: (locale: Locale) => string;
  title: string;
  description: string;
  siteName: string;
}): Metadata {
  const canonical = new URL(pathFor(locale), origin).toString();
  return {
    title: { absolute: title },
    description,
    alternates: { canonical, languages: alternateUrls(origin, pathFor) },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      url: canonical,
      siteName,
      title,
      description,
      locale: ogLocale[locale],
      alternateLocale: locales
        .filter((other) => other !== locale)
        .map((other) => ogLocale[other]),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

const ogLocale: Record<Locale, string> = {
  en: "en_US",
  pt: "pt_PT",
  es: "es_ES",
};
