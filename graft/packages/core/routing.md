# packages/core/routing.ts

- Locale · type · L4-L4 — type Locale = (typeof locales)[number];
- isReservedKey · function · L42-L44 — function isReservedKey(key: string): boolean
- legacyOwned · function · L48-L55 — function legacyOwned(segment: string): boolean
- RedirectPath · interface · L57-L60 — interface RedirectPath
- decode · function · L62-L68 — function decode(segment: string): string | undefined
- parseRedirectPath · function · L70-L83 — function parseRedirectPath(pathname: string): RedirectPath | undefined
- localeFrom · function · L85-L87 — function localeFrom(cookie: string | undefined): Locale
