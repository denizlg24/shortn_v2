import {
  accessCookieName,
  boundedQuery,
  decide,
  localeFrom,
  parseRedirectPath,
  requestClickFields,
} from "@shortn/core";
import type { ClickMessage, Decision, TokenSecrets } from "@shortn/core";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { isbot } from "isbot";
import type { Enqueue } from "./clicks";
import { metrics } from "./metrics";
import type { Resolver } from "./resolver";

export interface AppOptions {
  resolver: Pick<Resolver, "resolve">;
  enqueue: Enqueue;
  health: () => Promise<boolean>;
  secrets: TokenSecrets;
  origin: string;
  linkDomain: string;
  edgeAuthSecret?: string | undefined;
  log?: (message: string, error?: unknown) => void;
}

// Matches the headers legacy's next.config.ts adds to every response.
const securityHeaders = {
  "Cache-Control": "private, max-age=0",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

function respond(decision: Decision, key: string): Response {
  const headers = new Headers({
    ...securityHeaders,
    Location: decision.location,
  });
  if (decision.clearAccessCookie)
    headers.append(
      "Set-Cookie",
      `${accessCookieName(key)}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    );
  return new Response(null, { status: decision.status, headers });
}

export function createApp(options: AppOptions) {
  const app = new Hono();
  const log = options.log ?? console.error;

  app.get("/__health", async (c) =>
    (await options.health()) ? c.text("ok") : c.text("unhealthy", 503),
  );

  app.get("/__metrics", (c) => c.text(metrics.render()));

  app.use("*", async (c, next) => {
    if (
      options.edgeAuthSecret &&
      c.req.header("x-edge-auth") !== options.edgeAuthSecret
    )
      return c.text("Forbidden", 403);
    await next();
  });

  app.get("*", async (c) => {
    const path = parseRedirectPath(c.req.path);
    if (!path) return c.text("Not found", 404);
    metrics.inc("requests_total");
    const url = new URL(c.req.url);
    try {
      const link = await options.resolver.resolve(options.linkDomain, path.key);
      const decision = await decide({
        link,
        key: path.key,
        origin: options.origin,
        locale: localeFrom(getCookie(c, "NEXT_LOCALE")),
        confirmationToken: url.searchParams.get("token") ?? undefined,
        accessCookie: getCookie(c, accessCookieName(path.key)),
        secrets: options.secrets,
      });
      metrics.inc(`decision_${decision.track ? "destination" : "gate"}_total`);
      if (decision.track) {
        const fields = requestClickFields(c.req.raw.headers);
        const message: ClickMessage = {
          v: 1,
          ts: Date.now(),
          linkId: decision.track.linkId,
          ...(decision.track.qr
            ? {
                qrId: decision.track.qr.id,
                qrPublicId: decision.track.qr.publicId,
              }
            : {}),
          domain: options.linkDomain,
          key: path.key,
          bot: isbot(fields.ua ?? ""),
          query: boundedQuery(url.searchParams),
          ...fields,
        };
        options.enqueue(message);
      }
      return respond(decision, path.key);
    } catch (error) {
      metrics.inc("errors_total");
      log(`resolve failed for ${path.key}`, error);
      return c.text("Service temporarily unavailable", 503, {
        "Retry-After": "5",
        "Cache-Control": "no-store",
      });
    }
  });

  return app;
}
