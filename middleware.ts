import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';
import { geolocation, ipAddress } from '@vercel/functions';
import createMiddleware from 'next-intl/middleware';
import { getToken } from 'next-auth/jwt';
import env from './utils/env';

const locales = routing.locales as readonly string[];

function isLocale(value: string): value is (typeof locales)[number] {
    return locales.includes(value as any);
}

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    const slugCandidate = pathname.split('/')[1];
    const user = await getToken({ req: request, secret: env.AUTH_SECRET });
    if (!isLocale(slugCandidate) && slugCandidate !== '' && slugCandidate !== "url-not-found") {
        const clickData = {
            slug: slugCandidate,
            ip: ipAddress(request) || "",
            userAgent: request.headers.get("user-agent") || "",
            referrer: request.headers.get("referer") || "",
            language: request.headers.get("accept-language")?.split(",")[0] || "",
            geo: geolocation(request),
            timezone: request.headers.get('x-vercel-ip-timezone'),
            query: Object.fromEntries(request.nextUrl.searchParams.entries()),
        };
        try {
            fetch(`${request.nextUrl.origin}/api/track-click`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(clickData),
            }).catch(() => null);

            const res = await fetch(`${request.nextUrl.origin}/api/get-long-url/${slugCandidate}`);
            const { longUrl } = await res.json();

            if (longUrl) {
                return NextResponse.redirect(longUrl);
            }
            return NextResponse.redirect(new URL(`/${request.cookies.get('NEXT_LOCALE')?.value || 'en'}/url-not-found`, request.nextUrl));
        } catch (error) {
            return NextResponse.redirect(new URL(`/${request.cookies.get('NEXT_LOCALE')?.value || 'en'}/url-not-found`, request.nextUrl));
        }
    }

    const isLoggedIn = !!user;
    const locale = request.cookies.get('NEXT_LOCALE')?.value || 'en';
    const isDashboardRoot = request.nextUrl.pathname === `/${locale}/dashboard`;
    const isDashboard = request.nextUrl.pathname.startsWith(`/${locale}/dashboard`);
    const isLogin = request.nextUrl.pathname.startsWith(`/${locale}/login`);
    const isRegister = request.nextUrl.pathname.startsWith(`/${locale}/register`);
    const isUrlNotFound = request.nextUrl.pathname === `/${locale}/url-not-found`;

    const userOrgId = user?.sub.split("|")[1];

    if (isDashboard && !isLoggedIn) {
        return NextResponse.redirect(new URL(`/${locale}/login`, request.nextUrl));
    }
    if (isDashboard && isLoggedIn) {
        const segments = request.nextUrl.pathname.split("/");
        const orgIdInUrl = segments[3];

        if (orgIdInUrl && orgIdInUrl !== userOrgId) {
            return NextResponse.redirect(new URL(`/${locale}/dashboard/${userOrgId}`, request.nextUrl));
        }
    }

    if ((isLogin || isRegister || isDashboardRoot) && isLoggedIn) {
        return NextResponse.redirect(new URL(`/${locale}/dashboard/${userOrgId}`, request.nextUrl));
    }

    if (!isDashboard && !isUrlNotFound && isLoggedIn) {
        return NextResponse.redirect(new URL(`/${locale}/dashboard/${userOrgId}`, request.nextUrl));
    }

    return intlMiddleware(request);
}

export const config = {
    // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
    matcher: ['/((?!api|_next|_next/image|.*\\..*|favicon.ico).*)']
};



