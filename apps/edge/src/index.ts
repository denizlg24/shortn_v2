import { parseRedirectPath } from "@shortn/core/routing";

export interface Env {
  REDIRECT_ORIGIN: string;
  CANARY_PERCENT: string;
  EDGE_AUTH_SECRET?: string;
  // P4 column (14): unset keeps these paths on legacy, which is the rollback.
  WEB_ORIGIN?: string;
  DASHBOARD_HANDOFF?: string;
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

// Public link pages that apps/web owns from P4: password prompt and safety
// interstitial (the redirect sends visitors to exactly these paths).
const webPaths = [
  /^\/authenticate\/[^/]+\/?$/,
  /^\/(?:en|pt|es)\/safety\/[^/]+(?:\/report)?\/?$/,
];
export const isWebPath = (pathname: string) =>
  webPaths.some((pattern) => pattern.test(pathname));

const dashboardPath = /^\/(?:en|pt|es)\/dashboard(?:\/|$)/;

export function toWebOrigin(
  request: Request,
  origin: string,
  body: ArrayBuffer | null,
): Request {
  const source = new URL(request.url);
  const target = new URL(origin);
  target.pathname = source.pathname;
  target.search = source.search;
  const headers = new Headers(request.headers);
  headers.set("x-forwarded-host", source.host);
  headers.delete("host");
  return new Request(target.toString(), {
    method: request.method,
    headers,
    body,
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
  web: Fetch = upstream,
) {
  return async (request: Request, env: Env): Promise<Response> => {
    const method = request.method.toUpperCase();
    const url = new URL(request.url);
    // Legacy mints a one-time token there and sends the user on to app.
    if (env.DASHBOARD_HANDOFF === "1" && dashboardPath.test(url.pathname))
      return Response.redirect(
        new URL(
          `/api/handoff?from=${encodeURIComponent(url.pathname)}`,
          url,
        ).toString(),
        302,
      );
    if (env.WEB_ORIGIN && isWebPath(url.pathname)) {
      const body =
        method === "GET" || method === "HEAD"
          ? null
          : await request.arrayBuffer();
      try {
        const response = await web(toWebOrigin(request, env.WEB_ORIGIN, body));
        if (response.status < 500) return response;
      } catch {
        /* Fall through to legacy, which still serves these pages. */
      }
      return legacy(body === null ? request : new Request(request, { body }));
    }
    const path = parseRedirectPath(url.pathname);
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
