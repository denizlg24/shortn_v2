import { recordClickFromMiddleware } from "@/app/actions/linkActions";
import { NextRequest, NextResponse } from "next/server";
import env from "@/utils/env";

const INTERNAL_SECRET = env.INTERNAL_API_SECRET;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("x-internal-secret");
    if (authHeader !== INTERNAL_SECRET) {
      return NextResponse.json(
        { message: "You are not allowed to generate fake traffic." },
        { status: 403 },
      );
    }

    const body = await req.json();

    if (!body.slug || typeof body.slug !== "string") {
      return NextResponse.json(
        { error: "Invalid request: missing slug" },
        { status: 400 },
      );
    }

    const result = await recordClickFromMiddleware(body);
    return NextResponse.json(result);
  } catch (err) {
    console.log(err);
    return NextResponse.json(
      { error: "Failed to track click" },
      { status: 500 },
    );
  }
}
