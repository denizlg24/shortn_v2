import "server-only";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { isLocale, type Locale } from "@/i18n/locale";
import {
  marketingPath,
  marketingPathHeader,
  type MarketingPage,
} from "@/lib/marketing/routes";
import { pageMetadata } from "@/lib/marketing/seo";
import { env } from "./env";
import { exchangeRate } from "./exchange-rate";

export function marketingOrigins() {
  const config = env();
  return { site: config.PUBLIC_ORIGIN, app: config.BETTER_AUTH_URL };
}

export const appHref = (path: string) =>
  new URL(path, marketingOrigins().app).toString();

/** The current page's path after the locale, set by the proxy. */
export async function currentMarketingPath() {
  return (await headers()).get(marketingPathHeader) ?? "";
}

export const toLocale = (value: string): Locale | null =>
  isLocale(value) ? value : null;

const metaKeys = {
  "": "home",
  features: "features",
  pricing: "pricing",
  about: "about",
  contact: "contact",
  abuse: "abuse",
  privacy: "privacy",
  terms: "terms",
} as const satisfies Record<MarketingPage, string>;

export async function marketingMetadata(
  locale: Locale,
  page: MarketingPage,
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "marketing.meta" });
  const key = metaKeys[page];
  const siteName = t("siteName");
  const title = page ? `${t(`${key}.title`)} · ${siteName}` : t("home.title");
  const site = marketingOrigins().site;
  const metadata = pageMetadata({
    origin: site,
    locale,
    pathFor: (other) => marketingPath(other, page),
    title,
    description: t(`${key}.description`),
    siteName,
  });
  const image = new URL(`/${locale}/og/${key}`, site).toString();
  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: { ...metadata.twitter, images: [image] },
  };
}

const staleRateMs = 7 * 24 * 60 * 60 * 1000;

/** The ECB rate for the euro estimate, or null when it is missing or stale. */
export async function freshEurPerUsd() {
  const rate = await exchangeRate();
  return rate && Date.now() - Date.parse(rate.asOf) < staleRateMs
    ? rate.eurPerUsd
    : null;
}
