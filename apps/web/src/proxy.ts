import { NextResponse, type NextRequest } from "next/server";
import { bioHandleFromHost } from "@shortn/core/bio-hosts";
import { workspaceExportReturnPath } from "@/lib/workspace-export";
import { localeCookie, resolveLocale, routedLocaleHeader } from "@/i18n/locale";
import {
  marketingPathHeader,
  routeMarketing,
  sharedCookieDomain,
} from "@/lib/marketing/routes";

export function proxy(request: NextRequest) {
  // The marketing rewrite passes through here again; only that second pass
  // carries the routed locale. Direct visits to the internal tree are 404.
  if (/^\/_marketing(?:\/|$)/.test(request.nextUrl.pathname))
    return request.headers.has(routedLocaleHeader)
      ? NextResponse.next()
      : new NextResponse("Not found", { status: 404 });
  const headers = new Headers(request.headers);
  headers.delete("x-shortn-workspace-export-path");
  const exportPath = workspaceExportReturnPath(request.nextUrl.pathname);
  if (exportPath) headers.set("x-shortn-workspace-export-path", exportPath);
  headers.delete("x-shortn-public-bio");
  headers.delete(routedLocaleHeader);
  headers.delete(marketingPathHeader);
  const internal = request.nextUrl.pathname.startsWith("/_bio/");
  const handle = request.headers.get("x-shortn-bio-handle");
  const domain = request.headers.get("x-shortn-bio-domain");
  const trusted =
    process.env.BIO_INTERNAL_SECRET &&
    request.headers.get("x-bio-auth") === process.env.BIO_INTERNAL_SECRET;
  if ((handle || domain) && !trusted)
    return new NextResponse("Forbidden", { status: 403 });
  if (trusted && (handle || domain)) {
    if (
      handle &&
      bioHandleFromHost(
        `${handle}.${process.env.LINK_DOMAIN ?? "shortn.at"}`,
        process.env.LINK_DOMAIN ?? "shortn.at",
      ) !== handle
    )
      return new NextResponse("Not found", { status: 404 });
    if (domain && !/^[a-z0-9.-]{1,253}$/.test(domain))
      return new NextResponse("Not found", { status: 404 });
    headers.set("x-shortn-public-bio", "1");
    headers.delete("cookie");
    const url = request.nextUrl.clone();
    url.pathname = handle ? `/_bio/${handle}` : `/_bio/by-domain/${domain}`;
    return NextResponse.rewrite(url, { request: { headers } });
  }
  if (internal) {
    headers.set("x-shortn-public-bio", "1");
    headers.delete("cookie");
  }
  return (
    marketing(request, headers) ?? NextResponse.next({ request: { headers } })
  );
}

function marketing(request: NextRequest, headers: Headers) {
  const { pathname, search, searchParams } = request.nextUrl;
  if (pathname === "/") {
    const publicOrigin = process.env.PUBLIC_ORIGIN;
    const host =
      request.headers.get("x-shortn-forwarded-host") ??
      request.headers.get("host");
    if (!publicOrigin || host !== new URL(publicOrigin).host) return null;
    const locale = resolveLocale(
      request.cookies.get(localeCookie)?.value,
      request.headers.get("accept-language"),
    );
    const response = NextResponse.redirect(
      new URL(`/${locale}${search}`, publicOrigin),
      302,
    );
    response.headers.set("Vary", "Cookie, Accept-Language");
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  const route = routeMarketing(
    pathname,
    searchParams,
    process.env.BETTER_AUTH_URL ?? request.nextUrl.origin,
  );
  if (!route) return null;
  if (route.kind === "rewrite") {
    headers.set(routedLocaleHeader, route.locale);
    headers.set(
      marketingPathHeader,
      route.pathname.slice(`/_marketing/${route.locale}`.length),
    );
    const url = request.nextUrl.clone();
    url.pathname = route.pathname;
    return NextResponse.rewrite(url, { request: { headers } });
  }
  const target = /^https?:\/\//.test(route.location)
    ? new URL(route.location)
    : new URL(route.location, publicBase(request));
  if (route.keepQuery)
    for (const [name, value] of searchParams)
      target.searchParams.append(name, value);
  if (route.hash) target.hash = route.hash;
  const response = NextResponse.redirect(target, route.status);
  if (route.locale)
    response.cookies.set(localeCookie, route.locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      ...(sharedCookieDomain(process.env.PUBLIC_ORIGIN)
        ? { domain: sharedCookieDomain(process.env.PUBLIC_ORIGIN) }
        : {}),
    });
  return response;
}

// Redirects on the root host must name that host, not the web origin the edge
// Worker forwarded to.
function publicBase(request: NextRequest) {
  const forwarded = request.headers.get("x-shortn-forwarded-host");
  return forwarded && process.env.PUBLIC_ORIGIN
    ? process.env.PUBLIC_ORIGIN
    : request.nextUrl.origin;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
