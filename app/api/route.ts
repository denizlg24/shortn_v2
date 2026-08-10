import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      status: "healthy",
      service: "shortn",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
