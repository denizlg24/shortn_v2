import { createSubscriptionSession } from "@/app/actions/stripeActions";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await createSubscriptionSession(body);
    return NextResponse.json(result);
  } catch (err) {
    console.log(err);
    return NextResponse.json(
      { success: false, message: "Failed to create checkout session." },
      { status: 500 },
    );
  }
}
