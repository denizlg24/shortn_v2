import { NextResponse, type NextRequest } from "next/server";
import { bioHandleFromHost } from "@shortn/core/bio-hosts";

export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete("x-shortn-public-bio");
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
  return NextResponse.next({ request: { headers } });
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
