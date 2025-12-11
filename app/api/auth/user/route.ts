import { getServerSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await getServerSession();
    const user = session?.user;
    return NextResponse.json({ success: true, user });
  } catch (err) {
    console.log(err);
    return NextResponse.json(
      { error: "Failed to get user", success: false },
      { status: 500 },
    );
  }
}
