import { getUser } from "@/app/actions/userActions";
import { connectDB } from "@/lib/mongodb";
import { BioPage } from "@/models/link-in-bio/BioPage";
import UrlV3 from "@/models/url/UrlV3";
import { NextResponse } from "next/server";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ urlCode: string }> },
) {
  const { urlCode } = await params;
  const url = await UrlV3.findOne({ urlCode });
  if (!url) {
    return NextResponse.json(
      { success: false, slug: undefined },
      { status: 400 },
    );
  }
  const session = await getUser();
  const user = session?.user;
  if (!user) {
    return NextResponse.json(
      { success: false, slug: undefined },
      { status: 403 },
    );
  }
  await connectDB();

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
