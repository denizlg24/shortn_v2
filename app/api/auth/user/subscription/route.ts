import { getUserPlan } from "@/app/actions/stripeActions";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { success, plan, lastPaid } = await getUserPlan();
    if (!success) {
      return NextResponse.json({ success: false, plan: "free" });
    }
    return NextResponse.json({ success: true, plan, lastPaid });
  } catch (err) {
    console.log(err);
    return NextResponse.json(
      { error: "Failed to get plan", success: false },
      { status: 500 },
    );
  }
}
