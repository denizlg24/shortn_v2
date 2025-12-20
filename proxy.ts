import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import createMiddleware from "next-intl/middleware";
import { getSessionCookie } from "better-auth/cookies";

const intlMiddleware = createMiddleware(routing);

const PUBLIC_PATHS = [
  "api",
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "b",
  "dashboard",
  "login",
  "register",
  "url-not-found",
];
const LOCALES = routing.locales;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const path = pathname.replace(/^\/+/, "");
  const segments = path.split("/");
  const locale = request.cookies.get("NEXT_LOCALE")?.value || "en";
  const first = segments[0] !== "" ? segments[0] : locale;
  const isLocale = LOCALES.includes(first as "en" | "es" | "pt");
  if (!isLocale) {
    if (segments.length === 1 && !PUBLIC_PATHS.includes(first)) {
      const slug = first;

      return NextResponse.rewrite(
        new URL(`/api/get-long-url/${slug}`, request.nextUrl),
      );
    } else {
      return NextResponse.redirect(
        new URL(
          `/${locale}${pathname}?${request.nextUrl.searchParams.toString()}`,
          request.nextUrl,
        ),
      );
    }
  }

  const sessionCookie = getSessionCookie(request, {
    cookiePrefix: "shortn_auth_",
  });
  const isLoggedIn = !!sessionCookie;

  const isDashboard = request.nextUrl.pathname.startsWith(
    `/${locale}/dashboard`,
  );
  const isLogin = request.nextUrl.pathname.startsWith(`/${locale}/login`);
  const isRegister = request.nextUrl.pathname.startsWith(`/${locale}/register`);
  const isUrlNotFound = request.nextUrl.pathname === `/${locale}/url-not-found`;

  if (isDashboard && !isLoggedIn) {
    const response = NextResponse.redirect(
      new URL(`/${locale}/login`, request.nextUrl),
    );
    return response;
  }

  if ((isLogin || isRegister) && isLoggedIn) {
    const response = NextResponse.redirect(
      new URL(`/${locale}/dashboard`, request.nextUrl),
    );
    return response;
  }

  if (!isDashboard && !isUrlNotFound && isLoggedIn) {
    const response = NextResponse.redirect(
      new URL(`/${locale}/dashboard`, request.nextUrl),
    );
    return response;
  }

  const response = intlMiddleware(request);
  return response;
}

export const config = {
  // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
  matcher: ["/((?!api|_next|_next/image|.*\\..*|favicon.ico).*)"],
};
