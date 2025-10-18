import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { geolocation, ipAddress } from "@vercel/functions";
import createMiddleware from "next-intl/middleware";
import { getToken } from "next-auth/jwt";
import env from "./utils/env";

const locales = routing.locales as readonly string[];

function isLocale(value: string): value is (typeof locales)[number] {
  return locales.includes(value);
}

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const slugCandidate = pathname.split("/")[1];
  const user = await getToken({
    req: request,
    secret: env.AUTH_SECRET,
    secureCookie: !!process.env.VERCEL_URL,
  });
  if (
    !isLocale(slugCandidate) &&
    slugCandidate !== "" &&
    slugCandidate !== "url-not-found"
  ) {
    const clickData = {
      slug: slugCandidate,
      ip: ipAddress(request) || "",
      userAgent: request.headers.get("user-agent") || "",
      referrer: request.headers.get("referer") || "",
      language: request.headers.get("accept-language")?.split(",")[0] || "",
      geo: geolocation(request),
      timezone: request.headers.get("x-vercel-ip-timezone"),
      query: Object.fromEntries(request.nextUrl.searchParams.entries()),
    };
    try {
      fetch(`${request.nextUrl.origin}/api/track-click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clickData),
      }).catch(() => null);

      const res = await fetch(
        `${request.nextUrl.origin}/api/get-long-url/${slugCandidate}`,
      );
      const { longUrl } = await res.json();

      if (longUrl) {
        return NextResponse.redirect(longUrl, 301);
      }
      return NextResponse.redirect(
        new URL(
          `/${request.cookies.get("NEXT_LOCALE")?.value || "en"}/url-not-found`,
          request.nextUrl,
        ),
      );
    } catch (error) {
      console.log(error);
      return NextResponse.redirect(
        new URL(
          `/${request.cookies.get("NEXT_LOCALE")?.value || "en"}/url-not-found`,
          request.nextUrl,
        ),
      );
    }
  }

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
