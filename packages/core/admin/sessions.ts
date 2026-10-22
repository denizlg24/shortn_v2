import { accountSuspension, collection, type Documents } from "@shortn/db";
import { ObjectId, type Db } from "mongodb";
import { randomBytes } from "node:crypto";
import { hashElevationSecret } from "./elevation";
import type { AdminRole } from "./permissions";

export const adminSessionTtlMs = 8 * 60 * 60_000;
export const adminSessionIdleMs = 30 * 60_000;
const touchEveryMs = 60_000;

export const hashUserAgent = (userAgent: string | null | undefined) =>
  hashElevationSecret(userAgent ?? "");

export interface AdminIdentity {
  id: string;
  email: string;
  name?: string | undefined;
  role: AdminRole;
}

type StaffUser = Pick<
  Documents["user"],
  | "_id"
  | "email"
  | "name"
  | "role"
  | "banned"
  | "banReason"
  | "banExpires"
  | "deletion"
  | "deletedAt"
>;

/** Role, ban and deletion are read from the user doc on every request, so
 * demotion or a ban ends console access at once (23 §1.2). */
export async function loadStaff(
  db: Db,
  userId: string,
  now = new Date(),
): Promise<AdminIdentity | null> {
  if (!/^[a-f\d]{24}$/i.test(userId)) return null;
  const user: StaffUser | null = await collection(db, "user").findOne(
    { _id: new ObjectId(userId) },
    {
      projection: {
        email: 1,
        name: 1,
        role: 1,
        banned: 1,
        banReason: 1,
        banExpires: 1,
        deletion: 1,
        deletedAt: 1,
      },
    },
  );
  if (!user || (user.role !== "admin" && user.role !== "superadmin"))
    return null;
  if (accountSuspension(user, now)) return null;
  return {
    id: userId,
    email: user.email,
    ...(user.name ? { name: user.name } : {}),
    role: user.role,
  };
}

export async function createAdminSession(
  db: Db,
  input: {
    userId: string;
    ip?: string | undefined;
    userAgent?: string | null | undefined;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  const token = randomBytes(32).toString("base64url");
  const id = hashElevationSecret(token);
  await collection(db, "admin_sessions").insertOne({
    _id: id,
    userId: input.userId,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + adminSessionTtlMs),
    idleUntil: new Date(now.getTime() + adminSessionIdleMs),
    // Holding a session implies a TOTP check seconds ago (23 §1.4).
    elevatedAt: now,
    ...(input.ip ? { ip: input.ip } : {}),
    uaHash: hashUserAgent(input.userAgent),
  });
  return { token, id, expiresAt: new Date(now.getTime() + adminSessionTtlMs) };
}

export interface ResolvedAdminSession {
  session: { id: string; elevatedAt?: Date | undefined; expiresAt: Date };
  admin: AdminIdentity;
}

/** The guard behind every console request. A session used from another
 * browser (user-agent hash mismatch) or by someone no longer staff is
 * deleted, not just refused. */
export async function resolveAdminSession(
  db: Db,
  token: string,
  request: { userAgent?: string | null | undefined; now?: Date },
): Promise<ResolvedAdminSession | null> {
  if (!token || token.length > 128) return null;
  const now = request.now ?? new Date();
  const sessions = collection(db, "admin_sessions");
  const id = hashElevationSecret(token);
  const session = await sessions.findOne({ _id: id });
  if (!session) return null;
  if (
    session.revokedAt ||
    session.expiresAt <= now ||
    session.idleUntil <= now ||
    session.uaHash !== hashUserAgent(request.userAgent)
  ) {
    await sessions.deleteOne({ _id: id });
    return null;
  }
  const admin = await loadStaff(db, session.userId, now);
  if (!admin) {
    await sessions.deleteMany({ userId: session.userId });
    return null;
  }
  if (now.getTime() - session.lastSeenAt.getTime() >= touchEveryMs)
    await sessions.updateOne(
      { _id: id },
      {
        $set: {
          lastSeenAt: now,
          idleUntil: new Date(
            Math.min(
              now.getTime() + adminSessionIdleMs,
              session.expiresAt.getTime(),
            ),
          ),
        },
      },
    );
  return {
    session: {
      id,
      elevatedAt: session.elevatedAt,
      expiresAt: session.expiresAt,
    },
    admin,
  };
}

/** Step-up (23 §1.1 step 5): only the session's own user can refresh it. */
export async function markAdminSessionElevated(
  db: Db,
  sessionId: string,
  userId: string,
  now = new Date(),
) {
  const result = await collection(db, "admin_sessions").updateOne(
    { _id: sessionId, userId, expiresAt: { $gt: now } },
    { $set: { elevatedAt: now } },
  );
  return result.matchedCount === 1;
}

export async function revokeAdminSession(db: Db, sessionId: string) {
  await collection(db, "admin_sessions").deleteOne({ _id: sessionId });
}

export async function revokeAdminSessionsForUser(db: Db, userId: string) {
  const result = await collection(db, "admin_sessions").deleteMany({ userId });
  return result.deletedCount;
}
