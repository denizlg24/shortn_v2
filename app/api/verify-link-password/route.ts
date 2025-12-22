import { connectDB } from "@/lib/mongodb";
import UrlV3 from "@/models/url/UrlV3";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import env from "@/utils/env";
import { passwordRateLimiter } from "@/lib/rate-limit";

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

    // Get IP address for rate limiting
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";

    // Create a unique identifier combining IP and urlCode
    // This prevents an attacker from rate limiting legitimate users
    const rateLimitKey = `${ip}:${urlCode}`;

    // Check rate limit
    const rateLimitResult = passwordRateLimiter.check(rateLimitKey);

    if (!rateLimitResult.success) {
      const resetTime = new Date(rateLimitResult.resetTime);
      const minutesUntilReset = Math.ceil(
        (rateLimitResult.resetTime - Date.now()) / 60000,
      );

      return NextResponse.json(
        {
          success: false,
          message: `Too many failed attempts. Please try again in ${minutesUntilReset} minute${minutesUntilReset > 1 ? "s" : ""}.`,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "5",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": resetTime.toISOString(),
            "Retry-After": String(Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)),
          },
        },
      );
    }

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

    const isPasswordValid = await bcrypt.compare(password, urlDoc.passwordHash);

    if (!isPasswordValid) {
      return NextResponse.json(
        {
          success: false,
          message: "Incorrect password",
        },
        {
          status: 401,
          headers: {
            "X-RateLimit-Remaining": String(rateLimitResult.remaining - 1),
          },
        },
      );
    }

    // Password is correct - reset rate limit for this identifier
    passwordRateLimiter.reset(rateLimitKey);

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
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
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
