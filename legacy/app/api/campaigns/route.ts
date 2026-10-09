import { connectDB } from "@/lib/mongodb";
import { Campaigns } from "@/models/url/Campaigns";
import { NextRequest, NextResponse } from "next/server";
import { protectRoute, createRateLimitIdentifier } from "@/lib/rate-limit";
import { getUserPlan } from "@/app/actions/polarActions";

export async function GET(req: NextRequest) {
  const { error, auth } = await protectRoute(req, {
    requireAuth: true,
    rateLimit: {
      identifier: createRateLimitIdentifier("campaigns:list", req, {
        includeUserId: undefined,
      }),
      preset: "api",
    },
  });

  if (error) return error;

  const user = auth.user;
  if (!user) {
    return NextResponse.json(
      { success: false, campaigns: [] },
      { status: 403 },
    );
  }

  const { plan } = await getUserPlan();
  if (plan !== "pro" && plan !== "plus") {
    return NextResponse.json(
      { success: false, message: "pro-required", campaigns: [] },
      { status: 403 },
    );
  }

  const sub = user?.sub;
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");

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
