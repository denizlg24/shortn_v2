import { oauthProvider } from "@better-auth/oauth-provider";
import { jwt } from "better-auth/plugins/jwt";
import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import type { BetterAuthPlugin } from "better-auth";
import { ObjectId, type Db } from "mongodb";
import { collection, physicalNames } from "@shortn/db";
import { apiScopes, platformFeatureEnabled } from "@shortn/core";
import { z } from "zod";
import { validMcpCallback } from "./oauth-request";

export interface McpOAuthConfig {
  resource: string;
  issuer: string;
  rolloutPercent?: number;
  db: () => Db;
}

export function mcpOAuthPlugins(config: McpOAuthConfig) {
  const workspaceFor = async (userId: string, workspaceId: unknown) => {
    if (typeof workspaceId !== "string" || !/^[a-f0-9]{24}$/i.test(workspaceId))
      throw new APIError("FORBIDDEN", { message: "Select a workspace" });
    const _id = new ObjectId(workspaceId);
    const [workspace, member] = await Promise.all([
      collection(config.db(), "workspaces").findOne({ _id }),
      collection(config.db(), "workspace_members").findOne({
        workspaceId: _id,
        userId,
      }),
    ]);
    if (
      !workspace ||
      !member ||
      !platformFeatureEnabled(workspace, "mcp", config.rolloutPercent)
    )
      throw new APIError("FORBIDDEN", { message: "Workspace unavailable" });
    return _id.toHexString();
  };
  const guard = {
    id: "shortn-mcp-oauth-guard",
    endpoints: {
      selectMcpWorkspace: createAuthEndpoint(
        "/mcp/select-workspace",
        {
          method: "POST",
          body: z.object({ workspaceId: z.string().regex(/^[a-f0-9]{24}$/i) }),
        },
        async (ctx) => {
          const session = await getSessionFromCtx(ctx);
          if (!session) throw new APIError("UNAUTHORIZED");
          const workspaceId = await workspaceFor(
            session.user.id,
            ctx.body.workspaceId,
          );
          await ctx.context.internalAdapter.updateSession(
            session.session.token,
            { mcpWorkspaceId: workspaceId },
          );
          return ctx.json({ workspaceId });
        },
      ),
    },
    hooks: {
      before: [
        {
          matcher: (ctx) =>
            ["/oauth2/authorize", "/oauth2/token", "/oauth2/consent"].includes(
              ctx.path ?? "",
            ),
          handler: createAuthMiddleware(async (ctx) => {
            if (
              ctx.path === "/oauth2/authorize" ||
              ctx.path === "/oauth2/token"
            ) {
              const resource: unknown =
                ctx.path === "/oauth2/authorize"
                  ? ctx.query?.resource
                  : ctx.body?.resource;
              if (resource !== config.resource)
                throw new APIError("BAD_REQUEST", {
                  error: "invalid_target",
                  message: "MCP resource is required",
                });
              if (ctx.path === "/oauth2/authorize") {
                const callback = ctx.query?.redirect_uri;
                if (typeof callback !== "string" || !validMcpCallback(callback))
                  throw new APIError("BAD_REQUEST", {
                    error: "invalid_request",
                    message: "Invalid callback address",
                  });
              }
            }
            if (ctx.path === "/oauth2/consent") {
              const session = await getSessionFromCtx(ctx);
              if (!session) throw new APIError("UNAUTHORIZED");
              if (ctx.body?.accept === false) return;
              const selected = Reflect.get(session.session, "mcpWorkspaceId");
              // UI submissions name the workspace the user reviewed. A second tab
              // changing selection cannot silently authorize another workspace.
              if (ctx.headers?.get("x-shortn-workspace") !== selected)
                throw new APIError("CONFLICT", {
                  message: "Workspace selection changed",
                });
              await workspaceFor(session.user.id, selected);
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
  const provider = oauthProvider({
    loginPage: "/login",
    consentPage: "/auth/mcp/consent",
    scopes: [...apiScopes, "offline_access"],
    resources: [
      {
        identifier: config.resource,
        allowedScopes: [...apiScopes, "offline_access"],
      },
    ],
    clientRegistrationDefaultResources: [config.resource],
    grantTypes: ["authorization_code", "refresh_token"],
    accessTokenExpiresIn: 600,
    codeExpiresIn: 300,
    allowDynamicClientRegistration: true,
    allowUnauthenticatedClientRegistration: true,
    clientPrivileges: async () => false,
    postLogin: {
      page: "/auth/mcp/workspace",
      shouldRedirect: async ({ user, session }) => {
        try {
          await workspaceFor(user.id, session.mcpWorkspaceId);
          return false;
        } catch {
          return true;
        }
      },
      consentReferenceId: ({ user, session }) =>
        workspaceFor(user.id, session.mcpWorkspaceId),
    },
    customAccessTokenClaims: async ({ user, referenceId, resources }) => {
      if (!user || resources?.length !== 1 || resources[0] !== config.resource)
        throw new APIError("FORBIDDEN");
      return {
        "https://shortn.at/workspace": await workspaceFor(user.id, referenceId),
      };
    },
    schema: {
      oauthClient: { modelName: physicalNames.oauth_clients },
      oauthResource: { modelName: physicalNames.oauth_resources },
      oauthClientResource: { modelName: physicalNames.oauth_client_resources },
      oauthConsent: { modelName: physicalNames.oauth_consents },
      oauthAccessToken: { modelName: physicalNames.oauth_access_tokens },
      oauthRefreshToken: { modelName: physicalNames.oauth_refresh_tokens },
    },
  });
  // The repo index manager already owns this mandatory composite index.
  // Use its stable name so the Mongo adapter does not attempt an equivalent
  // index under a second name (Mongo rejects that at request time).
  const managedProvider = {
    ...provider,
    schema: {
      ...provider.schema,
      oauthClientResource: {
        ...provider.schema.oauthClientResource,
        indexes: [
          {
            fields: ["clientId", "resourceId"],
            unique: true,
            name: "oauth_client_resource",
          },
        ],
      },
    },
  };
  return [
    jwt({
      jwt: { issuer: config.issuer },
      schema: { jwks: { modelName: physicalNames.oauth_jwks } },
    }),
    managedProvider as unknown as BetterAuthPlugin,
    guard,
  ];
}
