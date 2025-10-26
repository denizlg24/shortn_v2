import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import env from "@/utils/env";

export async function POST(req: Request) {
  try {
    const { plan, type } = await req.json();

    const token = jwt.sign({ plan, type }, env.AUTH_SECRET, {
      expiresIn: "10m",
    });

    return NextResponse.json({ token });
  } catch (error) {
    console.error("JWT generation failed:", error);
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 },
    );
  }
}
