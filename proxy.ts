import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import createMiddleware from "next-intl/middleware";
import { getSessionCookie } from "better-auth/cookies";
import { cookies, headers } from "next/headers";
import { auth } from "./lib/auth";

const intlMiddleware = createMiddleware(routing);

const PUBLIC_PATHS = [
  "api",
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "b",
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
    //LEGACY QR CODE SUPPORT
    if (segments.length === 2 && segments[0] === "qr") {
      const slug = segments[1];
      return NextResponse.rewrite(
        new URL(`/api/get-long-url/${slug}`, request.nextUrl),
      );
    }
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

  const isLogout = request.nextUrl.pathname == `/${locale}/dashboard/logout`;
  if (isLogout) {
    await auth.api.signOut({
      headers: await headers(),
    });

    const cookieStore = await cookies();

    for (const cookie of cookieStore.getAll()) {
      if (cookie.name.startsWith("shortn_auth_")) {
        cookieStore.delete(cookie.name);
      }
    }
    const response = NextResponse.redirect(
      new URL(`/${locale}/login`, request.nextUrl),
    );
    return response;
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
  const isAuthenticate = request.nextUrl.pathname.startsWith(
    `/${locale}/authenticate`,
  );
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

  if (!isDashboard && !isUrlNotFound && !isAuthenticate && isLoggedIn) {
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
