import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getServerSession } from "@/lib/session";
import env from "@/utils/env";

export const dynamic = "force-dynamic";

interface HandoffToken {
  _id: string;
  userId: string;
  impersonatedBy?: string;
  expiresAt: Date;
  createdAt: Date;
}

// Legacy dashboard path → new dashboard section (16 §4.8).
const sections: [RegExp, string][] = [
  [/^\/[a-z]{2}\/dashboard\/links/, "links"],
  [/^\/[a-z]{2}\/dashboard\/qr-codes/, "qr"],
  [/^\/[a-z]{2}\/dashboard\/pages/, "bio"],
  [/^\/[a-z]{2}\/dashboard\/campaigns/, "campaigns"],
  [/^\/[a-z]{2}\/dashboard\/(settings\/plan|subscription)/, "settings/billing"],
  [/^\/[a-z]{2}\/dashboard\/settings/, "settings"],
];

/**
 * Carries a signed-in legacy user to the new dashboard without a second
 * login: stores a one-time token (hashed, 60 s) that app.shortn.at trades
 * for its own session at /api/auth/handoff.
 */
export async function GET(request: NextRequest) {
  const appUrl = env.NEW_APP_URL;
  if (!appUrl)
    return NextResponse.redirect(new URL("/en/dashboard", request.url));
  const from = request.nextUrl.searchParams.get("from") ?? "";
  const section = sections.find(([pattern]) => pattern.test(from))?.[1];
  const next = section ? `/?to=${encodeURIComponent(section)}` : "/";
  const session = await getServerSession();
  if (!session) {
    return NextResponse.redirect(
      `${appUrl}/login?next=${encodeURIComponent(next)}`,
    );
  }
  const token = randomBytes(32).toString("base64url");
  const db = (await connectDB()).connection.db;
  if (!db) throw new Error("Mongo connection has no database handle");
  const impersonatedBy = session.session.impersonatedBy;
  await db.collection<HandoffToken>("handoff_tokens").insertOne({
    _id: createHash("sha256").update(token).digest("hex"),
    userId: session.user.id,
    ...(impersonatedBy ? { impersonatedBy } : {}),
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
  });
  return NextResponse.redirect(
    `${appUrl}/api/auth/handoff?t=${token}&next=${encodeURIComponent(next)}`,
  );
}
