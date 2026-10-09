import { loginAttempt } from "@/app/actions/userActions";
import { NextRequest, NextResponse } from "next/server";
import { getRequestGeo, getRequestIp } from "@/lib/request-metadata";
import { protectRoute, createRateLimitIdentifier } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const rateLimitId = createRateLimitIdentifier("track_activity", req);
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
        { error: "Cannot track activity for another user" },
        { status: 403 },
      );
    }

    const loginRecord = {
      sub: auth.user!.sub,
      ip: getRequestIp(req),
      location: getRequestGeo(req),
      success: body.success as boolean,
      type: body.type as string,
    };
    const result = await loginAttempt(loginRecord);
    if (result.success) {
      return NextResponse.json(result);
    }
    console.log(result);
    return NextResponse.json({ error: result.message }, { status: 500 });
  } catch (err) {
    console.log(err);
    return NextResponse.json(
      { error: "Failed to track activity" },
      { status: 500 },
    );
  }
}
