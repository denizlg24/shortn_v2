import { connectDB } from "@/lib/mongodb";
import UrlV3 from "@/models/url/UrlV3";
import { geolocation, ipAddress } from "@vercel/functions";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const url = new URL(request.url);
  try {
    await connectDB();
    const { slug } = await params;
    const urlDoc = await UrlV3.findOne({ urlCode: slug });
    if (!urlDoc)
      return NextResponse.redirect(`${url.origin}/en/url-not-found`, 302);

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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(clickData),
    }).catch(() => null);

    return NextResponse.redirect(urlDoc.longUrl, 302);
  } catch (error) {
    console.log("Error in get-long-url route:", error);
    return NextResponse.redirect(`${url.origin}/en/url-not-found`, 302);
  }
}
