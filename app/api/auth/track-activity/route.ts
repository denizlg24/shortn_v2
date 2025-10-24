import { loginAttempt } from "@/app/actions/userActions";
import { geolocation, ipAddress } from "@vercel/functions";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const loginRecord = {
      sub: body.sub as string,
      ip: ipAddress(req),
      location: geolocation(req),
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
