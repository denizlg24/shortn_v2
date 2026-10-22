import {
  collection,
  invalidateAccountStatus,
  physicalNames,
  type AccountStatusCache,
} from "@shortn/db";
import { ObjectId, type Db } from "mongodb";
import { z } from "zod";
import { fail, ok } from "../result";

export interface UserAdminDeps {
  db: Db;
  cache?: AccountStatusCache;
  now?: () => Date;
}

const userIdPattern = /^[a-f\d]{24}$/i;

/** Ends every way the user is currently signed in (23 §3.1). better-auth
 * rows hold userId as a string or an ObjectId depending on who wrote them
 * (F18), so each filter matches both. */
export async function revokeUserSessions(deps: UserAdminDeps, userId: string) {
  if (!userIdPattern.test(userId)) return fail("not_found" as const);
  const ids = { $in: [userId, new ObjectId(userId)] };
  const [sessions, handoffs, accessTokens, refreshTokens, devices, admin] =
    await Promise.all([
      deps.db.collection(physicalNames.session).deleteMany({ userId: ids }),
      deps.db
        .collection(physicalNames.handoff_tokens)
        .deleteMany({ userId: ids }),
      deps.db
        .collection(physicalNames.oauth_access_tokens)
        .deleteMany({ userId: ids }),
      deps.db
        .collection(physicalNames.oauth_refresh_tokens)
        .deleteMany({ userId: ids }),
      deps.db
        .collection(physicalNames.verification)
        .deleteMany({ value: userId, identifier: /^trust-device-/ }),
      collection(deps.db, "admin_sessions").deleteMany({ userId }),
    ]);
  return ok({
    sessions: sessions.deletedCount,
    handoffs: handoffs.deletedCount,
    oauthTokens: accessTokens.deletedCount + refreshTokens.deletedCount,
    trustedDevices: devices.deletedCount,
    adminSessions: admin.deletedCount,
  });
}

const banInput = z
  .object({
    by: z.string().min(1),
    reason: z.string().max(1000).optional(),
    expires: z.date().optional(),
  })
  .strict();

/** Sets the ban, then ends every live session and credential; API keys and
 * MCP tokens are refused on their next request. Mutation only: permission
 * and the write-ahead audit row belong to the admin action (D1). */
export async function banUser(
  deps: UserAdminDeps,
  userId: string,
  input: z.input<typeof banInput>,
) {
  const parsed = banInput.safeParse(input);
  if (!parsed.success) return fail("invalid_input" as const);
  if (!userIdPattern.test(userId)) return fail("not_found" as const);
  const now = deps.now?.() ?? new Date();
  const { by, reason, expires } = parsed.data;
  const cleared = {
    ...(reason ? {} : { banReason: "" as const }),
    ...(expires ? {} : { banExpires: "" as const }),
  };
  const result = await collection(deps.db, "user").updateOne(
    { _id: new ObjectId(userId) },
    {
      $set: {
        banned: true,
        bannedAt: now,
        bannedBy: by,
        ...(reason ? { banReason: reason } : {}),
        ...(expires ? { banExpires: expires } : {}),
      },
      // Mongo rejects an empty $unset.
      ...(Object.keys(cleared).length ? { $unset: cleared } : {}),
    },
  );
  if (!result.matchedCount) return fail("not_found" as const);
  await invalidateAccountStatus(deps.cache, userId);
  const revoked = await revokeUserSessions(deps, userId);
  return revoked.ok ? ok({ revoked: revoked.value }) : revoked;
}

/** Clears the ban; sessions aren't restored and keys simply work again. */
export async function unbanUser(deps: UserAdminDeps, userId: string) {
  if (!userIdPattern.test(userId)) return fail("not_found" as const);
  const result = await collection(deps.db, "user").updateOne(
    { _id: new ObjectId(userId) },
    {
      $unset: {
        banned: "",
        banReason: "",
        banExpires: "",
        bannedAt: "",
        bannedBy: "",
      },
    },
  );
  await invalidateAccountStatus(deps.cache, userId);
  return result.matchedCount ? ok(null) : fail("not_found" as const);
}
