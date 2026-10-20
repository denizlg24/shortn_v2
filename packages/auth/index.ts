import { polar, portal } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { ensurePersonalWorkspace } from "@shortn/core";
import { getMongoHandles, physicalNames, type MongoConfig } from "@shortn/db";
import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { username } from "better-auth/plugins/username";
import { twoFactor } from "better-auth/plugins/two-factor";
import { twoFactorPolicy } from "./two-factor";
import { enterpriseSsoPlugins } from "./enterprise-sso";
import { passkeyPlugins } from "./passkeys";
import { requestGeo } from "./geo";
import { handoff } from "./handoff";
import { mcpOAuthPlugins } from "./mcp-oauth";
import { assertAccountActive, recordSignIn } from "./account-status";

// `request` is the triggering request, used to pick the email language.
export interface AuthEmails {
  verifyEmail(
    input: {
      to: string;
      name: string;
      url: string;
      reason: "signup" | "change";
    },
    request: Request | undefined,
  ): Promise<void>;
  emailVerified(
    input: { to: string; name: string },
    request: Request | undefined,
  ): Promise<void>;
  resetPassword(
    input: { to: string; name: string; url: string },
    request: Request | undefined,
  ): Promise<void>;
  confirmEmailChange(
    input: { to: string; name: string; newEmail: string; url: string },
    request: Request | undefined,
  ): Promise<void>;
}

export interface KeyValueStore {
  consume(
    key: string,
    rule: { window: number; max: number },
  ): Promise<{
    allowed: boolean;
    retryAfter: number | null;
  }>;
}

export interface AuthConfig {
  baseURL: string;
  secret: string;
  production: boolean;
  mongo: MongoConfig;
  // Rate-limit counters only. Sessions stay in Mongo while legacy can revoke
  // them there (16 D2); a Redis copy would outlive a legacy revocation.
  redis?: KeyValueStore;
  github?: { clientId: string; clientSecret: string } | undefined;
  google?: { clientId: string; clientSecret: string } | undefined;
  polar: { accessToken: string; server: "sandbox" | "production" };
  trustedOrigins?: string[];
  emails: AuthEmails;
  plugins?: BetterAuthPlugin[];
  mcp?: { resource: string; rolloutPercent?: number };
}

const randomSub = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return `authS|${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
};

// better-auth resolves adapter handles once; these follow the Mongo singleton
// across a failed first connect instead of pinning a dead client.
function forwardTo<T extends object>(resolve: () => T): T {
  return new Proxy(Object.create(null) as T, {
    get(_target, property) {
      const current = resolve();
      const value: unknown = Reflect.get(current, property, current);
      return typeof value === "function" ? value.bind(current) : value;
    },
  });
}

const nullableString = {
  type: "string",
  defaultValue: null,
  input: false,
  required: false,
} as const;

export function createAuth(config: AuthConfig) {
  // Database hooks receive the same endpoint context before/after mutations.
  // Keep request-local state for verification links opened without a session.
  const emailUpdates = new WeakSet<object>();
  const securityUpdates = new WeakSet<object>();
  const createdSessions = new WeakMap<object, string>();
  const secondFactorPending = new WeakSet<object>();
  const handles = () => getMongoHandles(config.mongo);
  const db = forwardTo(() => handles().db);
  const client = forwardTo(() => handles().client);
  const polarClient = new Polar({
    accessToken: config.polar.accessToken,
    server: config.polar.server,
  });
  const redis = config.redis;
  const billingPlugin = polar({
    client: polarClient,
    createCustomerOnSignUp: true,
    use: [portal()],
  });
  const initBilling = billingPlugin.init;
  const customerPlugin = {
    ...billingPlugin,
    init() {
      const initialized = initBilling();
      const updateCustomer =
        initialized.options.databaseHooks.user.update.after;
      return {
        ...initialized,
        options: {
          ...initialized.options,
          databaseHooks: {
            ...initialized.options.databaseHooks,
            user: {
              ...initialized.options.databaseHooks.user,
              update: {
                // Account-security changes do not alter Polar customer identity.
                after: async (...args: Parameters<typeof updateCustomer>) => {
                  if (args[1]?.path?.startsWith("/two-factor/")) return;
                  await updateCustomer(...args);
                },
              },
            },
          },
        },
      };
    },
  };

  return betterAuth({
    baseURL: config.baseURL,
    secret: config.secret,
    ...(config.trustedOrigins ? { trustedOrigins: config.trustedOrigins } : {}),
    database: mongodbAdapter(db, { client }),
    advanced: {
      cookiePrefix: "shortn_auth_",
      useSecureCookies: config.production,
      // SAML returns by cross-site POST. Configure this before Better Auth
      // constructs its cookie helpers; a plugin init override is too late.
      ...(config.production
        ? {
            cookies: {
              relay_state: {
                attributes: { sameSite: "none" as const, secure: true },
              },
            },
          }
        : {}),
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"] },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 10,
      customRules: {
        "/sign-in/email": { window: 120, max: 10 },
        "/sign-in/username": { window: 120, max: 10 },
        "/sign-up/email": { window: 3600, max: 5 },
        "/forget-password": { window: 3600, max: 3 },
        "/request-password-reset": { window: 3600, max: 3 },
        "/reset-password": { window: 900, max: 5 },
        "/verify-email": { window: 300, max: 10 },
        "/change-email": { window: 3600, max: 3 },
        "/change-password": { window: 900, max: 5 },
        ...(config.mcp
          ? {
              "/oauth2/register": { window: 3600, max: 10 },
              "/oauth2/authorize": { window: 60, max: 60 },
              "/oauth2/continue": { window: 60, max: 60 },
              "/oauth2/consent": { window: 60, max: 60 },
              "/oauth2/token": { window: 60, max: 60 },
              "/mcp/select-workspace": { window: 60, max: 60 },
            }
          : {}),
      },
      ...(redis
        ? {
            customStorage: redis,
          }
        : {}),
    },
    user: {
      changeEmail: {
        enabled: true,
        async sendChangeEmailConfirmation({ user, newEmail, url }, request) {
          await config.emails.confirmEmailChange(
            { to: user.email, name: user.name || user.email, newEmail, url },
            request,
          );
        },
      },
      additionalFields: {
        sub: {
          type: "string",
          defaultValue: null,
          index: true,
          unique: true,
          input: false,
        },
        phone_number: {
          type: "string",
          defaultValue: null,
          input: true,
          required: false,
        },
        links_this_month: { type: "number", defaultValue: 0, input: false },
        qr_codes_this_month: { type: "number", defaultValue: 0, input: false },
        redirects_this_month: { type: "number", defaultValue: 0, input: false },
        qr_code_redirects_this_month: {
          type: "number",
          defaultValue: 0,
          input: false,
        },
        lastWorkspaceId: nullableString,
        // Staff-managed (23 §3.1). input: false makes update-user reject them.
        role: {
          type: ["user", "admin", "superadmin"],
          required: false,
          input: false,
        },
        banned: { type: "boolean", required: false, input: false },
        banReason: { type: "string", required: false, input: false },
        banExpires: { type: "date", required: false, input: false },
        deletion: {
          type: "json",
          required: false,
          input: false,
          returned: false,
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          async before(user) {
            const sub: unknown = Reflect.get(user, "sub");
            return {
              data: {
                ...user,
                sub: typeof sub === "string" && sub ? sub : randomSub(),
                image:
                  user.image ||
                  `https://robohash.org/${encodeURIComponent(user.email)}`,
              },
            };
          },
          async after(user) {
            const sub: unknown = Reflect.get(user, "sub");
            const name: unknown = Reflect.get(user, "username");
            await ensurePersonalWorkspace(handles().db, {
              id: user.id,
              name: user.name,
              email: user.email,
              username: typeof name === "string" ? name : undefined,
              sub: typeof sub === "string" ? sub : undefined,
            });
          },
        },
        update: {
          async before(user, ctx) {
            if (
              ctx &&
              typeof user.twoFactorEnabled === "boolean" &&
              user.twoFactorEnabled !==
                Boolean(ctx.context.session?.user.twoFactorEnabled)
            )
              securityUpdates.add(ctx);
            if (
              ctx &&
              (ctx.path === "/verify-email" || ctx.path === "/change-email") &&
              typeof user.email === "string" &&
              user.email !== ctx.context.session?.user.email
            )
              emailUpdates.add(ctx);
            return { data: user };
          },
          async after(user, ctx) {
            if (ctx && securityUpdates.delete(ctx)) {
              const sessions = await ctx.context.internalAdapter.listSessions(
                user.id,
              );
              await Promise.all(
                sessions.map((session) =>
                  ctx.context.internalAdapter.deleteSession(session.token),
                ),
              );
              await handles()
                .db.collection(physicalNames.handoff_tokens)
                .deleteMany({ userId: user.id });
              await handles()
                .db.collection(physicalNames.verification)
                .deleteMany({ value: user.id, identifier: /^trust-device-/ });
            }
            const previous = ctx?.context.session?.user;
            const emailChanged = Boolean(ctx && emailUpdates.delete(ctx));
            const nameChanged = Boolean(
              previous && user.name !== previous.name,
            );
            if (emailChanged && ctx) {
              const currentToken =
                ctx.context.session?.session.token ?? createdSessions.get(ctx);
              const sessions = await ctx.context.internalAdapter.listSessions(
                user.id,
              );
              await Promise.all(
                sessions
                  .filter((session) => session.token !== currentToken)
                  .map((session) =>
                    ctx.context.internalAdapter.deleteSession(session.token),
                  ),
              );
            }
            if (!emailChanged && !nameChanged) return;
            try {
              const customer = await polarClient.customers.getExternal({
                externalId: user.id,
              });
              await polarClient.customers.update({
                id: customer.id,
                customerUpdate: {
                  ...(emailChanged ? { email: user.email } : {}),
                  ...(nameChanged ? { name: user.name } : {}),
                },
              });
            } catch (error) {
              console.error("Polar customer sync failed", user.id, error);
            }
          },
        },
      },
      session: {
        update: {
          async before(session, ctx) {
            const current = ctx?.context.session?.session;
            // Better Auth refreshes short sessions using the normal lifetime.
            // Impersonation must retain its original one-hour deadline instead.
            if (current?.impersonatedBy && session.expiresAt) {
              return {
                data: {
                  ...session,
                  expiresAt: new Date(
                    Math.min(
                      new Date(session.expiresAt).getTime(),
                      new Date(current.expiresAt).getTime(),
                      new Date(current.createdAt).getTime() + 60 * 60 * 1000,
                    ),
                  ),
                },
              };
            }
            return { data: session };
          },
        },
        create: {
          async after(session, ctx) {
            if (ctx) createdSessions.set(ctx, session.token);
            if (!ctx || !secondFactorPending.delete(ctx))
              await recordSignIn(handles().db, session, ctx?.path);
          },
          async before(session, ctx) {
            // Every sign-in method and the handoff end in createSession, so
            // this is the single ban gate (23 §3.1).
            const { awaitingSecondFactor } = await assertAccountActive(
              handles().db,
              session.userId,
              ctx?.path,
            );
            if (ctx && awaitingSecondFactor) secondFactorPending.add(ctx);
            if (ctx?.path === "/passkey/verify-authentication") {
              const credentialId: unknown = ctx.body?.response?.id;
              const key =
                typeof credentialId === "string"
                  ? await handles()
                      .db.collection(physicalNames.passkeys)
                      .findOne(
                        { credentialID: credentialId },
                        { projection: { _id: 1 } },
                      )
                  : null;
              if (!key) return false;
              session = { ...session, passkeyId: String(key._id) };
            }
            const geo = ctx?.request ? requestGeo(ctx.request.headers) : {};
            return {
              data: {
                ...session,
                geo_city: geo.city ?? null,
                geo_country: geo.country ?? null,
                geo_country_region: geo.countryRegion ?? null,
                geo_region: geo.region ?? null,
                geo_latitude: geo.latitude ?? null,
                geo_longitude: geo.longitude ?? null,
              },
            };
          },
        },
      },
    },
    session: {
      storeSessionInDatabase: true,
      additionalFields: {
        impersonatedBy: nullableString,
        passkeyId: nullableString,
        mcpWorkspaceId: nullableString,
        geo_city: nullableString,
        geo_country: nullableString,
        geo_country_region: nullableString,
        geo_region: nullableString,
        geo_latitude: nullableString,
        geo_longitude: nullableString,
      },
    },
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      requireEmailVerification: true,
      async sendResetPassword({ user, url }, request) {
        await config.emails.resetPassword(
          { to: user.email, name: user.name || user.email, url },
          request,
        );
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      async sendVerificationEmail({ user, url }, request) {
        await config.emails.verifyEmail(
          {
            to: user.email,
            name: user.name || user.email,
            url,
            reason: request?.url.includes("/change-email")
              ? "change"
              : "signup",
          },
          request,
        );
      },
      async afterEmailVerification(user, request) {
        await config.emails.emailVerified(
          { to: user.email, name: user.name || user.email },
          request,
        );
      },
    },
    socialProviders: {
      ...(config.github
        ? {
            github: {
              clientId: config.github.clientId,
              clientSecret: config.github.clientSecret,
              mapProfileToUser: (profile) => ({
                name: profile.name || profile.login,
                email: profile.email,
                username: profile.login || profile.email?.split("@")[0],
                image: profile.avatar_url,
                emailVerified: true,
                sub: `github|${profile.id}`,
              }),
            },
          }
        : {}),
      ...(config.google
        ? {
            google: {
              prompt: "select_account",
              clientId: config.google.clientId,
              clientSecret: config.google.clientSecret,
              mapProfileToUser: (profile) => ({
                name:
                  [profile.given_name, profile.family_name].join(" ").trim() ||
                  profile.name ||
                  (profile.email.split("@")[0] ?? profile.email),
                username: profile.email.split("@")[0] ?? profile.email,
                email: profile.email,
                image: profile.picture,
                emailVerified: profile.email_verified,
                sub: `google|${profile.sub}`,
              }),
            },
          }
        : {}),
    },
    plugins: [
      ...enterpriseSsoPlugins({
        db: () => handles().db,
        secret: config.secret,
        production: config.production,
        socialProviders: [
          ...(config.github ? ["github"] : []),
          ...(config.google ? ["google"] : []),
        ],
      }),
      ...passkeyPlugins({
        db: () => handles().db,
        baseURL: config.baseURL,
        socialProviders: [
          ...(config.github ? ["github"] : []),
          ...(config.google ? ["google"] : []),
        ],
      }),
      twoFactor({
        issuer: "Shortn",
        schema: { twoFactor: { modelName: physicalNames.two_factor } },
      }),
      twoFactorPolicy(() => handles().db),
      username({
        maxUsernameLength: 100,
        minUsernameLength: 3,
        usernameValidator: (value) => /^[a-zA-Z0-9_]+$/.test(value),
        displayUsernameValidator: (value) =>
          /^[a-zA-Z0-9 _.-]+$/.test(value) && value.trim().length >= 3,
      }),
      handoff({ db: () => handles().db }),
      customerPlugin,
      ...(config.mcp
        ? mcpOAuthPlugins({
            ...config.mcp,
            issuer: new URL("/api/auth", config.baseURL).href,
            db: () => handles().db,
          })
        : []),
      ...(config.plugins ?? []),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth["$Infer"]["Session"];
export { requestGeo } from "./geo";
export { hashHandoffToken, safeNext } from "./handoff";
export { mcpOAuthRequest } from "./oauth-request";
