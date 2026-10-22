import {
  adminElevationRefusal,
  elevationTtlMs,
  hashElevationSecret,
} from "@shortn/core";
import { accountFlagsProjection, collection } from "@shortn/db";
import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  getSessionFromCtx,
} from "better-auth/api";
import { ObjectId, type Db } from "mongodb";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { KeyValueStore } from "./index";
import { verifyTotpStepUp } from "./two-factor";

export interface AdminElevationOptions {
  db: () => Db;
  /** The admin console origin; the callback URL is built from it only. */
  adminOrigin: string;
  redis?: KeyValueStore | undefined;
}

const refusalCodes = {
  not_staff: "NOT_STAFF",
  account_suspended: "ACCOUNT_SUSPENDED",
  email_not_verified: "EMAIL_NOT_VERIFIED",
  totp_required: "TOTP_REQUIRED",
} as const;

export const loadElevationUser = (db: Db, userId: string) =>
  /^[a-f\d]{24}$/i.test(userId)
    ? collection(db, "user").findOne(
        { _id: new ObjectId(userId) },
        {
          projection: {
            ...accountFlagsProjection,
            role: 1,
            emailVerified: 1,
            twoFactorEnabled: 1,
          },
        },
      )
    : Promise.resolve(null);

/** Trades a fresh TOTP code for a 60-second, single-use admin elevation
 * token bound to the nonce the admin console set in this browser
 * (23 §1.1 step 3). Every eligibility rule is re-read from the user doc. */
export function adminElevation(options: AdminElevationOptions) {
  const callback = new URL("/auth/callback", options.adminOrigin);
  return {
    id: "shortn-admin-elevation",
    endpoints: {
      adminElevate: createAuthEndpoint(
        "/admin/elevate",
        {
          method: "POST",
          body: z
            .object({
              code: z.string().regex(/^\d{6}$/),
              n: z.string().regex(/^[a-f\d]{64}$/),
              purpose: z.enum(["login", "stepup"]),
            })
            .strict(),
        },
        async (ctx) => {
          const session = await getSessionFromCtx(ctx);
          if (!session) throw new APIError("UNAUTHORIZED");
          if (Reflect.get(session.session, "impersonatedBy"))
            throw new APIError("FORBIDDEN", {
              code: "IMPERSONATION_FORBIDDEN",
              message: "Not available while impersonating",
            });
          const db = options.db();
          const user = await loadElevationUser(db, session.user.id);
          if (!user) throw new APIError("UNAUTHORIZED");
          const refusal = adminElevationRefusal(user);
          if (refusal)
            throw new APIError("FORBIDDEN", {
              code: refusalCodes[refusal],
              message: "Admin access is not available for this account",
            });
          if (options.redis) {
            const limit = await options.redis.consume(
              `admin-elevate:${session.user.id}`,
              { window: 900, max: 5 },
            );
            if (!limit.allowed)
              throw new APIError("TOO_MANY_REQUESTS", {
                code: "TOO_MANY_ATTEMPTS",
                message: "Too many attempts",
              });
          }
          const verified = await verifyTotpStepUp(
            db,
            ctx.context.secretConfig,
            session.user.id,
            ctx.body.code,
          );
          if (verified !== "verified")
            throw new APIError(
              verified === "no_factor" ? "FORBIDDEN" : "UNAUTHORIZED",
              {
                code:
                  verified === "replayed"
                    ? "TOTP_ALREADY_USED"
                    : verified === "no_factor"
                      ? "TOTP_REQUIRED"
                      : "INVALID_CODE",
                message: "The authenticator code was not accepted",
              },
            );
          const token = randomBytes(32).toString("base64url");
          const now = new Date();
          await collection(db, "admin_elevation_tokens").insertOne({
            _id: hashElevationSecret(token),
            userId: session.user.id,
            nonceHash: ctx.body.n,
            purpose: ctx.body.purpose,
            createdAt: now,
            expiresAt: new Date(now.getTime() + elevationTtlMs),
          });
          const url = new URL(callback);
          url.searchParams.set("t", token);
          return ctx.json({ url: url.href });
        },
      ),
    },
  } satisfies BetterAuthPlugin;
}
