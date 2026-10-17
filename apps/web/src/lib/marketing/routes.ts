import { isLocale, type Locale } from "@/i18n/locale";

// Pure route table for the root-host marketing site (21 §2). The proxy, the
// sitemap and the edge crawl all read it, so a page or 301 is declared once.

/** The page path after the locale, for links to the same page in another language. */
export const marketingPathHeader = "x-shortn-marketing-path";

export const marketingPages = [
  "",
  "features",
  "pricing",
  "about",
  "contact",
  "abuse",
  "privacy",
  "terms",
] as const;
export type MarketingPage = (typeof marketingPages)[number];

export const marketingPath = (locale: Locale, page: MarketingPage) =>
  page ? `/${locale}/${page}` : `/${locale}`;

export const featureAnchors = [
  "links",
  "qr-codes",
  "bio-pages",
  "campaigns",
  "analytics",
  "teams",
  "developers",
  "safety",
] as const;

const productAnchors: Record<string, (typeof featureAnchors)[number]> = {
  "url-shortener": "links",
  "qr-code": "qr-codes",
  pages: "bio-pages",
  analytics: "analytics",
};

export const guidePaths = [
  "getting-started",
  "links/creating-links",
  "links/managing-links",
  "links/utm-parameters",
  "qr-codes/creating-qr-codes",
  "qr-codes/managing-qr-codes",
  "bio-pages/creating-bio-pages",
  "bio-pages/customizing-bio-pages",
  "campaigns/organizing-campaigns",
  "analytics/understanding-analytics",
  "billing/upgrading-plans",
] as const;

export const guideHref = (locale: Locale, path = "") =>
  path ? `/docs/${locale}/guides/${path}` : `/docs/${locale}/guides`;

// Root-host auth screens move to the app host (21 §2.3). Legacy's email-change
// mail carries a better-auth changeEmail token, which the app confirms at the
// same endpoint its own change mails use.
const authTargets: Record<string, string> = {
  login: "/login",
  register: "/register",
  recover: "/recover",
  reset: "/reset",
  verify: "/verify",
  "verify/sent": "/verify",
  "verify/requested": "/verify",
  "auth/error": "/login",
};

export type MarketingRoute =
  | {
      kind: "redirect";
      status: 301 | 302;
      /** Path on this host, or an absolute URL for the app host. */
      location: string;
      hash?: string;
      /** Keep the incoming query string. */
      keepQuery: boolean;
      /** Visitor language to carry to the app host (21 M1-e). */
      locale?: Locale;
    }
  | { kind: "rewrite"; pathname: string; locale: Locale };

const strip = (pathname: string) =>
  pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

export function routeMarketing(
  rawPathname: string,
  search: URLSearchParams,
  appOrigin: string,
): MarketingRoute | null {
  const pathname = strip(rawPathname);
  const [, first = "", ...restParts] = pathname.split("/");
  if (!isLocale(first)) return null;
  const locale = first;
  const rest = restParts.join("/");

  if (rest.startsWith("safety/") || rest === "dashboard") return null;
  if (rest.startsWith("dashboard/")) return null;

  if (rest === "products") return local(`/${locale}/features`);
  if (rest.startsWith("products/")) {
    const anchor = productAnchors[rest.slice("products/".length)];
    if (anchor) return local(`/${locale}/features`, anchor);
  }

  if (rest === "help" || rest.startsWith("help/")) {
    const article = rest.startsWith("help/articles/")
      ? rest.slice("help/articles/".length)
      : "";
    if (article === "billing/plans-pricing") return local(`/${locale}/pricing`);
    return local(
      guideHref(
        locale,
        (guidePaths as readonly string[]).includes(article) ? article : "",
      ),
    );
  }

  if (rest.startsWith("authenticate/")) return local(`/${rest}`);

  if (rest === "verify/request-change") {
    const token = search.get("token");
    const target = new URL("/api/auth/verify-email", appOrigin);
    if (token) target.searchParams.set("token", token);
    target.searchParams.set("callbackURL", "/verify");
    return {
      kind: "redirect",
      status: 301,
      location: target.toString(),
      keepQuery: false,
      locale,
    };
  }

  const auth = authTargets[rest];
  if (auth)
    return {
      kind: "redirect",
      status: 301,
      location: new URL(auth, appOrigin).toString(),
      keepQuery: true,
      locale,
    };

  return {
    kind: "rewrite",
    pathname: rest ? `/_marketing/${locale}/${rest}` : `/_marketing/${locale}`,
    locale,
  };
}

function local(location: string, hash?: string): MarketingRoute {
  return {
    kind: "redirect",
    status: 301,
    location,
    keepQuery: true,
    ...(hash ? { hash } : {}),
  };
}

/** `NEXT_LOCALE` must reach both the root and the app host. */
export function sharedCookieDomain(publicOrigin: string | undefined) {
  if (!publicOrigin) return undefined;
  const { hostname } = new URL(publicOrigin);
  if (hostname === "localhost" || /^[\d.]+$/.test(hostname)) return undefined;
  return hostname.split(".").slice(-2).join(".");
}
