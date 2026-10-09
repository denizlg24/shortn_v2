import { connectDB } from "@/lib/mongodb";
import { Campaigns } from "@/models/url/Campaigns";
import { NextRequest, NextResponse } from "next/server";
import { protectRoute, createRateLimitIdentifier } from "@/lib/rate-limit";
import { getUserPlan } from "@/app/actions/polarActions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { error, auth } = await protectRoute(req, {
    requireAuth: true,
    rateLimit: {
      identifier: createRateLimitIdentifier("campaigns:get", req, {
        includeParam: id,
      }),
      preset: "api",
    },
  });

  if (error) return error;

  const user = auth.user;
  if (!user) {
    return NextResponse.json(
      { success: false, campaign: undefined },
      { status: 403 },
    );
  }

  const { plan } = await getUserPlan();
  if (plan !== "pro" && plan !== "plus") {
    return NextResponse.json(
      { success: false, message: "pro-required", campaign: undefined },
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
