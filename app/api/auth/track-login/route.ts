import { loginAttempt } from "@/app/actions/userActions";
import { geolocation, ipAddress } from "@vercel/functions";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const loginData = { ...body, ip: ipAddress(req), geo: geolocation(req) };
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
