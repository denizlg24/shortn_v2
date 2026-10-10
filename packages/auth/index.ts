import { polar, portal } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { ensurePersonalWorkspace } from "@shortn/core";
import { getMongoHandles, physicalNames, type MongoConfig } from "@shortn/db";
import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { username } from "better-auth/plugins/username";
import { z } from "zod";
import { requestGeo } from "./geo";
import { handoff } from "./handoff";

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
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<unknown>;
}

export interface AuthConfig {
  baseURL: string;
  secret: string;
  production: boolean;
  mongo: MongoConfig;
  // Rate-limit counters only. Sessions stay in Mongo while legacy can revoke
  // them there (16 D2); a Redis copy would outlive a legacy revocation.
  redis?: KeyValueStore;
  github: { clientId: string; clientSecret: string };
  google: { clientId: string; clientSecret: string };
  polar: { accessToken: string; server: "sandbox" | "production" };
  trustedOrigins?: string[];
  emails: AuthEmails;
  plugins?: BetterAuthPlugin[];
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

const rateLimitEntry = z.object({
  key: z.string(),
  count: z.number(),
  lastRequest: z.number(),
});

const nullableString = {
  type: "string",
  defaultValue: null,
  input: false,
  required: false,
} as const;

export function createAuth(config: AuthConfig) {
  const handles = () => getMongoHandles(config.mongo);
  const db = forwardTo(() => handles().db);
  const client = forwardTo(() => handles().client);
  const polarClient = new Polar({
    accessToken: config.polar.accessToken,
    server: config.polar.server,
  });
  const redis = config.redis;

  return betterAuth({
    baseURL: config.baseURL,
    secret: config.secret,
    ...(config.trustedOrigins ? { trustedOrigins: config.trustedOrigins } : {}),
    database: mongodbAdapter(db, { client }),
    advanced: {
      cookiePrefix: "shortn_auth_",
      useSecureCookies: config.production,
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
      },
      ...(redis
        ? {
            customStorage: {
              async get(key: string) {
                const value = await redis.get(`auth-rl:${key}`);
                if (!value) return undefined;
                const parsed = rateLimitEntry.safeParse(JSON.parse(value));
                return parsed.success ? parsed.data : undefined;
              },
              async set(key, value) {
                await redis.set(`auth-rl:${key}`, JSON.stringify(value), 3600);
              },
            },
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
          async after(user, ctx) {
            const previous = ctx?.context.session?.user;
            if (!previous) return;
            const emailChanged = user.email !== previous.email;
            const nameChanged = user.name !== previous.name;
            if (emailChanged)
              await handles()
                .db.collection(physicalNames.session)
                .deleteMany({ userId: user.id });
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
        create: {
          async before(session, ctx) {
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
      additionalFields: {
        impersonatedBy: nullableString,
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
      github: {
        clientId: config.github.clientId,
        clientSecret: config.github.clientSecret,
        mapProfileToUser: (profile) => ({
          name: profile.name || profile.login,
          email: profile.email,
          username:
            profile.login || profile.email.slice(0, profile.email.indexOf("@")),
          image: profile.avatar_url,
          emailVerified: true,
          sub: `github|${profile.id}`,
        }),
      },
      google: {
        prompt: "select_account",
        clientId: config.google.clientId,
        clientSecret: config.google.clientSecret,
        mapProfileToUser: (profile) => ({
          name:
            [profile.given_name, profile.family_name].join(" ").trim() ||
            profile.name ||
            profile.email.slice(0, profile.email.indexOf("@")),
          username: profile.email.slice(0, profile.email.indexOf("@")),
          email: profile.email,
          image: profile.picture,
          emailVerified: profile.email_verified,
          sub: `google|${profile.sub}`,
        }),
      },
    },
    plugins: [
      username({
        maxUsernameLength: 100,
        minUsernameLength: 3,
        usernameValidator: (value) => /^[a-zA-Z0-9_]+$/.test(value),
        displayUsernameValidator: (value) =>
          /^[a-zA-Z0-9 _.-]+$/.test(value) && value.trim().length >= 3,
      }),
      handoff({ db: () => handles().db }),
      polar({
        client: polarClient,
        createCustomerOnSignUp: true,
        use: [portal()],
      }),
      ...(config.plugins ?? []),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth["$Infer"]["Session"];
export { requestGeo } from "./geo";
export { hashHandoffToken, safeNext } from "./handoff";
