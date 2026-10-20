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

/** Only `banned === true` blocks, so a malformed flag can't lock users out. A
 * ban without `banExpires` is permanent; an expired one is ignored, not cleared. */
export function accountSuspension(
  user: AccountFlags,
  now = new Date(),
): AccountSuspension | null {
  if (user.deletion || user.deletedAt) return { kind: "deleted" };
  if (user.banned !== true) return null;
  if (user.banExpires && user.banExpires.getTime() <= now.getTime())
    return null;
  return {
    kind: "banned",
    ...(user.banReason ? { reason: user.banReason } : {}),
  };
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
