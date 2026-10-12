# apps/web/src/i18n/locale.ts

- Locale · type · L2-L2 — type Locale = (typeof locales)[number];
- isLocale · function · L6-L7 — isLocale = (value: unknown): value is Locale
- resolveLocale · function · L11-L21 — function resolveLocale( cookie: string | undefined, acceptLanguage: string | null | undefined, ): Locale
- localeFromCookieHeader · function · L23-L32 — function localeFromCookieHeader( cookieHeader: string | null | undefined, acceptLanguage: string | null | undefined, ): Locale
