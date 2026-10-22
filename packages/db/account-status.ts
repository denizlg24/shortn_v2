import { ObjectId, type Db } from "mongodb";
import { physicalNames } from "./collections";
import type { Documents } from "./schemas";

type AccountFlags = Pick<
  Documents["user"],
  "banned" | "banReason" | "banExpires" | "deletion" | "deletedAt"
>;

export interface AccountSuspension {
  kind: "banned" | "deleted";
  reason?: string;
}

export const accountFlagsProjection = {
  banned: 1,
  banReason: 1,
  banExpires: 1,
  deletion: 1,
  deletedAt: 1,
} as const;

// Fields arrive from Mongo as written, which may predate or bypass the
// schema, so they're read as unknown and checked here.
type AccountFlagValues = { [K in keyof AccountFlags]?: unknown };

/** Only `banned === true` blocks, so a malformed flag can't lock users out. A
 * ban without a valid `banExpires` date is permanent; an expired one is
 * ignored, not cleared. Never throws. */
export function accountSuspension(
  user: AccountFlagValues,
  now = new Date(),
): AccountSuspension | null {
  if (user.deletion || user.deletedAt) return { kind: "deleted" };
  if (user.banned !== true) return null;
  const expires = user.banExpires;
  if (
    expires instanceof Date &&
    Number.isFinite(expires.getTime()) &&
    expires.getTime() <= now.getTime()
  )
    return null;
  return {
    kind: "banned",
    ...(typeof user.banReason === "string" && user.banReason
      ? { reason: user.banReason }
      : {}),
  };
}

/** The cache Redis subset the session-path check needs (ioredis fits). */
export interface AccountStatusCache {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    mode: "EX",
    seconds: number,
  ): Promise<unknown>;
  del(key: string): Promise<number>;
}

export const accountStatusKey = (userId: string) => `account-status:${userId}`;
const accountStatusTtl = 60;

/** Forgets a cached account status; every write of a ban, unban or
 * deletion flag calls it so live sessions see the change at once. */
export async function invalidateAccountStatus(
  cache: AccountStatusCache | undefined,
  userId: string,
) {
  await cache?.del(accountStatusKey(userId));
}

/** The status check for requests carrying an existing session, cached for a
 * minute. A Redis failure falls back to Mongo rather than letting a banned
 * session through. */
export async function cachedAccountSuspension(
  db: Db,
  cache: AccountStatusCache | undefined,
  userId: string,
  now = new Date(),
): Promise<AccountSuspension | null> {
  const key = accountStatusKey(userId);
  const cached = await cache?.get(key).catch(() => null);
  if (cached === "active") return null;
  if (cached) {
    try {
      const parsed: unknown = JSON.parse(cached);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "kind" in parsed &&
        (parsed.kind === "banned" || parsed.kind === "deleted")
      )
        return {
          kind: parsed.kind,
          ...("reason" in parsed && typeof parsed.reason === "string"
            ? { reason: parsed.reason }
            : {}),
        };
    } catch {
      /* A malformed entry is replaced below. */
    }
  }
  const user = /^[a-f\d]{24}$/i.test(userId)
    ? await db
        .collection<AccountFlags & { _id: ObjectId | string }>(
          physicalNames.user,
        )
        .findOne(
          { _id: { $in: [new ObjectId(userId), userId] } },
          { projection: accountFlagsProjection },
        )
    : null;
  const suspension = user ? accountSuspension(user, now) : null;
  // A timed ban must not stay cached past its expiry.
  const expires = user?.banExpires;
  const ttl =
    suspension?.kind === "banned" &&
    expires instanceof Date &&
    Number.isFinite(expires.getTime())
      ? Math.max(
          1,
          Math.min(
            accountStatusTtl,
            Math.ceil((expires.getTime() - now.getTime()) / 1000),
          ),
        )
      : accountStatusTtl;
  await cache
    ?.set(key, suspension ? JSON.stringify(suspension) : "active", "EX", ttl)
    .catch(() => undefined);
  return suspension;
}

/** For a request that arrived with a session: if the account has been
 * suspended since sign-in, delete the session and report it gone, so every
 * caller treats the request as signed out. */
export async function endSuspendedSession(
  db: Db,
  cache: AccountStatusCache | undefined,
  session: { session: { id: string }; user: { id: string } },
) {
  if (!(await cachedAccountSuspension(db, cache, session.user.id)))
    return false;
  if (/^[a-f\d]{24}$/i.test(session.session.id))
    await db
      .collection(physicalNames.session)
      .deleteOne({ _id: new ObjectId(session.session.id) });
  return true;
}

/** Shared by the new app, legacy and the API/MCP authenticators. An unknown
 * user isn't suspended here: the caller's own lookup decides that. */
export async function findAccountSuspension(
  db: Db,
  userId: string,
  now = new Date(),
): Promise<AccountSuspension | null> {
  if (!/^[a-f\d]{24}$/i.test(userId)) return null;
  const user = await db
    .collection<AccountFlags & { _id: ObjectId | string }>(physicalNames.user)
    .findOne(
      { _id: { $in: [new ObjectId(userId), userId] } },
      { projection: accountFlagsProjection },
    );
  return user ? accountSuspension(user, now) : null;
}
