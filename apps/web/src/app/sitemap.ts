import type { MetadataRoute } from "next";
import { locales, type Locale } from "@/i18n/locale";
import {
  guideHref,
  guidePaths,
  marketingPages,
  marketingPath,
} from "@/lib/marketing/routes";
import { alternateUrls } from "@/lib/marketing/seo";
import { env } from "@/server/env";

export const dynamic = "force-dynamic";

// Generated from the route table (21 §2.5): every URL is self-canonical with
// reciprocal hreflang. Redirect sources never appear here.
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = env().PUBLIC_ORIGIN;
  const localized = (pathFor: (locale: Locale) => string) =>
    locales.map((locale) => ({
      url: new URL(pathFor(locale), origin).toString(),
      alternates: { languages: alternateUrls(origin, pathFor) },
    }));
  return [
    ...marketingPages.flatMap((page) =>
      localized((locale) => marketingPath(locale, page)),
    ),
    ...localized((locale) => guideHref(locale)),
    ...guidePaths.flatMap((path) =>
      localized((locale) => guideHref(locale, path)),
    ),
    { url: new URL("/docs", origin).toString() },
  ];
}
