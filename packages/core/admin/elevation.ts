import { accountSuspension, collection, type Documents } from "@shortn/db";
import { createHash, timingSafeEqual } from "node:crypto";
import type { Db } from "mongodb";

/** Elevation tokens and login nonces are stored and compared as sha256. */
export const hashElevationSecret = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export const elevationTtlMs = 60_000;

export type ElevationRefusal =
  "not_staff" | "account_suspended" | "email_not_verified" | "totp_required";

/** Who may elevate into the admin console (23 §1.1 step 2); re-checked on
 * every step. Impersonation is the caller's check: it lives on the session. */
export function adminElevationRefusal(
  user: Pick<
    Documents["user"],
    | "role"
    | "banned"
    | "banReason"
    | "banExpires"
    | "deletion"
    | "deletedAt"
    | "emailVerified"
    | "twoFactorEnabled"
  >,
  now = new Date(),
): ElevationRefusal | null {
  if (user.role !== "admin" && user.role !== "superadmin") return "not_staff";
  if (accountSuspension(user, now)) return "account_suspended";
  if (user.emailVerified !== true) return "email_not_verified";
  if (user.twoFactorEnabled !== true) return "totp_required";
  return null;
}

/** The admin callback's half (23 §1.1 step 4): a token works once, within
 * its 60 s, and only in the browser holding the nonce that started it. A
 * wrong nonce still burns the token. */
export async function consumeAdminElevation(
  db: Db,
  token: string,
  nonce: string,
  now = new Date(),
) {
  const found = await collection(db, "admin_elevation_tokens").findOneAndDelete(
    { _id: hashElevationSecret(token), expiresAt: { $gt: now } },
  );
  if (!found) return null;
  const expected = Buffer.from(found.nonceHash),
    actual = Buffer.from(hashElevationSecret(nonce));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    return null;
  return { userId: found.userId, purpose: found.purpose };
}
