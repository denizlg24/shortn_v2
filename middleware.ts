import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { geolocation, ipAddress } from "@vercel/functions";
import createMiddleware from "next-intl/middleware";
import { getToken } from "next-auth/jwt";
import env from "./utils/env";

const intlMiddleware = createMiddleware(routing);

const PUBLIC_PATHS = [
  "api",
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "b",
];
const LOCALES = routing.locales;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const path = pathname.replace(/^\/+/, "");
  const segments = path.split("/");
  if (PUBLIC_PATHS.some((prefix) => path.startsWith(prefix))) {
    return NextResponse.next();
  }
  const first =
    segments[0] ?? (request.cookies.get("NEXT_LOCALE")?.value || "en");
  const isLocale = LOCALES.includes(first as "en" | "es" | "pt");
  if (!isLocale) {
    const slug = first;

    return NextResponse.rewrite(
      new URL(`/api/get-long-url/${slug}`, request.nextUrl),
    );
  }
  const user = await getToken({
    req: request,
    secret: env.AUTH_SECRET,
    secureCookie: !!process.env.VERCEL_URL,
  });

  const isLoggedIn = !!user;
  if (!isLoggedIn) {
    request.cookies.delete("login_tracked");
  }
  const loginTracked = request.cookies.get("login_tracked") || !isLoggedIn;
  if (isLoggedIn && !loginTracked) {
    fetch(`${request.nextUrl.origin}/api/auth/track-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sub: user.sub,
        ip: ipAddress(request),
        location: geolocation(request),
        success: true,
        type: "login",
      }),
    }).catch(() => null);
  }
  const locale = request.cookies.get("NEXT_LOCALE")?.value || "en";
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
    if (!loginTracked) {
      response.cookies.set("login_tracked", "true", {
        path: "/",
        httpOnly: true,
        secure: !!process.env.VERCEL_URL,
      });
    }
    return response;
  }

  if ((isLogin || isRegister) && isLoggedIn) {
    const response = NextResponse.redirect(
      new URL(`/${locale}/dashboard`, request.nextUrl),
    );
    if (!loginTracked) {
      response.cookies.set("login_tracked", "true", {
        path: "/",
        httpOnly: true,
        secure: !!process.env.VERCEL_URL,
      });
    }
    return response;
  }

  if (!isDashboard && !isUrlNotFound && isLoggedIn) {
    const response = NextResponse.redirect(
      new URL(`/${locale}/dashboard`, request.nextUrl),
    );
    if (!loginTracked) {
      response.cookies.set("login_tracked", "true", {
        path: "/",
        httpOnly: true,
        secure: !!process.env.VERCEL_URL,
      });
      return response;
    }
    return response;
  }

  const response = intlMiddleware(request);
  if (!loginTracked) {
    response.cookies.set("login_tracked", "true", {
      path: "/",
      httpOnly: true,
      secure: !!process.env.VERCEL_URL,
    });
  }
  return response;
}

export const config = {
  // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
  matcher: ["/((?!api|_next|_next/image|.*\\..*|favicon.ico).*)"],
};
