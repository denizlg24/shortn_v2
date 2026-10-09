import { connectDB } from "@/lib/mongodb";
import UrlV3 from "@/models/url/UrlV3";
import { scanAndPersist } from "@/lib/safety";
import env from "@/utils/env";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESCAN_BATCH_SIZE = 50;
const RESCAN_STALE_DAYS = 7;
const REPORT_DISABLE_THRESHOLD = 3;

function isAuthorized(request: NextRequest): boolean {
  if (!env.CRON_SECRET) return false;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${env.CRON_SECRET}`) return true;
  const token = new URL(request.url).searchParams.get("token");
  return token === env.CRON_SECRET;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await connectDB();

  const staleBefore = new Date(
    Date.now() - RESCAN_STALE_DAYS * 24 * 60 * 60 * 1000,
  );

  // 1. Re-scan pending and stale links.
  const toScan = await UrlV3.find({
    disabled: { $ne: true },
    $or: [
      { safetyStatus: "pending" },
      { lastScannedAt: null },
      { lastScannedAt: { $lt: staleBefore } },
    ],
  })
    .sort({ lastScannedAt: 1, _id: 1 })
    .select("urlCode")
    .limit(RESCAN_BATCH_SIZE)
    .lean();

  let scanned = 0;
  for (const link of toScan) {
    try {
      await scanAndPersist(link.urlCode);
      scanned += 1;
    } catch (error) {
      console.error("[cron/moderate] scan failed for", link.urlCode, error);
    }
  }

  // 2. Safety-net sweep: disable links over the report threshold that slipped
  //    through (e.g. concurrent reports).
  const sweep = await UrlV3.updateMany(
    {
      reportCount: { $gte: REPORT_DISABLE_THRESHOLD },
      disabled: { $ne: true },
    },
    {
      $set: {
        disabled: true,
        flagged: true,
        safetyStatus: "blocked",
        disabledReason: "auto:report-threshold",
      },
    },
  );

  return NextResponse.json({
    success: true,
    scanned,
    reportSwept: sweep.modifiedCount ?? 0,
    timestamp: new Date().toISOString(),
  });
}
