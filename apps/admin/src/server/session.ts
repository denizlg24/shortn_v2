import "server-only";
import {
  resolveAdminSession,
  type AdminContext,
  type ResolvedAdminSession,
} from "@shortn/core";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { env } from "./env";
import { consumeAdminRate } from "./rate-limit";
import { cacheRedis } from "./redis";
import { cookieNames, requestInfo } from "./request";

/** The verified staff session for this request, or null. Role and ban are
 * re-read from the user doc each time (23 §1.2). */
export const currentAdmin = cache(
  async (): Promise<ResolvedAdminSession | null> => {
    const token = (await cookies()).get(cookieNames().session)?.value;
    if (!token) return null;
    const { userAgent } = await requestInfo();
    return resolveAdminSession(await db(), token, { userAgent });
  },
);

export const requireAdmin = cache(async () => {
  const current = await currentAdmin();
  if (!current) redirect("/login");
  if (!(await consumeAdminRate(current.admin.id, "read")))
    throw new Error("Too many requests. Wait a minute and try again.");
  return current;
});

export async function contextFor(
  current: ResolvedAdminSession,
): Promise<AdminContext> {
  return {
    db: await db(),
    cache: cacheRedis(),
    admin: {
      id: current.admin.id,
      email: current.admin.email,
      role: current.admin.role,
    },
    session: { id: current.session.id, elevatedAt: current.session.elevatedAt },
    request: await requestInfo(),
    linkDomain: env().LINK_DOMAIN,
    now: () => new Date(),
  };
}

/** Context for read pages. */
export async function adminContext() {
  return contextFor(await requireAdmin());
}
