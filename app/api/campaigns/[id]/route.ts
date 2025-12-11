import { getServerSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import { Campaigns } from "@/models/url/Campaigns";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getServerSession();
  const user = session?.user;

  if (!user) {
    return NextResponse.json(
      { success: false, campaign: undefined },
      { status: 403 },
    );
  }
  const sub = user?.sub;
  try {
    await connectDB();
    if (id) {
      const campaign = await Campaigns.findOne({
        sub,
        _id: id,
      }).lean();

      if (!campaign) {
        return NextResponse.json(
          { success: true, campaign: undefined },
          { status: 404 },
        );
      }
      const lean = { ...campaign, _id: campaign._id.toString() };
      return NextResponse.json(
        { success: true, campaign: lean },
        { status: 200 },
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return NextResponse.json(
      { success: false, campaign: undefined },
      { status: 500 },
    );
  }
}
