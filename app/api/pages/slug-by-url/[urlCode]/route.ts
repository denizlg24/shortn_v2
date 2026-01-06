import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { BioPage } from "@/models/link-in-bio/BioPage";
import UrlV3 from "@/models/url/UrlV3";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ urlCode: string }> },
) {
  // Check auth FIRST to prevent information disclosure
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  const user = session?.user;
  if (!user) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const { urlCode } = await params;
  await connectDB();

  // Include user ownership in query to prevent enumeration
  const url = await UrlV3.findOne({ urlCode, sub: user.sub });
  if (!url) {
    return NextResponse.json(
      { success: false, slug: undefined },
      { status: 404 },
    );
  }

  const page = await BioPage.findOne({
    links: { $elemMatch: { link: url._id } },
    userId: user.sub,
  });

  if (!page) {
    return NextResponse.json(
      { success: true, slug: undefined },
      { status: 200 },
    );
  }

  return NextResponse.json(
    { success: true, slug: page.slug, avatar: page.avatarUrl },
    { status: 200 },
  );
}
