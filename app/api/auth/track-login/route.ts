import { loginAttempt } from "@/app/actions/userActions";
import { geolocation } from "@vercel/functions";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() || undefined;
    const loginData = { ...body, ip, geo: geolocation(req) };
    const result = await loginAttempt(loginData);
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
