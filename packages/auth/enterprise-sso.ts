import { physicalNames, ssoSessionActive } from "@shortn/db";
import type { Db } from "mongodb";
import { randomBytes, randomUUID } from "node:crypto";
import { domainToASCII } from "node:url";
import { getCurrentAuthEndpointContext } from "@better-auth/core/context";
import { deriveSAMLIdentityProviderEntityID, sso } from "@better-auth/sso";
import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  addOAuthServerContext,
  createAuthEndpoint,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import { deleteSessionCookie } from "better-auth/cookies";
import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import { z } from "zod";
import { ssoProviderPage } from "./sso-views";
import { mcpOAuthRequest } from "./oauth-request";
import {
  hashSsoLinkNonce,
  resolveWorkspaceSsoIdentity,
  ssoAuthorityModels,
  ssoAuthoritySchema,
  ssoProviderFields,
  ssoWorkspaceAuthority,
  ssoWorkspaceOwner,
} from "./sso-authority";

const sealed = "shortn-sso:v1:";
const objectId = z.string().regex(/^[a-f\d]{24}$/i);
function bareDomain(value: unknown) {
  if (
    typeof value !== "string" ||
    value !== value.trim() ||
    /[\s/@:,?#\\]/u.test(value)
  )
    return null;
  const domain = domainToASCII(value).toLowerCase();
  return domain.length <= 253 &&
    /^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z]{2,63}$/.test(domain)
    ? domain
    : null;
}
function safeIssuer(value: unknown, production: boolean) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return !url.username &&
      !url.password &&
      !url.hash &&
      !url.search &&
      (url.protocol === "https:" ||
        (!production &&
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(url.hostname)))
      ? value
      : null;
  } catch {
    return null;
  }
}

/** Protocol plugin factory. Canonical identity authority is resolved inside the
 * vendor's native account/session transaction, after protocol verification.
 */
export function enterpriseSsoPlugins(config: {
  secret: string;
  production: boolean;
  db: () => Db;
  socialProviders?: string[];
}) {
  const cookieName = config.production
    ? "__Secure-shortn_sso_link"
    : "shortn_sso_link";
  const cookieOptions = {
    httpOnly: true,
    secure: config.production,
    sameSite: config.production ? ("none" as const) : ("lax" as const),
    path: "/api/auth",
    maxAge: 300,
  };
  const protocol = sso({
    disableImplicitSignUp: true,
    domainVerification: { enabled: true, tokenPrefix: "shortn-sso" },
    trustEmailVerified: false,
    defaultOverrideUserInfo: false,
    saml: {
      enableInResponseToValidation: true,
      allowIdpInitiated: false,
      requireTimestamps: true,
      clockSkew: 60000,
      algorithms: { onDeprecated: "reject" },
    },
    schema: {
      ssoProvider: {
        modelName: physicalNames.sso_providers,
        additionalFields: {
          ...ssoProviderFields,
          identityIssuer: { ...ssoProviderFields.identityIssuer, input: true },
        },
      },
    },
    guardProviderMutation: async (input, { database }) => {
      const endpoint = getCurrentAuthEndpointContext();
      const session = endpoint.context.session;
      const provider = await database.findOne<{ workspaceId: string }>({
        model: "ssoProvider",
        where: [{ field: "id", value: input.provider.id }],
      });
      if (!session || !provider) throw Error("SSO_PROVIDER_FORBIDDEN");
      const authority = await ssoWorkspaceOwner(
        database,
        provider.workspaceId,
        session.user.id,
      );
      if (!authority) throw Error("SSO_PROVIDER_FORBIDDEN");
      if (input.action === "update")
        throw Error("SSO_PROVIDER_REPLACE_REQUIRED");
      await database.deleteMany({
        model: ssoAuthorityModels.binding,
        where: [{ field: "providerRecordId", value: input.provider.id }],
      });
      await database.deleteMany({
        model: ssoAuthorityModels.intent,
        where: [{ field: "providerRecordId", value: input.provider.id }],
      });
      await database.deleteMany({
        model: "session",
        where: [{ field: "ssoProviderId", value: input.provider.id }],
      });
    },
    resolveUser: async (input, context) => {
      const endpoint = getCurrentAuthEndpointContext();
      const nonce = await endpoint.getSignedCookie?.(cookieName, config.secret);
      const result = await resolveWorkspaceSsoIdentity(
        input,
        context,
        typeof nonce === "string" ? nonce : undefined,
      );
      if (
        result.action === "link" &&
        input.providerReference.source.type === "persisted"
      ) {
        const provider = await context.database.findOne<{
          workspaceId: string;
        }>({
          model: "ssoProvider",
          where: [
            { field: "id", value: input.providerReference.source.recordId },
          ],
        });
        if (!provider)
          return { action: "reject", code: "SSO_PROVIDER_UNAVAILABLE" };
        Reflect.set(endpoint.context, "shortnSsoSession", {
          providerId: input.providerReference.source.recordId,
          workspaceId: provider.workspaceId,
          userId: result.userId,
        });
        if (nonce)
          endpoint.setCookie?.(cookieName, "", { ...cookieOptions, maxAge: 0 });
      }
      return result;
    },
  });
  // The vendor expects serialized JSON on adapter reads. Encrypt both provider
  // configurations at rest, including OIDC secrets and SAML private key material.
  for (const field of [
    protocol.schema.ssoProvider.fields.oidcConfig,
    protocol.schema.ssoProvider.fields.samlConfig,
  ]) {
    if (!field) throw Error("SSO_CONFIGURATION_SCHEMA_MISSING");
    Object.assign(field, {
      transform: {
        input: async (value: unknown) =>
          value == null
            ? value
            : typeof value === "string"
              ? sealed +
                (await symmetricEncrypt({ key: config.secret, data: value }))
              : (() => {
                  throw Error("SSO_CONFIGURATION_INVALID");
                })(),
        output: async (value: unknown) =>
          value == null
            ? value
            : typeof value === "string" && value.startsWith(sealed)
              ? await symmetricDecrypt({
                  key: config.secret,
                  data: value.slice(sealed.length),
                })
              : (() => {
                  throw Error("SSO_CONFIGURATION_NOT_ENCRYPTED");
                })(),
      },
    });
  }
  const policy = {
    id: "shortn-enterprise-sso-policy",
    schema: {
      session: {
        fields: {
          ssoProviderId: { type: "string", required: false, input: false },
          ssoWorkspaceId: { type: "string", required: false, input: false },
        },
      },
    },
    init: () => ({
      options: {
        databaseHooks: {
          session: {
            create: {
              before: async (data, ctx) => {
                const source =
                  ctx &&
                  (Reflect.get(ctx.context, "shortnSsoSession") as
                    | {
                        providerId: string;
                        workspaceId: string;
                        userId: string;
                      }
                    | undefined);
                if (!source) return { data };
                if (source.userId !== data.userId) return false;
                return {
                  data: {
                    ...data,
                    ssoProviderId: source.providerId,
                    ssoWorkspaceId: source.workspaceId,
                  },
                };
              },
            },
          },
        },
      },
    }),
    endpoints: {
      discoverSso: createAuthEndpoint(
        "/shortn/sso/discover",
        {
          method: "GET",
          query: z.object({
            workspace: z.string().trim().toLowerCase().min(1).max(64),
            page: z.coerce.number().int().min(1).max(1000000).optional(),
          }),
        },
        async (ctx) => {
          const database = config.db();
          const workspace = await database
            .collection(physicalNames.workspaces)
            .findOne(
              {
                slug: ctx.query.workspace,
                personal: false,
                "platformFeatures.advancedAuth": true,
              },
              { projection: { name: 1 } },
            );
          if (
            !workspace ||
            !(await database
              .collection(physicalNames.subscriptions)
              .findOne(
                {
                  workspaceId: workspace._id,
                  plan: "enterprise",
                  status: { $in: ["active", "trialing", "past_due"] },
                },
                { projection: { _id: 1 } },
              ))
          )
            return ctx.json({
              rows: [],
              total: 0,
              page: 1,
              pages: 1,
              workspaceName: null,
            });
          return ctx.json({
            ...(await ssoProviderPage(
              database,
              workspace._id,
              ctx.query.page,
              true,
            )),
            workspaceName:
              typeof workspace.name === "string"
                ? workspace.name
                : ctx.query.workspace,
          });
        },
      ),

      disconnectSso: createAuthEndpoint(
        "/shortn/sso/disconnect",
        {
          method: "POST",
          body: z.object({ providerId: z.string().min(1).max(128) }),
        },
        async (ctx) => {
          const session = await getSessionFromCtx(ctx);
          if (
            !session ||
            !session.user.emailVerified ||
            session.session.impersonatedBy ||
            Date.now() - new Date(session.session.createdAt).getTime() > 300000
          )
            throw new APIError("FORBIDDEN", {
              code: "SESSION_IS_NOT_FRESH",
              message: "Sign in again before disconnecting workplace SSO",
            });
          await ctx.context.adapter.transaction(async (database) => {
            const binding = await database.findOne<{ id: string }>({
              model: ssoAuthorityModels.binding,
              where: [
                { field: "userId", value: session.user.id },
                { field: "providerId", value: ctx.body.providerId },
              ],
            });
            if (!binding) throw new APIError("NOT_FOUND");
            const user = await database.findOne<{
              passkeyRemoval?: { expiresAt?: Date };
            }>({
              model: "user",
              where: [{ field: "id", value: session.user.id }],
            });
            if (
              user?.passkeyRemoval?.expiresAt &&
              new Date(user.passkeyRemoval.expiresAt).getTime() > Date.now()
            )
              throw new APIError("CONFLICT", {
                code: "SIGN_IN_METHOD_BUSY",
                message: "Another sign-in method is being removed. Try again",
              });
            await database.update({
              model: "user",
              where: [{ field: "id", value: session.user.id }],
              update: { shortnSsoAuthFence: randomUUID() },
            });
            const accounts = await database.findMany<{
              providerId: string;
              password?: string;
            }>({
              model: "account",
              where: [{ field: "userId", value: session.user.id }],
            });
            const fallback = accounts.some(
              (account) =>
                account.providerId !== ctx.body.providerId &&
                (account.providerId === "credential"
                  ? Boolean(account.password)
                  : config.socialProviders?.includes(account.providerId)),
            );
            if (
              !fallback &&
              !(await database.count({
                model: "passkey",
                where: [{ field: "userId", value: session.user.id }],
              }))
            )
              throw new APIError("FORBIDDEN", {
                code: "LAST_SIGN_IN_METHOD",
                message:
                  "Add a password or passkey before disconnecting your last sign-in method",
              });
            await database.delete({
              model: ssoAuthorityModels.binding,
              where: [{ field: "id", value: binding.id }],
            });
            await database.deleteMany({
              model: "account",
              where: [
                { field: "userId", value: session.user.id },
                { field: "providerId", value: ctx.body.providerId },
              ],
            });
            await database.deleteMany({
              model: "session",
              where: [{ field: "userId", value: session.user.id }],
            });
          });
          deleteSessionCookie(ctx, true);
          return ctx.json({ status: true });
        },
      ),
      prepareSsoLink: createAuthEndpoint(
        "/shortn/sso/link-intent",
        {
          method: "POST",
          body: z.object({ providerId: z.string().min(1).max(128) }),
        },
        async (ctx) => {
          const session = await getSessionFromCtx(ctx);
          if (
            !session ||
            !session.user.emailVerified ||
            session.session.impersonatedBy ||
            Date.now() - new Date(session.session.createdAt).getTime() > 300000
          )
            throw new APIError("FORBIDDEN", {
              code: "SESSION_IS_NOT_FRESH",
              message: "Sign in again before connecting workplace SSO",
            });
          const nonce = randomBytes(32).toString("base64url");
          await ctx.context.adapter.transaction(async (database) => {
            const provider = await database.findOne<{
              id: string;
              workspaceId: string;
              domainVerified: boolean;
            }>({
              model: "ssoProvider",
              where: [{ field: "providerId", value: ctx.body.providerId }],
            });
            if (
              !provider ||
              !provider.domainVerified ||
              !(await ssoWorkspaceAuthority(
                database,
                provider.workspaceId,
                session.user.id,
              ))
            )
              throw new APIError("FORBIDDEN", {
                code: "SSO_PROVIDER_UNAVAILABLE",
                message: "Workplace SSO is unavailable",
              });
            await database.create({
              model: ssoAuthorityModels.intent,
              data: {
                nonceHash: hashSsoLinkNonce(nonce),
                providerId: ctx.body.providerId,
                providerRecordId: provider.id,
                workspaceId: provider.workspaceId,
                userId: session.user.id,
                sessionId: session.session.id,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 300000),
              },
            });
          });
          await ctx.setSignedCookie(
            cookieName,
            nonce,
            config.secret,
            cookieOptions,
          );
          return ctx.json({ status: true });
        },
      ),
    },
    hooks: {
      before: [
        {
          matcher: (ctx) =>
            ctx.path?.startsWith("/sso/") ||
            ctx.path === "/sign-in/sso" ||
            ctx.path === "/unlink-account",
          handler: createAuthMiddleware(async (ctx) => {
            if (ctx.path?.startsWith("/sso/saml2/sp/acs/")) {
              const relay = ctx.body?.RelayState;
              if (
                typeof relay !== "string" ||
                !/^[a-zA-Z0-9_-]{32}$/.test(relay)
              )
                return;
              const cookie = ctx.context.createAuthCookie("relay_state");
              if (
                (await ctx.getSignedCookie(cookie.name, config.secret)) !==
                relay
              )
                return;
              const saved =
                await ctx.context.internalAdapter.consumeVerificationValue(
                  `shortn-sso-oauth:${relay}`,
                );
              if (!saved) return;
              const value = z
                .object({ query: z.string(), providerId: z.string() })
                .safeParse(JSON.parse(saved.value));
              if (
                !value.success ||
                value.data.providerId !== ctx.params?.providerId ||
                !(await mcpOAuthRequest(
                  config.db(),
                  value.data.query,
                  config.secret,
                ))
              )
                throw new APIError("BAD_REQUEST", {
                  code: "INVALID_OAUTH_QUERY",
                });
              // The OAuth provider's following before hook verifies this signed query
              // and restores its request-local state. Protocol validation still runs
              // before its after hook can resume authorization.
              ctx.body.oauth_query = value.data.query;
              return;
            }
            if (ctx.path === "/unlink-account") {
              const session = await getSessionFromCtx(ctx);
              if (!session) return;
              const rowId = ctx.body?.accountId;
              const account =
                typeof rowId === "string" && /^[a-f\d]{24}$/i.test(rowId)
                  ? await ctx.context.adapter.findOne<{ providerId: string }>({
                      model: "account",
                      where: [
                        { field: "id", value: rowId },
                        { field: "userId", value: session.user.id },
                      ],
                    })
                  : null;
              const providerId = account?.providerId ?? ctx.body?.providerId;
              if (
                typeof providerId === "string" &&
                (await ctx.context.adapter.findOne({
                  model: "ssoProvider",
                  where: [{ field: "providerId", value: providerId }],
                }))
              )
                throw new APIError("FORBIDDEN", {
                  code: "SSO_DISCONNECT_REQUIRED",
                  message: "Disconnect workplace SSO from Sign-in methods",
                });
              return;
            }
            if (ctx.path === "/sign-in/sso") {
              if (ctx.body?.oauth_query != null) {
                const query = ctx.body.oauth_query;
                if (
                  typeof query !== "string" ||
                  !(await mcpOAuthRequest(config.db(), query, config.secret))
                )
                  throw new APIError("BAD_REQUEST", {
                    code: "INVALID_OAUTH_QUERY",
                  });
                const params = new URLSearchParams(query),
                  issuedAt = Number(params.get("ba_iat"));
                for (const key of ["sig", "exp", "ba_iat", "ba_pl"])
                  params.delete(key);
                await addOAuthServerContext({
                  query: params.toString(),
                  ...(Number.isFinite(issuedAt) && issuedAt > 0
                    ? { signedQueryIssuedAtMs: issuedAt }
                    : {}),
                });
              }
              if (
                typeof ctx.body?.providerId !== "string" ||
                ctx.body.requestSignUp === true ||
                ctx.body.organizationSlug ||
                ctx.body.domain ||
                ctx.body.email
              )
                throw new APIError("BAD_REQUEST", {
                  code: "SSO_PROVIDER_REQUIRED",
                  message: "Choose a configured workplace SSO provider",
                });
              const provider = await ctx.context.adapter.findOne<{
                workspaceId: string;
                domainVerified: boolean;
                userId: string;
              }>({
                model: "ssoProvider",
                where: [{ field: "providerId", value: ctx.body.providerId }],
              });
              if (
                !provider?.domainVerified ||
                !(await ssoWorkspaceAuthority(
                  ctx.context.adapter,
                  provider.workspaceId,
                  provider.userId,
                ))
              )
                throw new APIError("FORBIDDEN", {
                  code: "SSO_PROVIDER_UNAVAILABLE",
                  message: "Workplace SSO is unavailable",
                });
              return;
            }
            if (
              ![
                "/sso/register",
                "/sso/update-provider",
                "/sso/delete-provider",
                "/sso/request-domain-verification",
                "/sso/verify-domain",
              ].includes(ctx.path!)
            )
              return;
            const session = await getSessionFromCtx(ctx);
            if (
              !session ||
              !session.user.emailVerified ||
              session.session.impersonatedBy ||
              Date.now() - new Date(session.session.createdAt).getTime() >
                300000
            )
              throw new APIError("FORBIDDEN", {
                code: "SESSION_IS_NOT_FRESH",
                message: "Sign in again before changing workplace SSO",
              });
            let workspaceId: string;
            if (ctx.path === "/sso/register") {
              const checked = objectId.safeParse(ctx.body?.workspaceId);
              if (!checked.success)
                throw new APIError("BAD_REQUEST", {
                  code: "SSO_WORKSPACE_REQUIRED",
                  message: "Choose a workspace",
                });
              workspaceId = checked.data;
            } else {
              const providerId = ctx.body?.providerId;
              const provider = await ctx.context.adapter.findOne<{
                workspaceId: string;
              }>({
                model: "ssoProvider",
                where: [
                  {
                    field: "providerId",
                    value: typeof providerId === "string" ? providerId : "",
                  },
                ],
              });
              if (!provider) throw new APIError("FORBIDDEN");
              workspaceId = provider.workspaceId;
            }
            const authority =
              ctx.path === "/sso/delete-provider"
                ? await ssoWorkspaceOwner(
                    ctx.context.adapter,
                    workspaceId,
                    session.user.id,
                  )
                : await ssoWorkspaceAuthority(
                    ctx.context.adapter,
                    workspaceId,
                    session.user.id,
                  );
            if (!authority || authority.member.role !== "owner")
              throw new APIError("FORBIDDEN", {
                code: "SSO_ENTERPRISE_OWNER_REQUIRED",
                message:
                  "An Enterprise workspace owner must manage workplace SSO",
              });
            if (ctx.path === "/sso/update-provider")
              throw new APIError("FORBIDDEN", {
                code: "SSO_PROVIDER_REPLACE_REQUIRED",
                message:
                  "Replace the provider to change its authentication configuration",
              });
            if (ctx.path !== "/sso/register") return;
            if (
              ctx.body.organizationId != null ||
              Boolean(ctx.body.oidcConfig) === Boolean(ctx.body.samlConfig)
            )
              throw new APIError("BAD_REQUEST");
            const domain = bareDomain(ctx.body.domain),
              issuer = safeIssuer(ctx.body.issuer, config.production);
            if (!domain || !issuer)
              throw new APIError("BAD_REQUEST", {
                code: "SSO_CONFIGURATION_INVALID",
                message: "Use a bare email domain and a secure issuer URL",
              });
            if (
              typeof ctx.body.providerId !== "string" ||
              !/^[a-z\d][a-z\d-]{0,31}$/.test(ctx.body.providerId)
            )
              throw new APIError("BAD_REQUEST", {
                code: "SSO_PROVIDER_ID_INVALID",
                message:
                  "Use a provider identifier of up to 32 lowercase letters, digits or hyphens",
              });
            const label = ctx.body.displayName ?? ctx.body.providerId;
            if (
              typeof label !== "string" ||
              !label.trim() ||
              label.normalize("NFC").trim().length > 64 ||
              /[\p{Cc}\p{Cf}]/u.test(label)
            )
              throw new APIError("BAD_REQUEST", {
                code: "SSO_NAME_INVALID",
                message: "Use a provider name between 1 and 64 characters",
              });
            ctx.body.displayName = label.normalize("NFC").trim();
            ctx.body.domain = domain;
            if (ctx.body.oidcConfig) {
              if (
                ctx.body.oidcConfig.allowIdpInitiated === true ||
                ctx.body.oidcConfig.mapping?.extraFields
              )
                throw new APIError("BAD_REQUEST");
              ctx.body.oidcConfig.pkce = true;
              ctx.body.oidcConfig.scopes = ["openid", "email", "profile"];
              ctx.body.identityIssuer = issuer;
            } else {
              ctx.body.samlConfig.wantAssertionsSigned = true;
              ctx.body.samlConfig.signatureAlgorithm = "sha256";
              ctx.body.samlConfig.digestAlgorithm = "sha256";
              if (ctx.body.samlConfig.mapping?.extraFields)
                throw new APIError("BAD_REQUEST");
              ctx.body.identityIssuer = deriveSAMLIdentityProviderEntityID(
                ctx.body.samlConfig,
              );
            }
          }),
        },
      ],
      after: [
        {
          matcher: (ctx) =>
            ctx.path === "/sso/register" ||
            ctx.path === "/get-session" ||
            ctx.path === "/sign-out" ||
            ctx.path === "/sign-in/sso",
          handler: createAuthMiddleware(async (ctx) => {
            if (ctx.path === "/sign-out") {
              ctx.setCookie(cookieName, "", { ...cookieOptions, maxAge: 0 });
              return;
            }
            const result = ctx.context.returned;
            if (
              !result ||
              typeof result !== "object" ||
              result instanceof APIError
            )
              return;
            if (ctx.path === "/sign-in/sso") {
              const target = Reflect.get(result, "url");
              if (
                typeof ctx.body?.oauth_query !== "string" ||
                typeof target !== "string"
              )
                return;
              const relay = new URL(target).searchParams.get("RelayState");
              if (!relay || !/^[a-zA-Z0-9_-]{32}$/.test(relay)) return;
              await ctx.context.internalAdapter.createVerificationValue({
                identifier: `shortn-sso-oauth:${relay}`,
                value: JSON.stringify({
                  query: ctx.body.oauth_query,
                  providerId: ctx.body.providerId,
                }),
                expiresAt: new Date(Date.now() + 300000),
              });
              return;
            }
            if (ctx.path === "/get-session") {
              const session: unknown = Reflect.get(result, "session");
              if (!session || typeof session !== "object") return;
              const providerId = Reflect.get(session, "ssoProviderId");
              if (providerId == null) return;
              const userId = Reflect.get(session, "userId"),
                workspaceId = Reflect.get(session, "ssoWorkspaceId");
              if (
                typeof userId === "string" &&
                (await ssoSessionActive(
                  config.db(),
                  { ssoProviderId: providerId, ssoWorkspaceId: workspaceId },
                  userId,
                ))
              )
                return;
              const token = Reflect.get(session, "token");
              if (typeof token === "string")
                await ctx.context.internalAdapter.deleteSession(token);
              deleteSessionCookie(ctx, true);
              return ctx.json(null);
            }
            const safe = Object.fromEntries(
              [
                "id",
                "providerId",
                "workspaceId",
                "displayName",
                "domain",
                "domainVerified",
                "domainVerificationToken",
                "redirectURI",
              ].map((key) => [key, Reflect.get(result, key)]),
            );
            return ctx.json(safe);
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
  return [protocol, ssoAuthoritySchema, policy] as const;
}
