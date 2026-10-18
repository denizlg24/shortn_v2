export const locales = ["en", "pt", "es"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const localeCookie = "NEXT_LOCALE";
export const routedLocaleHeader = "x-shortn-locale";

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (locales as readonly string[]).includes(value);

// The cookie is shared with legacy's next-intl, so a language picked there
// carries over.
export function resolveLocale(
  cookie: string | undefined,
  acceptLanguage: string | null | undefined,
): Locale {
  if (isLocale(cookie)) return cookie;
  for (const part of (acceptLanguage ?? "").split(",")) {
    const tag = part.split(";")[0]?.trim().toLowerCase().slice(0, 2);
    if (isLocale(tag)) return tag;
  }
  return defaultLocale;
}

export function localeFromCookieHeader(
  cookieHeader: string | null | undefined,
  acceptLanguage: string | null | undefined,
): Locale {
  const match = cookieHeader
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === localeCookie);
  return resolveLocale(match?.[1], acceptLanguage);
}
