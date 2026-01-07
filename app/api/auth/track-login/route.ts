import { loginAttempt } from "@/app/actions/userActions";
import { NextRequest, NextResponse } from "next/server";
import { protectRoute, createRateLimitIdentifier } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const rateLimitId = createRateLimitIdentifier("track_login", req);
    const { error, auth } = await protectRoute(req, {
      requireAuth: true,
      rateLimit: {
        identifier: rateLimitId,
        preset: "api",
      },
    });

    if (error) return error;

    const body = await req.json();

    if (body.sub !== auth.user?.sub) {
      return NextResponse.json(
        { error: "Cannot track login for another user" },
        { status: 403 },
      );
    }

    const result = await loginAttempt({
      ...body,
      sub: auth.user!.sub,
    });
    if (result.success) {
      return NextResponse.json(result);
    }
    console.log(result);
    return NextResponse.json({ error: result.message }, { status: 500 });
  } catch (err) {
    console.log(err);
    return NextResponse.json(
      { error: "Failed to track login" },
      { status: 500 },
    );
  }
}
