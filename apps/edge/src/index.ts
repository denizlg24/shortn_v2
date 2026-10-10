import { parseRedirectPath } from "@shortn/core/routing";

export interface Env {
  REDIRECT_ORIGIN: string;
  CANARY_PERCENT: string;
  EDGE_AUTH_SECRET?: string;
}

type Fetch = (request: Request) => Promise<Response>;

const forwardedHeaders = [
  "cf-connecting-ip",
  "cf-connecting-ipv6",
  "cf-ipcountry",
  "cf-ipcity",
  "cf-ipcontinent",
  "cf-region",
  "cf-region-code",
  "cf-timezone",
  "cf-iplatitude",
  "cf-iplongitude",
  "cf-postal-code",
  "user-agent",
  "accept-language",
  "referer",
  "cookie",
];

// Stable per request, so a retry of the same ray takes the same side.
export function bucket(rayId: string): number {
  let hash = 0;
  for (let index = 0; index < rayId.length; index++)
    hash = (hash * 31 + rayId.charCodeAt(index)) >>> 0;
  return hash % 100;
}

export function toRedirectOrigin(request: Request, env: Env): Request {
  const source = new URL(request.url);
  const target = new URL(env.REDIRECT_ORIGIN);
  target.pathname = source.pathname;
  target.search = source.search;
  const headers = new Headers();
  for (const name of forwardedHeaders) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const ray = request.headers.get("cf-ray");
  if (ray) headers.set("x-request-id", ray);
  if (env.EDGE_AUTH_SECRET) headers.set("x-edge-auth", env.EDGE_AUTH_SECRET);
  return new Request(target.toString(), {
    method: request.method,
    headers,
    redirect: "manual",
  });
}

// Path routing that Caddy (host matchers only) can't do (13 §Edge routing).
// The zone origin is legacy until P4 and resolves every key, so it is both the
// default and the fallback when apps/redirect fails or is slow.
export function createHandler(
  upstream: Fetch,
  legacy: Fetch,
  timeoutMs = 3000,
) {
  return async (request: Request, env: Env): Promise<Response> => {
    const method = request.method.toUpperCase();
    const path = parseRedirectPath(new URL(request.url).pathname);
    const percent = Number(env.CANARY_PERCENT);
    const ray = request.headers.get("cf-ray") ?? crypto.randomUUID();
    if (
      !path ||
      (method !== "GET" && method !== "HEAD") ||
      !(Number.isFinite(percent) && bucket(ray) < percent)
    )
      return legacy(request);
    try {
      const response = await Promise.race([
        upstream(toRedirectOrigin(request, env)),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("redirect origin timeout")),
            timeoutMs,
          ),
        ),
      ]);
      if (response.status < 500) return response;
    } catch {
      /* Fall through to legacy. */
    }
    return legacy(request);
  };
}

const handler = createHandler(
  (request) => fetch(request),
  (request) => fetch(request),
);

export default {
  fetch: (request: Request, env: Env) => handler(request, env),
};
