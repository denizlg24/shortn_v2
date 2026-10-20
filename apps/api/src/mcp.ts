import { Hono } from "hono";
import { readRequestBody } from "@modelcontextprotocol/sdk/server/requestBody.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  authenticateApiKey,
  platformFeatureEnabled,
  apiScopes,
  createMcpOAuthVerifier,
  isWorkspaceSuspended,
  type ApiPrincipal,
  type OAuthPrincipal,
} from "@shortn/core";
import { loadEntitlements } from "@shortn/billing";
import type { Db } from "mongodb";
import type { Redis } from "ioredis";
import { z } from "zod";
import { createMcpTools } from "./mcp-tools";
import { apiRateLimit, rateScript } from "./rate-limit";

export interface McpDeps {
  qrExports?: {
    sign: (key: string, seconds: number, filename: string) => Promise<string>;
    waitMs?: number;
  };
  db: Db;
  cache: Redis;
  pepper: string;
  linkDomain: string;
  origin: string;
  rolloutPercent?: number;
  clientIp: (request: Request) => string | undefined;
  log: (message: string) => void;
  oauth?: {
    issuer: string;
    authenticate?: ReturnType<typeof createMcpOAuthVerifier>;
  };
}

export function createMcpApp(deps: McpDeps) {
  const app = new Hono();
  const publicUrl = new URL(deps.origin),
    origin = publicUrl.origin;
  const verifyOAuth = deps.oauth
    ? (deps.oauth.authenticate ??
      createMcpOAuthVerifier(deps.db, deps.oauth.issuer, `${origin}/mcp`))
    : undefined;
  const metadataUrl = `${origin}/.well-known/oauth-protected-resource/mcp`;
  if (deps.oauth) {
    const metadata = () =>
      Response.json(
        {
          resource: `${origin}/mcp`,
          authorization_servers: [deps.oauth!.issuer],
          scopes_supported: [...apiScopes, "offline_access"],
          bearer_methods_supported: ["header"],
          resource_name: "Shortn workspace MCP",
        },
        {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=300",
          },
        },
      );
    app.get("/.well-known/oauth-protected-resource/mcp", metadata);
    app.get("/.well-known/oauth-protected-resource", metadata);
  }
  app.all("/mcp", async (c) => {
    // Public-origin configuration, rather than forwarded headers, is authority.
    if (
      new URL(c.req.url).host !== publicUrl.host ||
      (c.req.header("Origin") && c.req.header("Origin") !== origin)
    )
      return c.json({ error: "invalid_origin" }, 403);
    // Buffer before asynchronous auth: Bun's incoming network body must remain
    // readable when the SDK later processes it. Bound actual bytes, not just
    // Content-Length, and let the SDK validate JSON/protocol/media types.
    let request = c.req.raw;
    if (request.method === "POST") {
      const body = await readRequestBody(request, 1_048_576);
      if (body.tooLarge) return c.json({ error: "body_too_large" }, 413);
      request = new Request(request, { body: body.text });
    }
    const authorization = c.req.header("Authorization");
    const bearer = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : undefined;
    const auth = bearer?.startsWith("sk_live_")
      ? await authenticateApiKey(
          deps.db,
          bearer,
          deps.pepper,
          deps.clientIp(c.req.raw),
          undefined,
          deps.cache,
        )
      : bearer && verifyOAuth
        ? await verifyOAuth(bearer)
        : null;
    if (!auth?.ok) {
      c.header(
        "WWW-Authenticate",
        deps.oauth
          ? `Bearer resource_metadata="${metadataUrl}"`
          : 'Bearer realm="shortn-mcp"',
      );
      return c.json({ error: "unauthorized" }, 401);
    }
    const principal = auth.value;
    if (
      !platformFeatureEnabled(principal.workspace, "mcp", deps.rolloutPercent)
    )
      return c.json({ error: "feature_disabled" }, 404);
    // Locked workspaces keep read tools; mutations fail inside the tool.
    if (isWorkspaceSuspended(principal.workspace))
      return c.json({ error: "workspace_suspended" }, 403);
    const entitlements = await loadEntitlements(deps.db, principal.workspace);
    const limit = apiRateLimit(entitlements);
    if (limit !== null) {
      // API-key budgets are shared with REST; switching transports cannot bypass them.
      const rate = z
        .tuple([z.number(), z.number(), z.number()])
        .parse(
          await deps.cache.eval(
            rateScript,
            1,
            `api:rate:${principal.keyId}`,
            Date.now(),
            limit,
            crypto.randomUUID(),
          ),
        );
      c.header("RateLimit-Limit", String(limit));
      c.header("RateLimit-Remaining", String(rate[1]));
      c.header("RateLimit-Reset", String(rate[2]));
      if (!rate[0]) {
        c.header("Retry-After", String(rate[2]));
        return c.json({ error: "rate_limited" }, 429);
      }
    }
    const server = createMcpTools(
      {
        db: deps.db,
        cache: deps.cache,
        linkDomain: deps.linkDomain,
        workspace: principal.workspace,
        actor: principal.actor,
      },
      principal,
      isOAuthPrincipal(principal)
        ? { client: principal.oauthClientId, credentialId: principal.consentId }
        : {
            client: `api-key:${principal.keyId}`,
            credentialId: principal.keyId,
          },
      deps.log,
      deps.qrExports,
    );
    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
    });
    try {
      await server.connect(transport);
      return await transport.handleRequest(request);
    } finally {
      await server.close();
    }
  });
  return app;
}
function isOAuthPrincipal(
  principal: ApiPrincipal,
): principal is OAuthPrincipal {
  return "oauthClientId" in principal;
}
