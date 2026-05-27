"use server";

import { createHash } from "crypto";
import { headers } from "next/headers";
import { connectDB } from "@/lib/mongodb";
import UrlV3 from "@/models/url/UrlV3";
import LinkReport, {
  REPORT_REASONS,
  type ReportReason,
} from "@/models/url/LinkReport";
import RateLimit from "@/models/RateLimit";
import env from "@/utils/env";

const AUTO_DISABLE_REPORT_THRESHOLD = 3;
const MAX_REPORTS_PER_IP_PER_DAY = 5;

interface ReportInput {
  urlCode: string;
  reason: ReportReason;
  details?: string;
}

function hashIp(ip: string): string {
  return createHash("sha256")
    .update(`${ip}:${env.INTERNAL_API_SECRET}`)
    .digest("hex");
}

async function getClientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

export async function reportLink({ urlCode, reason, details }: ReportInput) {
  try {
    if (!urlCode || !REPORT_REASONS.includes(reason)) {
      return { success: false, message: "invalid-input" };
    }

    await connectDB();

    const ip = await getClientIp();
    const ipHash = hashIp(ip);

    const identifier = `report:${ipHash}`;
    const rl = await RateLimit.findOne({ identifier });
    if (rl && rl.attempts >= MAX_REPORTS_PER_IP_PER_DAY) {
      return { success: false, message: "rate-limited" };
    }

    const urlDoc = await UrlV3.findOne({ urlCode });
    if (!urlDoc) {
      return { success: false, message: "not-found" };
    }

    await LinkReport.create({
      urlCode,
      reason,
      details: details?.slice(0, 1000),
      reporterIpHash: ipHash,
    });

    await RateLimit.findOneAndUpdate(
      { identifier },
      { $inc: { attempts: 1 }, $set: { lastAttempt: new Date() } },
      { upsert: true },
    );

    urlDoc.reportCount += 1;
    if (
      urlDoc.reportCount >= AUTO_DISABLE_REPORT_THRESHOLD &&
      !urlDoc.disabled
    ) {
      urlDoc.disabled = true;
      urlDoc.flagged = true;
      urlDoc.safetyStatus = "blocked";
      urlDoc.disabledReason = "auto:report-threshold";
    }
    await urlDoc.save();

    return { success: true };
  } catch (error) {
    console.error("[reportLink] error:", error);
    return { success: false, message: "server-error" };
  }
}
