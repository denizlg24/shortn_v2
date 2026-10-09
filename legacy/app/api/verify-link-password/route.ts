import { connectDB } from "@/lib/mongodb";
import UrlV3 from "@/models/url/UrlV3";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import env from "@/utils/env";
import {
  checkRateLimit,
  resetRateLimit,
  createRateLimitIdentifier,
  formatBlockedTime,
  RATE_LIMIT_PRESETS,
} from "@/lib/rate-limit";

const SECRET_KEY = new TextEncoder().encode(env.AUTH_SECRET);

export async function POST(request: NextRequest) {
  try {
    const { urlCode, password } = await request.json();

    if (!urlCode || !password) {
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 },
      );
    }

    const rateLimitIdentifier = createRateLimitIdentifier(
      "password_verify",
      request,
      { includeParam: urlCode },
    );

    await connectDB();

    const urlDoc = await UrlV3.findOne({ urlCode });

    if (!urlDoc) {
      return NextResponse.json(
        { success: false, message: "Link not found" },
        { status: 404 },
      );
    }

    if (!urlDoc.passwordProtected || !urlDoc.passwordHash) {
      return NextResponse.json(
        { success: false, message: "Link is not password protected" },
        { status: 400 },
      );
    }

    const rateLimitResult = await checkRateLimit(
      rateLimitIdentifier,
      RATE_LIMIT_PRESETS.auth,
    );

    if (!rateLimitResult.allowed) {
      const timeRemaining = rateLimitResult.blockedUntil
        ? formatBlockedTime(rateLimitResult.blockedUntil)
        : "some time";

      return NextResponse.json(
        {
          success: false,
          message: `Too many failed attempts. Please try again in ${timeRemaining}.`,
          blockedUntil: rateLimitResult.blockedUntil,
        },
        { status: 429 },
      );
    }

    const isPasswordValid = await bcrypt.compare(password, urlDoc.passwordHash);

    if (!isPasswordValid) {
      return NextResponse.json(
        {
          success: false,
          message: "Incorrect password",
          attemptsRemaining: rateLimitResult.attemptsRemaining,
        },
        { status: 401 },
      );
    }

    await resetRateLimit(rateLimitIdentifier);

    const token = await new SignJWT({ urlCode })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(SECRET_KEY);

    const response = NextResponse.json({
      success: true,
      message: "Password verified successfully",
    });

    response.cookies.set(`link_access_${urlCode}`, token, {
      httpOnly: true,
      secure: !!process.env.VERCEL_URL || process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 86400,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Error verifying link password:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 },
    );
  }
}
