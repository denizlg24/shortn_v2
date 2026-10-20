import "server-only";
import { createAuth, type Auth } from "@shortn/auth";
import { consumeAuthRateLimit } from "@shortn/auth/rate-limit";
import { endSuspendedSession } from "@shortn/db";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { cache } from "react";
import { localeFromCookieHeader } from "@/i18n/locale";
import { db, mongoConfig } from "./db";
import { env } from "./env";
import { mail } from "./mail";
import { redis } from "./redis";

let instance: Auth | undefined;

const localeOf = (request?: Request) =>
  localeFromCookieHeader(
    request?.headers.get("cookie"),
    request?.headers.get("accept-language"),
  );

export function auth(): Auth {
  if (instance) return instance;
  const e = env();
  instance = createAuth({
    baseURL: e.BETTER_AUTH_URL,
    secret: e.BETTER_AUTH_SECRET,
    trustedOrigins: [
      new URL(e.BETTER_AUTH_URL).origin,
      ...e.SSO_TRUSTED_ORIGINS.split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => {
          const origin = new URL(value);
          if (
            origin.origin !== value ||
            origin.username ||
            origin.password ||
            (origin.protocol !== "https:" &&
              !(
                e.NODE_ENV !== "production" &&
                origin.protocol === "http:" &&
                ["localhost", "127.0.0.1"].includes(origin.hostname)
              ))
          )
            throw Error(
              "SSO_TRUSTED_ORIGINS must contain exact secure origins",
            );
          return origin.origin;
        }),
    ],
    production: e.NODE_ENV === "production",
    mongo: mongoConfig(),
    ...(e.MCP_OAUTH_ENABLED === "1" && e.MCP_PUBLIC_ORIGIN
      ? {
          mcp: {
            resource: new URL("/mcp", e.MCP_PUBLIC_ORIGIN).href,
            rolloutPercent: e.PLATFORM_MCP_ROLLOUT,
          },
        }
      : {}),
    redis: {
      consume: async (key, rule) =>
        consumeAuthRateLimit((await redis()).cache, key, rule),
    },
    github:
      e.AUTH_GITHUB_ID && e.AUTH_GITHUB_SECRET
        ? { clientId: e.AUTH_GITHUB_ID, clientSecret: e.AUTH_GITHUB_SECRET }
        : undefined,
    google:
      e.AUTH_GOOGLE_ID && e.AUTH_GOOGLE_SECRET
        ? { clientId: e.AUTH_GOOGLE_ID, clientSecret: e.AUTH_GOOGLE_SECRET }
        : undefined,
    polar: { accessToken: e.POLAR_ACCESS_TOKEN, server: e.POLAR_ENVIRONMENT },
    ...(e.ADMIN_ORIGIN
      ? { admin: { origin: new URL(e.ADMIN_ORIGIN).origin } }
      : {}),
    emails: {
      verifyEmail: (input, request) =>
        mail().verifyEmail({ ...input, locale: localeOf(request) }),
      emailVerified: (input, request) =>
        mail().emailVerified({
          to: input.to,
          locale: localeOf(request),
          url: e.BETTER_AUTH_URL,
        }),
      resetPassword: (input, request) =>
        mail().resetPassword({ ...input, locale: localeOf(request) }),
      confirmEmailChange: (input, request) =>
        mail().confirmEmailChange({ ...input, locale: localeOf(request) }),
    },
    plugins: [nextCookies()],
  });
  return instance;
}

// Sign-in refuses a banned account, but a session opened before the ban
// would otherwise live on; every server-side session read re-checks it.
export const getSession = cache(async () => {
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session) return session;
  const statusCache = await redis()
    .then((clients) => clients.cache)
    .catch(() => undefined);
  return (await endSuspendedSession(await db(), statusCache, session))
    ? null
    : session;
});

// Which OAuth buttons the sign-in screens may show.
export function socialProviders() {
  const e = env();
  return {
    github: Boolean(e.AUTH_GITHUB_ID && e.AUTH_GITHUB_SECRET),
    google: Boolean(e.AUTH_GOOGLE_ID && e.AUTH_GOOGLE_SECRET),
  };
}
