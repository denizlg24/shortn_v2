import { createHash } from "node:crypto";
import { BlockList, isIP } from "node:net";
import { customAlphabet } from "nanoid";
import { ObjectId, type Db, type ClientSession } from "mongodb";
import { collection, findAccountSuspension, type Documents } from "@shortn/db";
import { z } from "zod";
import type { Redis } from "ioredis";
import { can, type Actor } from "../workspaces/authz";
import { workspaceReadOnly } from "../workspaces/status";
import { nowOf, type ServiceContext } from "../workspaces/context";
import { fail, ok } from "../result";

import { apiScopes, type ApiScope } from "./scopes";
export { apiScopes, type ApiScope } from "./scopes";
const randomKey = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  24,
);

function addressRule(
  value: string,
): { address: string; family: "ipv4" | "ipv6"; prefix?: number } | null {
  const parts = value.split("/");
  if (parts.length > 2) return null;
  const address = parts[0] ?? "";
  const version = isIP(address);
  if (!version) return null;
  if (parts.length === 1)
    return { address, family: version === 4 ? "ipv4" : "ipv6" };
  if (!/^\d+$/.test(parts[1] ?? "")) return null;
  const prefix = Number(parts[1]);
  if (prefix > (version === 4 ? 32 : 128)) return null;
  return { address, family: version === 4 ? "ipv4" : "ipv6", prefix };
}

export function apiKeyIpAllowed(
  allowlist: readonly string[] | undefined,
  ip: string | undefined,
): boolean {
  if (!allowlist?.length) return true;
  if (!ip || !isIP(ip)) return false;
  const block = new BlockList();
  for (const value of allowlist) {
    const rule = addressRule(value);
    if (!rule) return false;
    if (rule.prefix === undefined) block.addAddress(rule.address, rule.family);
    else block.addSubnet(rule.address, rule.prefix, rule.family);
  }
  return block.check(ip, isIP(ip) === 4 ? "ipv4" : "ipv6");
}

export const createApiKeyInput = z.object({
  name: z.string().trim().min(1).max(100),
  scopes: z.array(z.enum(apiScopes)).min(1).max(apiScopes.length),
  expiresAt: z.date().optional(),
  ipAllowlist: z
    .array(
      z
        .string()
        .refine(
          (value) => addressRule(value) !== null,
          "Expected an IP address or CIDR",
        ),
    )
    .max(100)
    .optional(),
});

export function hashApiKey(key: string, pepper: string): string {
  if (pepper.length < 32)
    throw new Error("API_KEY_PEPPER must contain at least 32 characters");
  return createHash("sha256")
    .update(key + pepper)
    .digest("hex");
}

type ApiKey = Documents["api_keys"];
export function apiKeyView(key: ApiKey) {
  return {
    id: key._id.toHexString(),
    name: key.name,
    prefix: key.prefix,
    scopes: key.scopes,
    ipAllowlist: key.ipAllowlist ?? [],
    createdBy: key.createdBy,
    createdAt: key.createdAt ?? key._id.getTimestamp(),
    lastUsedAt: key.lastUsedAt ?? null,
    expiresAt: key.expiresAt ?? null,
    revokedAt: key.revokedAt ?? null,
  };
}

export async function createApiKey(
  ctx: ServiceContext,
  input: z.input<typeof createApiKeyInput>,
  pepper: string,
  session?: ClientSession,
) {
  if (!can(ctx.actor, "apiKeys.manage")) return fail("forbidden");
  const parsed = createApiKeyInput.safeParse(input);
  const now = nowOf(ctx);
  if (
    !parsed.success ||
    (parsed.data.expiresAt && parsed.data.expiresAt <= now)
  )
    return fail("invalid_input");
  const secret = `sk_live_${randomKey()}`;
  const doc: ApiKey = {
    _id: new ObjectId(),
    workspaceId: ctx.workspace._id,
    ...parsed.data,
    scopes: [...new Set(parsed.data.scopes)],
    hashedKey: hashApiKey(secret, pepper),
    prefix: `${secret.slice(0, 12)}…`,
    createdBy: ctx.actor.userId,
    createdAt: now,
    updatedAt: now,
  };
  await collection(ctx.db, "api_keys").insertOne(
    doc,
    session ? { session } : {},
  );
  return ok({ key: apiKeyView(doc), secret });
}

export async function listApiKeys(
  ctx: ServiceContext,
  before?: string,
  limit = 50,
) {
  // Whoever may revoke keys may see them, including under a staff lock.
  if (!can(ctx.actor, "apiKeys.revoke")) return fail("forbidden");
  if (before && !/^[a-f\d]{24}$/i.test(before)) return fail("invalid_input");
  const size = Math.max(1, Math.min(100, Math.floor(limit) || 50));
  const rows = await collection(ctx.db, "api_keys")
    .find({
      workspaceId: ctx.workspace._id,
      ...(before ? { _id: { $lt: new ObjectId(before) } } : {}),
    })
    .sort({ _id: -1 })
    .limit(size + 1)
    .toArray();
  return ok({
    items: rows.slice(0, size).map(apiKeyView),
    nextCursor: rows.length > size ? rows[size - 1]!._id.toHexString() : null,
  });
}

export async function revokeApiKey(ctx: ServiceContext, id: string) {
  if (!can(ctx.actor, "apiKeys.revoke")) return fail("forbidden");
  if (!/^[a-f\d]{24}$/i.test(id)) return fail("not_found");
  const result = await collection(ctx.db, "api_keys").updateOne(
    { _id: new ObjectId(id), workspaceId: ctx.workspace._id },
    { $set: { revokedAt: nowOf(ctx), updatedAt: nowOf(ctx) } },
  );
  return result.matchedCount ? ok({ id }) : fail("not_found");
}

export async function rollApiKey(
  ctx: ServiceContext,
  id: string,
  pepper: string,
) {
  if (!can(ctx.actor, "apiKeys.manage")) return fail("forbidden");
  if (!/^[a-f\d]{24}$/i.test(id)) return fail("not_found");
  const session = ctx.db.client.startSession();
  try {
    return await session.withTransaction(async () => {
      const keys = collection(ctx.db, "api_keys");
      const key = await keys.findOne(
        {
          _id: new ObjectId(id),
          workspaceId: ctx.workspace._id,
          revokedAt: { $exists: false },
        },
        { session },
      );
      if (!key) return fail("not_found");
      const created = await createApiKey(
        ctx,
        {
          name: key.name,
          scopes: key.scopes.filter((scope): scope is ApiScope =>
            apiScopes.some((known) => known === scope),
          ),
          ...(key.expiresAt ? { expiresAt: key.expiresAt } : {}),
          ...(key.ipAllowlist ? { ipAllowlist: key.ipAllowlist } : {}),
        },
        pepper,
        session,
      );
      if (!created.ok) return created;
      await keys.updateOne(
        { _id: key._id },
        { $set: { revokedAt: nowOf(ctx), updatedAt: nowOf(ctx) } },
        { session },
      );
      return created;
    });
  } finally {
    await session.endSession();
  }
}

export interface ApiPrincipal {
  keyId: string;
  scopes: readonly string[];
  actor: Actor;
  workspace: Documents["workspaces"];
}

export function hasApiScope(
  principal: Pick<ApiPrincipal, "scopes">,
  scope: ApiScope,
): boolean {
  return (
    principal.scopes.includes(scope) ||
    principal.scopes.includes(`${scope.split(":")[0]}:*`)
  );
}

// Read the key and membership on every request: revocation and role changes
// take effect without waiting for a cache TTL or invalidation delivery.
export async function authenticateApiKey(
  db: Db,
  bearer: string,
  pepper: string,
  ip?: string,
  now = new Date(),
  usageCache?: Pick<Redis, "set" | "del">,
) {
  if (!/^sk_live_[A-Za-z0-9]{24}$/.test(bearer)) return fail("unauthorized");
  const key = await collection(db, "api_keys").findOne({
    hashedKey: hashApiKey(bearer, pepper),
  });
  if (
    !key ||
    key.revokedAt ||
    (key.expiresAt && key.expiresAt <= now) ||
    !apiKeyIpAllowed(key.ipAllowlist, ip)
  )
    return fail("unauthorized");
  const [member, workspace, suspension] = await Promise.all([
    collection(db, "workspace_members").findOne({
      workspaceId: key.workspaceId,
      userId: key.createdBy,
    }),
    collection(db, "workspaces").findOne({ _id: key.workspaceId }),
    findAccountSuspension(db, key.createdBy, now),
  ]);
  if (!member || !workspace || suspension) return fail("unauthorized");
  const usageKey = `apikey:last-used:${key._id.toHexString()}`;
  let recordUse = true;
  if (usageCache) {
    try {
      recordUse =
        (await usageCache.set(usageKey, "1", "EX", 60, "NX")) === "OK";
    } catch {
      /* The throttle is an optimization; Mongo still bounds writes. */
    }
  }
  if (recordUse) {
    try {
      await collection(db, "api_keys").updateOne(
        {
          _id: key._id,
          $or: [
            { lastUsedAt: { $exists: false } },
            { lastUsedAt: { $lte: new Date(now.getTime() - 60_000) } },
          ],
        },
        { $set: { lastUsedAt: now } },
      );
    } catch (error) {
      if (usageCache) await usageCache.del(usageKey).catch(() => undefined);
      throw error;
    }
  }
  const actor: Actor = {
    userId: member.userId,
    role: member.role,
    readOnly: workspaceReadOnly(workspace),
  };
  return ok({
    keyId: key._id.toHexString(),
    scopes: key.scopes,
    actor,
    workspace,
  } satisfies ApiPrincipal);
}
