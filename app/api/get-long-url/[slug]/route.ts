import { connectDB } from "@/lib/mongodb";
import UrlV3 from "@/models/url/UrlV3";
import { geolocation, ipAddress } from "@vercel/functions";
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import env from "@/utils/env";

const INTERNAL_SECRET = env.INTERNAL_API_SECRET;

const SECRET_KEY = new TextEncoder().encode(env.AUTH_SECRET);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const url = new URL(request.url);
  try {
    await connectDB();
    const { slug } = await params;
    const urlDoc = await UrlV3.findOne({ urlCode: slug });
    if (!urlDoc)
      return NextResponse.redirect(`${url.origin}/en/url-not-found`, 302);

    if (urlDoc.passwordProtected) {
      const accessCookie = request.cookies.get(`link_access_${slug}`);

      if (!accessCookie) {
        return NextResponse.redirect(`${url.origin}/authenticate/${slug}`, 302);
      }

      try {
        await jwtVerify(accessCookie.value, SECRET_KEY);
      } catch (error) {
        console.error("Invalid or expired access token:", error);
        return NextResponse.redirect(`${url.origin}/authenticate/${slug}`, 302);
      }
    }

    const clickData = {
      slug,
      ip: ipAddress(request) || "",
      userAgent: request.headers.get("user-agent") || "",
      referrer: request.headers.get("referer") || "",
      language: request.headers.get("accept-language")?.split(",")[0] || "",
      geo: geolocation(request),
      timezone: request.headers.get("x-vercel-ip-timezone"),
      query: Object.fromEntries(url.searchParams),
    };

    fetch(`${url.origin}/api/track-click`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": INTERNAL_SECRET,
      },
      body: JSON.stringify(clickData),
    }).catch(() => null);

    return NextResponse.redirect(urlDoc.longUrl, 302);
  } catch (error) {
    console.log("Error in get-long-url route:", error);
    return NextResponse.redirect(`${url.origin}/en/url-not-found`, 302);
  }
}
