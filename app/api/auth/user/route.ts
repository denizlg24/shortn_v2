import { getUser } from "@/app/actions/userActions";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { success, user } = await getUser();
    return NextResponse.json({ success, user });
  } catch (err) {
    console.log(err);
    return NextResponse.json(
      { error: "Failed to get user", success: false },
      { status: 500 },
    );
  }
}
