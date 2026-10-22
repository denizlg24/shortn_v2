import "server-only";
import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { headers } from "next/headers";
import { env } from "./env";

/** Secure cookies need https; local http dev falls back to plain names. */
export function cookieNames() {
  const secure = env().ADMIN_ORIGIN.startsWith("https:");
  const prefix = secure ? "__Host-" : "";
  return {
    secure,
    session: `${prefix}shortn_admin`,
    nonce: `${prefix}shortn_admin_nonce`,
    next: `${prefix}shortn_admin_next`,
  };
}

export const cookieBase = () => ({
  httpOnly: true,
  secure: cookieNames().secure,
  sameSite: "strict" as const,
  path: "/",
});

/** Forge's Caddy appends the client to X-Forwarded-For; used for audit only. */
export async function requestInfo() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded && isIP(forwarded) ? forwarded : undefined;
  return {
    ip,
    userAgent: h.get("user-agent") ?? undefined,
    requestId: h.get("x-request-id") ?? randomUUID(),
  };
}

/** Only same-origin relative paths survive a login or step-up round trip. */
export function safeNext(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.includes("\\") || [...value].some((c) => c.charCodeAt(0) < 32))
    return "/";
  return value.slice(0, 512);
}
