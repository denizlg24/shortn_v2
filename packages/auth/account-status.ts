import {
  accountFlagsProjection,
  accountSuspension,
  collection,
  physicalNames,
  type Documents,
} from "@shortn/db";
import { APIError } from "better-auth/api";
import { ObjectId, type Db } from "mongodb";
import { createHash } from "node:crypto";

export const ACCOUNT_SUSPENDED = "ACCOUNT_SUSPENDED";

// The two-factor plugin deletes the session these paths create when the user
// has TOTP; the real sign-in is the later /two-factor/verify-* session.
const secondFactorPending = new Set([
  "/sign-in/email",
  "/sign-in/username",
  "/sign-in/phone-number",
]);

type UserFlags = Pick<
  Documents["user"],
  | "banned"
  | "banReason"
  | "banExpires"
  | "deletion"
  | "deletedAt"
  | "twoFactorEnabled"
>;

/** Throws ACCOUNT_SUSPENDED; returns whether this sign-in still awaits a
 * second factor (so it isn't recorded as a sign-in yet). */
export async function assertAccountActive(
  db: Db,
  userId: string,
  path: string | undefined,
): Promise<{ awaitingSecondFactor: boolean }> {
  const user = /^[a-f\d]{24}$/i.test(userId)
    ? await db
        .collection<UserFlags & { _id: ObjectId | string }>(physicalNames.user)
        .findOne(
          { _id: { $in: [new ObjectId(userId), userId] } },
          { projection: { ...accountFlagsProjection, twoFactorEnabled: 1 } },
        )
    : null;
  const suspension = user ? accountSuspension(user) : null;
  if (suspension)
    throw new APIError("FORBIDDEN", {
      code: ACCOUNT_SUSPENDED,
      message: "This account is suspended. Contact support@shortn.at.",
      ...(suspension.reason ? { reason: suspension.reason } : {}),
    });
  return {
    awaitingSecondFactor: Boolean(
      user?.twoFactorEnabled && path && secondFactorPending.has(path),
    ),
  };
}

interface CreatedSession {
  userId: string;
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
  geo_country?: unknown;
  impersonatedBy?: unknown;
}

/** Login history for the admin console. Best effort: a failed write never
 * fails the sign-in it describes. */
export async function recordSignIn(
  db: Db,
  session: CreatedSession,
  method: string | undefined,
) {
  try {
    await collection(db, "sign_in_events").insertOne({
      _id: new ObjectId(),
      userId: session.userId,
      at: new Date(),
      method: method ?? "internal",
      ...(session.ipAddress ? { ip: session.ipAddress } : {}),
      ...(typeof session.geo_country === "string"
        ? { country: session.geo_country }
        : {}),
      ...(session.userAgent
        ? {
            uaHash: createHash("sha256")
              .update(session.userAgent)
              .digest("hex"),
          }
        : {}),
      ...(typeof session.impersonatedBy === "string" && session.impersonatedBy
        ? { impersonatedBy: session.impersonatedBy }
        : {}),
    });
  } catch (error) {
    console.error("sign-in event write failed", session.userId, error);
  }
}
