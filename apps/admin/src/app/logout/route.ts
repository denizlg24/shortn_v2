import { recordAdminEvent, revokeAdminSession } from "@shortn/core";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { cookieNames } from "@/server/request";
import { contextFor, currentAdmin } from "@/server/session";

export const dynamic = "force-dynamic";

/** Route handlers see the bind host behind Forge's proxy, so the Origin is
 * compared with ADMIN_ORIGIN, never with request.url (23 §1.6). */
export async function POST(request: NextRequest) {
  const origin = new URL(env().ADMIN_ORIGIN).origin;
  if (request.headers.get("origin") !== origin)
    return new NextResponse("Forbidden", { status: 403 });
  const current = await currentAdmin();
  if (current) {
    await recordAdminEvent(await contextFor(current), {
      action: "admin.session.revoke",
      targetType: "session",
      targetId: current.session.id.slice(0, 16),
    });
    await revokeAdminSession(await db(), current.session.id);
  }
  (await cookies()).delete(cookieNames().session);
  return NextResponse.redirect(new URL("/signed-out", origin), 303);
}
