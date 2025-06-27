import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const locale = request.cookies.get('NEXT_LOCALE')?.value || 'en';

    const isDashboardRoot = pathname === `/${locale}/dashboard`;
    const isDashboard = pathname.startsWith(`/${locale}/dashboard`);
    const isLogin = pathname.startsWith(`/${locale}/login`);

    const authToken = "";
    const orgId = "";

    if (!isDashboard && authToken && orgId) {
        return NextResponse.redirect(new URL(`/${locale}/dashboard/${orgId}`, request.url));
    }

    if (isLogin && authToken && orgId) {
        return NextResponse.redirect(new URL(`/${locale}/dashboard/${orgId}`, request.url));
    }

    if (isDashboard && !authToken) {
        return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
    }

    if (isDashboardRoot && authToken && orgId) {
        return NextResponse.redirect(new URL(`/${locale}/dashboard/${orgId}`, request.url));
    }

    return intlMiddleware(request);
}

export const config = {
    matcher: ['/((?!api|trpc|_next|_vercel|.*\\..*).*)']
};

