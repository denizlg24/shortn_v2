import { getDashboardStats } from "@/app/actions/dashboardActions";
import { NextResponse } from "next/server";

export async function GET() {
  const result = await getDashboardStats();

  if (!result.success) {
    return NextResponse.json(
      { success: false, message: result.message },
      { status: result.message === "no-user" ? 401 : 500 },
    );
  }

  return NextResponse.json({ success: true, data: result.data });
}
