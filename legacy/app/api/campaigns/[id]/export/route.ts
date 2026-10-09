import { NextRequest, NextResponse } from "next/server";
import { protectRoute, createRateLimitIdentifier } from "@/lib/rate-limit";
import { getUserPlan } from "@/app/actions/polarActions";
import { exportCampaignData } from "@/app/actions/linkActions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { error, auth } = await protectRoute(req, {
    requireAuth: true,
    rateLimit: {
      identifier: createRateLimitIdentifier("campaigns:export", req, {
        includeParam: id,
      }),
      preset: "sensitive",
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
  if (plan !== "pro") {
    return NextResponse.json(
      { success: false, message: "pro-required" },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(req.url);
  const startDateStr = searchParams.get("startDate");
  const endDateStr = searchParams.get("endDate");
  const sourcesStr = searchParams.get("sources");
  const mediumsStr = searchParams.get("mediums");
  const termsStr = searchParams.get("terms");
  const contentsStr = searchParams.get("contents");

  const startDate = startDateStr ? new Date(startDateStr) : undefined;
  const endDate = endDateStr ? new Date(endDateStr) : undefined;
  const sources = sourcesStr
    ? sourcesStr.split(",").filter(Boolean)
    : undefined;
  const mediums = mediumsStr
    ? mediumsStr.split(",").filter(Boolean)
    : undefined;
  const terms = termsStr ? termsStr.split(",").filter(Boolean) : undefined;
  const contents = contentsStr
    ? contentsStr.split(",").filter(Boolean)
    : undefined;

  try {
    const result = await exportCampaignData({
      campaignId: id,
      filters: {
        startDate,
        endDate,
        sources,
        mediums,
        terms,
        contents,
      },
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.message === "campaign-not-found" ? 404 : 400 },
      );
    }

    return NextResponse.json(
      { success: true, url: result.url },
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
