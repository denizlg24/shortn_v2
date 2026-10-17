import { collection, physicalNames } from "@shortn/db";
import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import { symmetricDecrypt } from "better-auth/crypto";
import { ObjectId, type Db } from "mongodb";
import { createHmac, timingSafeEqual } from "node:crypto";

export async function advancedAuthAvailable(db: Db, userId: string) {
  // Join on the server; eligibility follows current canonical membership.
  return (
    (
      await collection(db, "workspace_members")
        .aggregate([
          { $match: { userId } },
          {
            $lookup: {
              from: physicalNames.workspaces,
              localField: "workspaceId",
              foreignField: "_id",
              as: "workspace",
            },
          },
          { $match: { "workspace.platformFeatures.advancedAuth": true } },
          { $limit: 1 },
          { $project: { _id: 1 } },
        ])
        .toArray()
    ).length > 0
  );
}

function matchingTotpStep(secret: string, code: string, now: number) {
  if (!/^\d{6}$/.test(code)) return null;
  const current = Math.floor(now / 30000);
  let matched: number | null = null;
  for (let step = current - 1; step <= current + 1; step++) {
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(step));
    const digest = createHmac("sha1", secret).update(counter).digest();
    const offset = digest[digest.length - 1]! & 15;
    const value = ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000)
      .toString()
      .padStart(6, "0");
    if (timingSafeEqual(Buffer.from(code), Buffer.from(value))) matched = step;
  }
  return matched;
}

export function twoFactorPolicy(db: () => Db): BetterAuthPlugin {
  return {
    id: "shortn-two-factor-policy",
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path?.startsWith("/two-factor/") ?? false,
          handler: createAuthMiddleware(async (ctx) => {
            if (ctx.body?.trustDevice === true)
              throw new APIError("BAD_REQUEST", {
                code: "TRUSTED_DEVICES_UNAVAILABLE",
                message: "Verify each password sign-in",
              });
            const session = await getSessionFromCtx(ctx);
            const managing = [
              "/two-factor/enable",
              "/two-factor/disable",
              "/two-factor/generate-backup-codes",
              "/two-factor/get-totp-uri",
            ].includes(ctx.path!);
            if (managing) {
              if (!session) throw new APIError("UNAUTHORIZED");
              if (Reflect.get(session.session, "impersonatedBy"))
                throw new APIError("FORBIDDEN");
              if (
                Date.now() - new Date(session.session.createdAt).getTime() >
                300000
              )
                throw new APIError("FORBIDDEN", {
                  code: "SESSION_IS_NOT_FRESH",
                  message: "Sign in again before changing account security",
                });
              if (!session.user.emailVerified)
                throw new APIError("FORBIDDEN", {
                  code: "EMAIL_NOT_VERIFIED",
                  message: "Verify your email first",
                });
              if (
                ctx.path === "/two-factor/enable" &&
                !(await advancedAuthAvailable(db(), session.user.id))
              )
                throw new APIError("FORBIDDEN", {
                  code: "ADVANCED_AUTH_UNAVAILABLE",
                  message:
                    "Account security is not available in your workspaces",
                });
              if (
                ctx.path === "/two-factor/get-totp-uri" &&
                Reflect.get(session.user, "twoFactorEnabled")
              )
                throw new APIError("FORBIDDEN", {
                  code: "TOTP_ALREADY_ENABLED",
                  message: "An active authenticator secret cannot be exported",
                });
            }
            if (
              ctx.path !== "/two-factor/verify-totp" ||
              typeof ctx.body?.code !== "string"
            )
              return;
            if (
              session &&
              !Reflect.get(session.user, "twoFactorEnabled") &&
              (!session.user.emailVerified ||
                !(await advancedAuthAvailable(db(), session.user.id)))
            )
              throw new APIError("FORBIDDEN", {
                code: "ADVANCED_AUTH_UNAVAILABLE",
                message: "Authenticator enrollment is unavailable",
              });
            let userId = session?.user.id;
            if (!userId) {
              const cookie = ctx.context.createAuthCookie("two_factor");
              const identifier = await ctx.getSignedCookie(
                cookie.name,
                ctx.context.secret,
              );
              if (!identifier) return;
              const challenge =
                await ctx.context.internalAdapter.findVerificationValue(
                  identifier,
                );
              if (!challenge || challenge.expiresAt <= new Date()) return;
              userId = challenge.value;
            }
            if (!ObjectId.isValid(userId)) return;
            const factors = db().collection(physicalNames.two_factor);
            const factor = await factors.findOne({
              userId: { $in: [userId, new ObjectId(userId)] },
            });
            if (!factor || typeof factor.secret !== "string") return;
            const secret = await symmetricDecrypt({
              key: ctx.context.secretConfig,
              data: factor.secret,
            });
            const step = matchingTotpStep(secret, ctx.body.code, Date.now());
            // Invalid codes still reach the upstream challenge/account lockout.
            if (step === null) return;
            const claimed = await factors.updateOne(
              {
                _id: factor._id,
                $or: [
                  { lastTotpStep: { $exists: false } },
                  { lastTotpStep: { $lt: step } },
                ],
              },
              { $set: { lastTotpStep: step } },
            );
            if (!claimed.modifiedCount)
              throw new APIError("UNAUTHORIZED", {
                code: "TOTP_ALREADY_USED",
                message: "Wait for a new authenticator code",
              });
          }),
        },
      ],
    },
  };
}
