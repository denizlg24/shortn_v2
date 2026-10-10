import "server-only";
import { createAuth, type Auth } from "@shortn/auth";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { cache } from "react";
import { localeFromCookieHeader } from "@/i18n/locale";
import { mongoConfig } from "./db";
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
    production: e.NODE_ENV === "production",
    mongo: mongoConfig(),
    redis: {
      get: async (key) => (await redis()).cache.get(key),
      set: async (key, value, ttl) =>
        (await redis()).cache.set(key, value, "EX", ttl),
    },
    github: { clientId: e.AUTH_GITHUB_ID, clientSecret: e.AUTH_GITHUB_SECRET },
    google: { clientId: e.AUTH_GOOGLE_ID, clientSecret: e.AUTH_GOOGLE_SECRET },
    polar: { accessToken: e.POLAR_ACCESS_TOKEN, server: e.POLAR_ENVIRONMENT },
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

export const getSession = cache(async () =>
  auth().api.getSession({ headers: await headers() }),
);
