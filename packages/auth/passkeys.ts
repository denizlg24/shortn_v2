import { randomUUID } from "node:crypto";
import { passkey } from "@better-auth/passkey";
import { physicalNames } from "@shortn/db";
import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import { deleteSessionCookie } from "better-auth/cookies";
import { ObjectId, type Db } from "mongodb";
import { advancedAuthAvailable } from "./two-factor";

export async function passkeySessionActive(
  db: Db,
  passkeyId: unknown,
  userId: string,
) {
  if (passkeyId == null) return true;
  if (
    typeof passkeyId !== "string" ||
    !/^[a-f\d]{24}$/i.test(passkeyId) ||
    !ObjectId.isValid(userId)
  )
    return false;
  return Boolean(
    await db.collection(physicalNames.passkeys).findOne(
      {
        _id: new ObjectId(passkeyId),
        userId: { $in: [userId, new ObjectId(userId)] },
      },
      { projection: { _id: 1 } },
    ),
  );
}

export function passkeyPlugins(config: {
  db: () => Db;
  baseURL: string;
  socialProviders: string[];
}) {
  const origin = new URL(config.baseURL);
  const plugin = passkey({
    rpID: origin.hostname,
    rpName: "Shortn",
    origin: origin.origin,
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
    schema: { passkey: { modelName: physicalNames.passkeys } },
    registration: {
      requireSession: true,
      afterVerification: async ({ verification }) => {
        if (!verification.registrationInfo?.userVerified)
          throw new APIError("FORBIDDEN", {
            code: "USER_VERIFICATION_REQUIRED",
            message: "Verify with your device before adding a passkey",
          });
      },
    },
    authentication: {
      afterVerification: async ({ verification, clientData }) => {
        if (!verification.authenticationInfo.userVerified)
          throw new APIError("FORBIDDEN", {
            code: "USER_VERIFICATION_REQUIRED",
            message: "Verify with your device before signing in",
          });
        const keys = config.db().collection(physicalNames.passkeys);
        const key = await keys.findOne({ credentialID: clientData.id });
        if (!key) throw new APIError("UNAUTHORIZED");
        const user = await config
          .db()
          .collection(physicalNames.user)
          .findOne(
            { _id: new ObjectId(String(key.userId)), emailVerified: true },
            { projection: { _id: 1 } },
          );
        if (!user)
          throw new APIError("UNAUTHORIZED", {
            code: "EMAIL_NOT_VERIFIED",
            message: "Verify your email before signing in",
          });
        const counter = verification.authenticationInfo.newCounter;
        // Zero is valid for synced credentials. Nonzero device counters have
        // a separate atomic watermark, so concurrent plugin updates cannot
        // lower the last verified value or admit the same counter twice.
        if (counter > 0) {
          const claimed = await keys.updateOne(
            {
              _id: key._id,
              $or: [
                { lastVerifiedCounter: { $exists: false } },
                { lastVerifiedCounter: { $lt: counter } },
              ],
            },
            { $set: { lastVerifiedCounter: counter } },
          );
          if (!claimed.modifiedCount)
            throw new APIError("UNAUTHORIZED", {
              code: "PASSKEY_COUNTER_REPLAY",
              message: "This passkey response has already been used",
            });
        }
      },
    },
  });
  const policy: BetterAuthPlugin = {
    id: "shortn-passkey-policy",
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path?.startsWith("/passkey/") ?? false,
          handler: createAuthMiddleware(async (ctx) => {
            const enrolling = [
              "/passkey/generate-register-options",
              "/passkey/verify-registration",
            ].includes(ctx.path!);
            const managing =
              enrolling ||
              ["/passkey/update-passkey", "/passkey/delete-passkey"].includes(
                ctx.path!,
              );
            if (!managing) return;
            const session = await getSessionFromCtx(ctx);
            if (!session) throw new APIError("UNAUTHORIZED");
            if (Reflect.get(session.session, "impersonatedBy"))
              throw new APIError("FORBIDDEN");
            if (
              Date.now() - new Date(session.session.createdAt).getTime() >
              300000
            )
              throw new APIError("FORBIDDEN", {
                code: "SESSION_IS_NOT_FRESH",
                message: "Sign in again before changing passkeys",
              });
            if (!session.user.emailVerified)
              throw new APIError("FORBIDDEN", {
                code: "EMAIL_NOT_VERIFIED",
                message: "Verify your email first",
              });
            if (
              enrolling &&
              !(await advancedAuthAvailable(config.db(), session.user.id))
            )
              throw new APIError("FORBIDDEN", {
                code: "ADVANCED_AUTH_UNAVAILABLE",
                message: "Passkey enrollment is unavailable in your workspaces",
              });
            const rawName = ctx.body?.name ?? ctx.query?.name;
            if (rawName !== undefined) {
              if (
                typeof rawName !== "string" ||
                !rawName.trim() ||
                rawName.normalize("NFC").trim().length > 64 ||
                /[\p{Cc}\p{Cf}]/u.test(rawName)
              )
                throw new APIError("BAD_REQUEST", {
                  code: "PASSKEY_NAME_INVALID",
                  message: "Use a passkey name between 1 and 64 characters",
                });
              if (ctx.body?.name !== undefined)
                ctx.body.name = rawName.normalize("NFC").trim();
            }
            if (ctx.path === "/passkey/delete-passkey") {
              // Serialize removals across processes: two simultaneous requests
              // must not both observe the other credential as a fallback.
              const lease = randomUUID(),
                users = config.db().collection(physicalNames.user);
              const claimed = await users.updateOne(
                {
                  _id: new ObjectId(session.user.id),
                  $or: [
                    { "passkeyRemoval.expiresAt": { $exists: false } },
                    { "passkeyRemoval.expiresAt": { $lte: new Date() } },
                  ],
                },
                {
                  $set: {
                    passkeyRemoval: {
                      lease,
                      expiresAt: new Date(Date.now() + 120000),
                    },
                  },
                },
              );
              if (!claimed.modifiedCount)
                throw new APIError("CONFLICT", {
                  code: "PASSKEY_REMOVAL_BUSY",
                  message: "Another passkey removal is in progress. Try again",
                });
              try {
                const userIds = [
                  session.user.id,
                  new ObjectId(session.user.id),
                ];
                const accounts = await config
                  .db()
                  .collection(physicalNames.account)
                  .countDocuments({
                    userId: { $in: userIds },
                    $or: [
                      {
                        providerId: "credential",
                        password: { $type: "string", $ne: "" },
                      },
                      { providerId: { $in: config.socialProviders } },
                    ],
                  });
                if (
                  !accounts &&
                  (await config
                    .db()
                    .collection(physicalNames.passkeys)
                    .countDocuments({ userId: { $in: userIds } })) <= 1
                )
                  throw new APIError("FORBIDDEN", {
                    code: "LAST_SIGN_IN_METHOD",
                    message:
                      "Add another passkey or password before removing your last sign-in method",
                  });
                Reflect.set(ctx.context, "shortnPasskeyRemoval", {
                  userId: session.user.id,
                  lease,
                });
              } catch (error) {
                await users.updateOne(
                  {
                    _id: new ObjectId(session.user.id),
                    "passkeyRemoval.lease": lease,
                  },
                  { $unset: { passkeyRemoval: "" } },
                );
                throw error;
              }
            }
          }),
        },
      ],
      after: [
        {
          matcher: (ctx) =>
            [
              "/passkey/generate-authenticate-options",
              "/passkey/delete-passkey",
              "/get-session",
            ].includes(ctx.path ?? ""),
          handler: createAuthMiddleware(async (ctx) => {
            if (ctx.path === "/passkey/delete-passkey") {
              const removal = Reflect.get(
                ctx.context,
                "shortnPasskeyRemoval",
              ) as { userId: string; lease: string } | undefined;
              if (removal)
                await config
                  .db()
                  .collection(physicalNames.user)
                  .updateOne(
                    {
                      _id: new ObjectId(removal.userId),
                      "passkeyRemoval.lease": removal.lease,
                    },
                    { $unset: { passkeyRemoval: "" } },
                  );
            }
            const result = ctx.context.returned;
            if (
              !result ||
              typeof result !== "object" ||
              result instanceof APIError
            )
              return;
            if (
              ctx.path === "/passkey/generate-authenticate-options" &&
              typeof Reflect.get(result, "challenge") === "string"
            )
              return ctx.json({ ...result, userVerification: "required" });
            if (
              ctx.path === "/passkey/delete-passkey" &&
              Reflect.get(result, "status") === true
            ) {
              const session = ctx.context.session;
              if (!session) return;
              const sessions = await ctx.context.internalAdapter.listSessions(
                session.user.id,
              );
              await Promise.all(
                sessions.map((item) =>
                  ctx.context.internalAdapter.deleteSession(item.token),
                ),
              );
              deleteSessionCookie(ctx, true);
              return;
            }
            if (ctx.path === "/get-session") {
              const session: unknown = Reflect.get(result, "session");
              if (!session || typeof session !== "object") return;
              const userId = Reflect.get(session, "userId"),
                token = Reflect.get(session, "token");
              if (
                typeof userId === "string" &&
                !(await passkeySessionActive(
                  config.db(),
                  Reflect.get(session, "passkeyId"),
                  userId,
                ))
              ) {
                if (typeof token === "string")
                  await ctx.context.internalAdapter.deleteSession(token);
                deleteSessionCookie(ctx, true);
                return ctx.json(null);
              }
            }
          }),
        },
      ],
    },
  };
  return [plugin, policy] as const;
}
