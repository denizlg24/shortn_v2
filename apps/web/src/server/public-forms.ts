import "server-only";
import { hashIp } from "@shortn/core";
import { visitorIp } from "./client-ip";
import { env } from "./env";
import { redis } from "./redis";

// Anonymous marketing endpoints (demo shortener, contact form). They are
// plain route handlers, not server actions: behind the edge Worker and Caddy
// the forwarded host is not reliable enough for Next's action origin check.

export function trustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const e = env();
  return [e.PUBLIC_ORIGIN, e.BETTER_AUTH_URL].some(
    (allowed) => new URL(allowed).origin === origin,
  );
}

export function requestIp(request: Request) {
  const e = env();
  return visitorIp(request.headers, {
    edge: e.WEB_EDGE_AUTH_SECRET,
    bio: e.BIO_INTERNAL_SECRET,
  });
}

export const ipHash = (ip: string) => hashIp(ip, env().IP_HASH_SECRET);

export type TurnstileOutcome = "ok" | "failed" | "unavailable";

export async function verifyTurnstile(
  token: unknown,
  ip: string,
  secret: string,
  fetcher: typeof fetch = fetch,
): Promise<TurnstileOutcome> {
  if (typeof token !== "string" || !token || token.length > 2048)
    return "failed";
  try {
    const response = await fetcher(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: new URLSearchParams({ secret, response: token, remoteip: ip }),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) return "unavailable";
    const body: unknown = await response.json();
    return body &&
      typeof body === "object" &&
      "success" in body &&
      body.success === true
      ? "ok"
      : "failed";
  } catch {
    return "unavailable";
  }
}

/** Fixed-window counters in the evictable cache; an outage fails closed. */
export async function withinLimits(
  limits: readonly { key: string; max: number; seconds: number }[],
) {
  const { cache } = await redis();
  for (const limit of limits) {
    const count = await cache.incr(limit.key);
    if (count === 1) await cache.expire(limit.key, limit.seconds);
    if (count > limit.max) return false;
  }
  return true;
}

export const utcDay = (now = new Date()) => now.toISOString().slice(0, 10);

export function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
