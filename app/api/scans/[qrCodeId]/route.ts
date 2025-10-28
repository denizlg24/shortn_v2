import { getUser } from "@/app/actions/userActions";
import { getScans } from "@/utils/fetching-functions";
import { endOfDay, startOfDay } from "date-fns";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ qrCodeId: string }> },
) {
  const { qrCodeId } = await params;
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const session = await getUser();
  const user = session?.user;
  if (!user) {
    return NextResponse.json({ success: false, scans: [] }, { status: 403 });
  }
  if (user.plan.subscription != "pro" && user.plan.subscription != "plus") {
    return NextResponse.json({ success: false, scans: [] }, { status: 401 });
  }
  try {
    const startDate =
      start && start != "undefined" ? startOfDay(new Date(start)) : undefined;
    const endDate =
      end && end != "undefined" ? endOfDay(new Date(end)) : undefined;
    const scans = await getScans(qrCodeId, startDate, endDate);
    return NextResponse.json(
      { success: true, scans: scans ?? [] },
      { status: 200 },
    );
  } catch (error) {
    console.log(error);
    return NextResponse.json({ success: false, scans: [] }, { status: 500 });
  }
}
