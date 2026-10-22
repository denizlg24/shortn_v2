import {
  consumeAdminElevation,
  createAdminSession,
  loadStaff,
  markAdminSessionElevated,
  recordAdminEvent,
} from "@shortn/core";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { env } from "@/server/env";
import {
  cookieBase,
  cookieNames,
  requestInfo,
  safeNext,
} from "@/server/request";
import { contextFor, currentAdmin } from "@/server/session";

export const dynamic = "force-dynamic";

const failed = (reason: string) =>
  NextResponse.redirect(
    new URL(`/auth/error?reason=${reason}`, env().ADMIN_ORIGIN),
  );

/** 23 §1.1 step 4: the token is single-use, 60 s, and bound to the nonce
 * cookie this browser got in step 1. */
export async function GET(request: NextRequest) {
  const names = cookieNames();
  const jar = await cookies();
  const nonce = jar.get(names.nonce)?.value;
  const next = safeNext(jar.get(names.next)?.value);
  jar.delete(names.nonce);
  jar.delete(names.next);
  const token = request.nextUrl.searchParams.get("t");
  if (!token || !nonce || token.length > 128) return failed("expired");
  const database = await db();
  const elevation = await consumeAdminElevation(database, token, nonce);
  if (!elevation) return failed("expired");
  const staff = await loadStaff(database, elevation.userId);
  if (!staff) return failed("not_staff");
  const destination = new URL(next, env().ADMIN_ORIGIN);

  if (elevation.purpose === "stepup") {
    const current = await currentAdmin();
    if (
      !current ||
      current.admin.id !== staff.id ||
      !(await markAdminSessionElevated(database, current.session.id, staff.id))
    )
      return failed("session");
    return NextResponse.redirect(destination);
  }

  const info = await requestInfo();
  const created = await createAdminSession(database, {
    userId: staff.id,
    ip: info.ip,
    userAgent: info.userAgent,
  });
  const ctx = await contextFor({
    admin: staff,
    session: { id: created.id, expiresAt: created.expiresAt },
  });
  await recordAdminEvent(ctx, {
    action: "admin.session.create",
    targetType: "session",
    targetId: created.id.slice(0, 16),
  });
  jar.set(names.session, created.token, {
    ...cookieBase(),
    expires: created.expiresAt,
  });
  return NextResponse.redirect(destination);
}
