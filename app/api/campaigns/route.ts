import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { Campaigns } from "@/models/url/Campaigns";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  const session = await auth();
  const user = session?.user;

  if (!user) {
    return NextResponse.json(
      { success: false, campaigns: [] },
      { status: 403 },
    );
  }
  const sub = user?.sub;
  try {
    await connectDB();
    if (query) {
      const campaigns = await Campaigns.find({
        sub,
        $text: { $search: query },
      })
        .limit(10)
        .lean();

      const lean = campaigns.map((campaign) => ({
        ...campaign,
        _id: campaign._id.toString(),
      }));
      return NextResponse.json(
        { success: true, campaigns: lean },
        { status: 200 },
      );
    }

    const campaigns = await Campaigns.find({
      sub,
    })
      .limit(10)
      .lean();
    const lean = campaigns.map((campaign) => ({
      ...campaign,
      _id: campaign._id.toString(),
    }));
    return NextResponse.json(
      { success: true, campaigns: lean },
      { status: 200 },
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return NextResponse.json(
      { success: false, campaigns: [] },
      { status: 500 },
    );
  }
}
