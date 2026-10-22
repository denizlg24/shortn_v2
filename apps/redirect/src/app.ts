import {
  isLinkPreviewBot,
  accessCookieName,
  rotationCookieName,
  boundedQuery,
  decide,
  localeFrom,
  parseRedirectPath,
  requestClickFields,
  activeDomain,
  resolveLegacyBio,
} from "@shortn/core";
import { bioCanonical } from "@shortn/core/bio-hosts";
import { ObjectId, type Db } from "mongodb";
import type { ClickMessage, Decision, TokenSecrets } from "@shortn/core";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { isbot } from "isbot";
import type { Enqueue } from "./clicks";
import { metrics } from "./metrics";
import { deletedPage } from "./deleted-page";
import { deepLinkPage } from "./deep-link-page";
import { socialPreviewPage } from "./social-preview";
import type { Resolver } from "./resolver";
import type { SuspendedWorkspaces } from "./suspensions";

export interface AppOptions {
  resolver: Pick<Resolver, "resolve">;
  suspended?: SuspendedWorkspaces;
  clickCounter?: {
    read: (id: string, base: number) => Promise<number>;
    untracked: (id: string, base: number) => Promise<void>;
  };
  enqueue: Enqueue;
  health: () => Promise<boolean>;
  secrets: TokenSecrets;
  origin: string;
  linkDomain: string;
  edgeAuthSecret?: string | undefined;
  log?: (message: string, error?: unknown) => void;
  db?: Db;
  bio?: {
    enabled: boolean;
    subdomains: boolean;
    redirects: boolean;
    webOrigin?: string | undefined;
    secret?: string | undefined;
  };
}

// Matches the headers legacy's next.config.ts adds to every response.
const securityHeaders = {
  "Cache-Control": "private, max-age=0",
  Vary: "User-Agent",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

function respond(decision: Decision, key: string): Response {
  if (decision.type === "not_found" || decision.type === "unavailable")
    return new Response(
      deletedPage(
        decision.locale,
        decision.type === "unavailable" ? decision.reason : undefined,
      ),
      {
        status: decision.status,
        headers: {
          ...securityHeaders,
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy":
            "default-src 'none'; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; frame-ancestors 'none'",
        },
      },
    );
  if (decision.socialPreview)
    return new Response(
      socialPreviewPage(
        decision.socialPreview.og,
        decision.socialPreview.canonical,
        decision.location,
      ),
      {
        status: 200,
        headers: {
          ...securityHeaders,
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy":
            "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
        },
      },
    );
  if (decision.deepLink) {
    const page = deepLinkPage(
      decision.location,
      decision.deepLink.fallback,
      decision.deepLink.locale,
      decision.deepLink.store,
    );
    return new Response(page.html, {
      status: 200,
      headers: {
        ...securityHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": page.csp,
      },
    });
  }
  const headers = new Headers({
    ...securityHeaders,
    Location: decision.location,
  });
  if (decision.rotationCookie) {
    const cookie = decision.rotationCookie;
    headers.append(
      "Set-Cookie",
      `${cookie.name}=${cookie.value}; Path=/; Max-Age=${cookie.maxAge}; HttpOnly; Secure; SameSite=Lax`,
    );
  }
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
  // Custom domains of suspended workspaces stop serving from the same
  // in-process set as their links; no per-request workspace read.
  const domainOptions = {
    isSuspended: (workspaceId: unknown) =>
      workspaceId instanceof ObjectId &&
      Boolean(options.suspended?.has(workspaceId.toHexString())),
  };

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
  app.use("*", async (c, next) => {
    const host =
      options.edgeAuthSecret &&
      c.req.header("x-edge-auth") === options.edgeAuthSecret
        ? (c.req.header("x-shortn-forwarded-host") ??
          c.req.header("x-forwarded-host"))
        : undefined;
    if (
      host &&
      host !== options.linkDomain &&
      options.db &&
      options.bio?.enabled &&
      options.bio.webOrigin &&
      options.bio.secret &&
      (/^\/authenticate\//.test(c.req.path) ||
        /^\/(?:en|pt|es)\/safety\//.test(c.req.path))
    ) {
      if (!(await activeDomain(options.db, host, domainOptions)))
        return c.text("Not found", 404);
      const target = new URL(c.req.path, options.bio.webOrigin);
      target.search = new URL(c.req.url).search;
      const headers = new Headers(c.req.raw.headers);
      headers.delete("host");
      headers.delete("origin");
      headers.set("x-bio-auth", options.bio.secret);
      headers.set("x-forwarded-host", host);
      headers.set("x-shortn-forwarded-host", host);
      return fetch(target, {
        method: c.req.method,
        headers,
        ...(c.req.method !== "GET" && c.req.method !== "HEAD"
          ? { body: await c.req.arrayBuffer() }
          : {}),
        redirect: "manual",
      });
    }
    await next();
  });

  app.get("*", async (c) => {
    const url = new URL(c.req.url);
    const forwarded =
      options.edgeAuthSecret &&
      c.req.header("x-edge-auth") === options.edgeAuthSecret
        ? (c.req.header("x-shortn-forwarded-host") ??
          c.req.header("x-forwarded-host"))
        : undefined;
    const domain = forwarded?.toLowerCase() ?? options.linkDomain;
    if (!/^[a-z0-9.-]+(?::\d+)?$/.test(domain))
      return c.text("Invalid host", 400);
    const custom =
      domain !== options.linkDomain && domain !== new URL(options.origin).host;
    const domainRecord =
      custom && options.db
        ? await activeDomain(options.db, domain, domainOptions)
        : null;
    if (custom && !domainRecord) return c.text("Not found", 404);
    async function proxyBio(path: string, hostname?: string) {
      if (!options.bio?.webOrigin || !options.bio.secret)
        return c.text("Bio delivery unavailable", 503);
      const target = new URL(path, options.bio.webOrigin);
      const headers = new Headers({ "x-bio-auth": options.bio.secret });
      if (hostname) headers.set("x-shortn-bio-domain", hostname);
      const response = await fetch(target, {
        headers,
        method: c.req.method,
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
      });
      const result = new Headers(response.headers);
      result.delete("set-cookie");
      if (response.ok)
        result.set(
          "cache-control",
          "public, s-maxage=60, stale-while-revalidate=86400",
        );
      return new Response(response.body, {
        status: response.status,
        headers: result,
      });
    }
    if (options.bio?.enabled && options.db) {
      const legacyBio = /^\/b\/([^/]+)\/?$/.exec(c.req.path);
      if (legacyBio && !custom) {
        let slug: string;
        try {
          slug = decodeURIComponent(legacyBio[1]!);
        } catch {
          return c.text("Not found", 404);
        }
        const page = await resolveLegacyBio(options.db, slug);
        if (!page) return c.text("Not found", 404);
        if (!options.bio.redirects)
          return proxyBio(`/_bio/${encodeURIComponent(String(page.handle))}`);
        const target = new URL(
          bioCanonical(
            String(page.handle),
            options.origin,
            options.bio.subdomains,
          ),
        );
        target.search = url.search;
        return new Response(null, {
          status: 301,
          headers: {
            Location: target.href,
            "Cache-Control": "public, max-age=60",
          },
        });
      }
      if (domainRecord && c.req.path === "/") {
        if (["bio", "both"].includes(String(domainRecord.kind)))
          return proxyBio(`/_bio/by-domain/${domain}`, domain);
        return c.redirect(
          String(domainRecord.rootRedirect ?? options.origin),
          302,
        );
      }
      if (
        domainRecord &&
        (c.req.path.startsWith("/_next/") ||
          c.req.path.startsWith("/_web/") ||
          /^\/_bio\/[^/]+\/(?:opengraph-image|qr\/[^/]+)$/.test(c.req.path))
      )
        return proxyBio(c.req.path + url.search);
    }
    const path = parseRedirectPath(c.req.path);
    if (!path) return c.text("Not found", 404);
    metrics.inc("requests_total");
    try {
      if (domainRecord?.kind === "bio") return c.text("Not found", 404);
      const resolved = await options.resolver.resolve(domain, path.key);
      // A suspended workspace's links go to the safety page; the link
      // documents and their cache entries stay untouched.
      const link =
        resolved.kind === "link" &&
        resolved.ws &&
        options.suspended?.has(resolved.ws)
          ? { ...resolved, status: "blocked" as const }
          : resolved;
      if (!link && domainRecord?.notFoundRedirect)
        return c.redirect(String(domainRecord.notFoundRedirect), 302);
      const userAgent = (c.req.header("user-agent") ?? "").slice(0, 2000);
      const previewBot = isLinkPreviewBot(userAgent);
      const bot = previewBot || isbot(userAgent);
      const decision = await decide({
        link,
        key: path.key,
        origin: custom ? `https://${domain}` : options.origin,
        tokenKey: custom ? `${domain}:${path.key}` : path.key,
        locale: localeFrom(getCookie(c, "NEXT_LOCALE")),
        confirmationToken: url.searchParams.get("token") ?? undefined,
        accessCookie: getCookie(c, accessCookieName(path.key)),
        secrets: options.secrets,
        query: url.searchParams,
        clickCount:
          link.kind === "link" && options.clickCounter
            ? () => options.clickCounter!.read(link.id, link.hits ?? 0)
            : undefined,
        country: c.req.header("cf-ipcountry"),
        userAgent,
        bot,
        previewBot,
        rotationCookie:
          link.kind === "link"
            ? getCookie(c, rotationCookieName(link.id))
            : undefined,
      });
      if (decision.type === "redirect" && decision.untrackedCount && !bot) {
        if (!options.clickCounter)
          throw new Error("Missing untracked click counter");
        await options.clickCounter.untracked(
          decision.untrackedCount.linkId,
          decision.untrackedCount.base,
        );
      }
      const attributionCookie = `shortn_bio_${path.key}`;
      const suppliedRef = url.searchParams.get("ref"),
        suppliedBlock = url.searchParams.get("block");
      let attribution =
        suppliedRef && /^bio:[a-f\d]{24}$/i.test(suppliedRef)
          ? { ref: suppliedRef, block: suppliedBlock?.slice(0, 100) ?? "" }
          : null;
      if (!attribution) {
        try {
          const stored = JSON.parse(
            decodeURIComponent(getCookie(c, attributionCookie) ?? "null"),
          );
          if (
            stored &&
            /^bio:[a-f\d]{24}$/i.test(stored.ref) &&
            typeof stored.block === "string"
          )
            attribution = stored;
        } catch {
          /* Ignore malformed visitor attribution. */
        }
      }
      const trackedQuery = new URLSearchParams(url.searchParams);
      if (link.kind === "link" && link.rules && decision.track) {
        const effective = new URL(decision.location).searchParams;
        for (const field of [
          "source",
          "medium",
          "campaign",
          "term",
          "content",
        ]) {
          const name = `utm_${field}`;
          if (effective.has(name)) trackedQuery.set(name, effective.get(name)!);
        }
      }

      if (attribution) {
        trackedQuery.set("ref", attribution.ref);
        if (attribution.block) trackedQuery.set("block", attribution.block);
      }
      metrics.inc(`decision_${decision.track ? "destination" : "gate"}_total`);
      if (decision.track) {
        const fields = requestClickFields(
          c.req.raw.headers,
          Boolean(
            options.edgeAuthSecret &&
            c.req.header("x-edge-auth") === options.edgeAuthSecret,
          ),
        );
        const message: ClickMessage = {
          v: 1,
          ts: Date.now(),
          linkId: decision.track.linkId,
          ...(decision.track.counterBase !== undefined
            ? { counterBase: decision.track.counterBase }
            : {}),
          ...(decision.track.branch ? { branch: decision.track.branch } : {}),
          ...(decision.track.qr
            ? {
                qrId: decision.track.qr.id,
                qrPublicId: decision.track.qr.publicId,
              }
            : {}),
          domain,
          key: path.key,
          bot,
          query: boundedQuery(trackedQuery),
          ...fields,
        };
        options.enqueue(message);
      }
      const response = respond(decision, path.key);
      if (attribution)
        response.headers.append(
          "Set-Cookie",
          `${attributionCookie}=${decision.track ? "" : encodeURIComponent(JSON.stringify(attribution))}; Path=/; Max-Age=${decision.track ? 0 : 600}; HttpOnly; Secure; SameSite=Lax`,
        );
      return response;
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
