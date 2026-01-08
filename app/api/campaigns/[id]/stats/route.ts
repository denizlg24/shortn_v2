import { NextRequest, NextResponse } from "next/server";
import { protectRoute, createRateLimitIdentifier } from "@/lib/rate-limit";
import { getUserPlan } from "@/app/actions/polarActions";
import { getCampaignStats } from "@/app/actions/linkActions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { error, auth } = await protectRoute(req, {
    requireAuth: true,
    rateLimit: {
      identifier: createRateLimitIdentifier("campaigns:stats", req, {
        includeParam: id,
      }),
      preset: "api",
    },
  });

  if (error) return error;

  const user = auth.user;
  if (!user) {
    return NextResponse.json(
      { success: false, message: "unauthorized" },
      { status: 403 },
    );
  }

  const { plan } = await getUserPlan();
  if (plan !== "pro" && plan !== "plus") {
    return NextResponse.json(
      { success: false, message: "pro-required" },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(req.url);
  const startDateStr = searchParams.get("startDate");
  const endDateStr = searchParams.get("endDate");

  const startDate = startDateStr ? new Date(startDateStr) : undefined;
  const endDate = endDateStr ? new Date(endDateStr) : undefined;

  try {
    const result = await getCampaignStats({
      campaignId: id,
      startDate,
      endDate,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.message === "campaign-not-found" ? 404 : 400 },
      );
    }

    return NextResponse.json(
      { success: true, stats: result.stats },
      { status: 200 },
    );
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { success: false, message: "server-error" },
      { status: 500 },
    );
  }
}
