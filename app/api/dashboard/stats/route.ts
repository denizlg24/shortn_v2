import { getDashboardStats } from "@/app/actions/dashboardActions";
import { NextRequest, NextResponse } from "next/server";
import { protectRoute, createRateLimitIdentifier } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const { error, auth } = await protectRoute(request, {
    requireAuth: true,
  });

  if (error) return error;

  const rateLimitId = createRateLimitIdentifier("dashboard_stats", request, {
    includeUserId: auth.user!.id,
  });

  const { error: rateLimitError } = await protectRoute(request, {
    rateLimit: {
      identifier: rateLimitId,
      preset: "fetch",
    },
  });

  if (rateLimitError) return rateLimitError;

  const result = await getDashboardStats();

  if (!result.success) {
    return NextResponse.json(
      { success: false, message: result.message },
      { status: result.message === "no-user" ? 401 : 500 },
    );
  }

  return NextResponse.json({ success: true, data: result.data });
}
