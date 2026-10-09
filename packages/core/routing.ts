// Shared by the edge Worker and apps/redirect, so it must stay free of Node APIs.

export const locales = ["en", "es", "pt"] as const;
export type Locale = (typeof locales)[number];

// Legacy PUBLIC_PATHS plus the paths the rebuilt apps own. A short link key can
// never take one of these, and the Worker never sends them to apps/redirect.
export const reservedKeys: ReadonlySet<string> = new Set([
  ...locales,
  "api",
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
  ".well-known",
  "b",
  "qr",
  "app",
  "monitoring",
  "pricing",
  "help",
  "about",
  "products",
  "login",
  "register",
  "recover",
  "reset",
  "verify",
  "privacy",
  "terms",
  "contact",
  "dashboard",
  "url-not-found",
  "authenticate",
  "safety",
  "abuse",
  "__health",
  "__metrics",
]);

export function isReservedKey(key: string): boolean {
  return reservedKeys.has(key.toLowerCase());
}

// Legacy's proxy sends dotfiles and file-like paths to its not-found page and
// lets the framework handle absolute-URL-looking paths, so those stay on legacy.
function legacyOwned(segment: string): boolean {
  return (
    segment.startsWith(".") ||
    /\.[a-z0-9]+$/i.test(segment) ||
    segment.startsWith("http") ||
    segment.includes("://")
  );
}

export interface RedirectPath {
  key: string;
  legacyQrPath: boolean;
}

function decode(segment: string): string | undefined {
  try {
    return decodeURIComponent(segment);
  } catch {
    return undefined;
  }
}

export function parseRedirectPath(pathname: string): RedirectPath | undefined {
  if (pathname.includes("://")) return undefined;
  const segments = pathname.replace(/^\/+/, "").replace(/\/$/, "").split("/");
  const [first, second, ...rest] = segments;
  if (!first || rest.length) return undefined;
  const legacyQrPath = first === "qr" && second !== undefined;
  if (second !== undefined && !legacyQrPath) return undefined;
  const raw = legacyQrPath ? second : first;
  if (!raw || legacyOwned(raw)) return undefined;
  const key = decode(raw);
  if (!key || legacyOwned(key)) return undefined;
  if (!legacyQrPath && isReservedKey(key)) return undefined;
  return { key, legacyQrPath };
}

export function localeFrom(cookie: string | undefined): Locale {
  return locales.find((locale) => locale === cookie) ?? "en";
}
