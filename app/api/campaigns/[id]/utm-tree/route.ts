import { NextRequest, NextResponse } from "next/server";
import { protectRoute, createRateLimitIdentifier } from "@/lib/rate-limit";
import { getUserPlan } from "@/app/actions/polarActions";
import { getUtmTreeData } from "@/app/actions/linkActions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { error, auth } = await protectRoute(req, {
    requireAuth: true,
    rateLimit: {
      identifier: createRateLimitIdentifier("campaigns:utm-tree", req, {
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
  if (plan !== "pro") {
    return NextResponse.json(
      { success: false, message: "pro-required" },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source") || undefined;
  const medium = searchParams.get("medium") || undefined;
  const term = searchParams.get("term") || undefined;

  try {
    const result = await getUtmTreeData({
      campaignId: id,
      path: { source, medium, term },
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.message === "campaign-not-found" ? 404 : 400 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        level: result.level,
        data: result.data,
        breadcrumb: result.breadcrumb,
      },
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
