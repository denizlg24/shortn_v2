import { NextRequest, NextResponse } from "next/server";
import { protectRoute, createRateLimitIdentifier } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const { error, auth } = await protectRoute(request, {
      requireAuth: true,
    });

    if (error) return error;

    const rateLimitId = createRateLimitIdentifier("auth_user", request, {
      includeUserId: auth.user!.id,
    });

    const { error: rateLimitError } = await protectRoute(request, {
      rateLimit: {
        identifier: rateLimitId,
        preset: "api",
      },
    });

    if (rateLimitError) return rateLimitError;

    return NextResponse.json({ success: true, user: auth.user });
  } catch (err) {
    console.log(err);
    return NextResponse.json(
      { error: "Failed to get user", success: false },
      { status: 500 },
    );
  }
}
