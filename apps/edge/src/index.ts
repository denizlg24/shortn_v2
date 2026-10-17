import { parseRedirectPath } from "@shortn/core/routing";
import { bioHandleFromHost } from "@shortn/core/bio-hosts";

export interface Env {
  REDIRECT_ORIGIN: string;
  CANARY_PERCENT: string;
  EDGE_AUTH_SECRET?: string;
  // P4 column (14): unset keeps these paths on legacy, which is the rollback.
  WEB_ORIGIN?: string;
  DASHBOARD_HANDOFF?: string;
  BIO_DELIVERY_ENABLED?: string;
  BIO_SUBDOMAINS?: string;
  BIO_LEGACY_REDIRECTS?: string;
  BIO_INTERNAL_SECRET?: string;
  PUBLIC_HOST?: string;
  API_PUBLIC_HOST?: string;
  API_EDGE_AUTH_SECRET?: string;
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
  "content-type",
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
  headers.set("x-forwarded-host", source.host);
  headers.set("x-shortn-forwarded-host", source.host);
  return new Request(target.toString(), {
    method: request.method,
    headers,
    ...(request.method !== "GET" && request.method !== "HEAD"
      ? { body: request.body }
      : {}),
    redirect: "manual",
  });
}

// Public link pages that apps/web owns from P4: password prompt and safety
// interstitial (the redirect sends visitors to exactly these paths).
const webPaths = [
  /^\/auth\/mcp\/(?:workspace|consent)\/?$/,
  /^\/\.well-known\/oauth-authorization-server\/api\/auth\/?$/,
  /^\/docs(?:\.md|\/.*)?\/?$/,
  /^\/(?:llms(?:-full)?\.txt|openapi\.json|robots\.txt)\/?$/,
  /^\/authenticate\/[^/]+(?:\/verify)?\/?$/,
  /^\/(?:en|pt|es)\/safety\/[^/]+(?:\/report|\/token)?\/?$/,
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
  headers.delete("x-shortn-bio-handle");
  headers.delete("x-shortn-bio-domain");
  headers.delete("x-bio-auth");
  headers.delete("x-shortn-public-bio");
  headers.set("x-forwarded-host", source.host);
  headers.set("x-shortn-forwarded-host", source.host);
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
    if (env.API_PUBLIC_HOST && url.hostname === env.API_PUBLIC_HOST) {
      if (!env.API_EDGE_AUTH_SECRET)
        return new Response("API edge authentication unavailable", {
          status: 503,
        });
      const headers = new Headers(request.headers);
      headers.set("x-shortn-api-auth", env.API_EDGE_AUTH_SECRET);
      headers.set(
        "x-shortn-client-ip",
        request.headers.get("cf-connecting-ip") ?? "",
      );
      return legacy(new Request(request, { headers }));
    }
    const publicHost = env.PUBLIC_HOST ?? "shortn.at";
    const handle =
      env.BIO_SUBDOMAINS === "1"
        ? bioHandleFromHost(url.hostname, publicHost)
        : null;
    const customHost =
      url.hostname !== publicHost && !url.hostname.endsWith(`.${publicHost}`);
    if (
      env.BIO_DELIVERY_ENABLED === "1" &&
      env.WEB_ORIGIN &&
      env.BIO_INTERNAL_SECRET
    ) {
      if (handle && (method === "GET" || method === "HEAD")) {
        if (url.pathname === "/") {
          const targetUrl = new URL(`/_bio/${handle}`, env.WEB_ORIGIN);
          const target = new Request(
            targetUrl.toString(),
            toWebOrigin(request, env.WEB_ORIGIN, null),
          );
          for (const name of [
            "rsc",
            "next-router-state-tree",
            "next-router-prefetch",
            "next-url",
          ])
            target.headers.delete(name);
          target.headers.set("x-shortn-bio-handle", handle);
          target.headers.set("x-bio-auth", env.BIO_INTERNAL_SECRET);
          target.headers.delete("cookie");
          const response = await web(target);
          const headers = new Headers(response.headers);
          headers.delete("set-cookie");
          // Scheduling is evaluated at origin, so the HTML TTL is deliberately short.
          if (response.ok)
            headers.set(
              "cache-control",
              "public, s-maxage=60, stale-while-revalidate=86400",
            );
          return new Response(response.body, {
            status: response.status,
            headers,
          });
        }
        if (
          url.pathname.startsWith("/_next/") ||
          /^\/_bio\/[^/]+\/(?:opengraph-image|qr\/[^/]+)$/.test(url.pathname)
        )
          return web(toWebOrigin(request, env.WEB_ORIGIN, null));
        return new Response("Not found", { status: 404 });
      }
      if (customHost) return upstream(toRedirectOrigin(request, env));
      if (
        /^\/b\/[^/]+\/?$/.test(url.pathname) &&
        (method === "GET" || method === "HEAD")
      )
        return upstream(toRedirectOrigin(request, env));
      if (url.pathname.startsWith("/_bio/"))
        return web(toWebOrigin(request, env.WEB_ORIGIN, null));
    }
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
  (request) =>
    new URL(request.url).pathname === "/" && request.method === "GET"
      ? fetch(request, {
          cf: {
            cacheEverything: true,
            cacheTtlByStatus: { "200-299": 60, "300-599": 0 },
            cacheKey: `https://${request.headers.get("x-forwarded-host")}/`,
          },
        } as RequestInit)
      : fetch(request),
  (request) => fetch(request),
  3000,
  (request) =>
    request.headers.has("x-shortn-bio-handle") && !request.headers.has("rsc")
      ? fetch(request, {
          cf: {
            cacheEverything: true,
            cacheTtlByStatus: { "200-299": 60, "300-599": 0 },
            cacheKey: `https://${request.headers.get("x-forwarded-host")}/`,
          },
        } as RequestInit)
      : fetch(request),
);

export default {
  fetch: (request: Request, env: Env) => handler(request, env),
};
