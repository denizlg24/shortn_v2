import {
  keyPattern,
  reportLink,
  reportReasons,
  type ReportReason,
} from "@shortn/core";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { redis } from "@/server/redis";
import { visitorIpHash } from "@/server/visitor";

const isReason = (value: unknown): value is ReportReason =>
  typeof value === "string" &&
  (reportReasons as readonly string[]).includes(value);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  if (!keyPattern.test(key)) return new Response(null, { status: 404 });
  const form = await request.formData();
  const reason = form.get("reason");
  const details = form.get("details");
  const locale = form.get("locale");
  const prefix =
    typeof locale === "string" && /^(en|pt|es)$/.test(locale)
      ? `/${locale}`
      : "/en";
  const back = (state: string) =>
    new Response(null, {
      status: 303,
      headers: {
        location: `${prefix}/safety/${encodeURIComponent(key)}?report=${state}`,
      },
    });
  if (!isReason(reason)) return back("invalid");
  const { cache } = await redis();
  const result = await reportLink(
    { db: await db(), counters: cache, cache, linkDomain: env().LINK_DOMAIN },
    {
      key,
      reason,
      details: typeof details === "string" ? details : undefined,
      ipHash: await visitorIpHash(),
    },
  );
  return back(result.ok ? "sent" : result.error);
}
