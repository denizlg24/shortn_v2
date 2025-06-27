import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
    locales: ['en', 'pt', 'es'],
    defaultLocale: 'en',
    localeDetection: true,
    localeCookie: {
        path: "/",
        maxAge: 60 * 60 * 24 * 4,
        sameSite: "lax",
        secure: false
    }
});