import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { Session } from "@/models/auth/Session";
import { connectDB } from "@/lib/mongodb";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const identifier = `revoke-session:${ip}`;
    const rateLimit = await checkRateLimit(identifier, {
      maxAttempts: 10,
      windowMs: 15 * 60 * 1000,
      blockDurationMs: 30 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 },
      );
    }

    const allSessions = await auth.api.listSessions({
      headers: await headers(),
    });

    const sessionToRevoke = allSessions.find((s) => s.id === sessionId);

    if (!sessionToRevoke) {
      return NextResponse.json(
        { error: "Session not found or does not belong to you" },
        { status: 404 },
      );
    }

    await connectDB();
    await Session.findByIdAndDelete(sessionId);

    return NextResponse.json(
      { success: true, message: "Session revoked successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error revoking session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
