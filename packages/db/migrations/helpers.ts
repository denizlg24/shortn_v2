import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";
import type { Document } from "mongodb";
import { physicalNames } from "../collections";
import type { MigrationContext, VerifyReport } from "./runner";

export const names = physicalNames;
export const linkDomain = "shortn.at";
export const orphanWorkspaceSlug = "orphaned-legacy-data";

function canonical(value: unknown): unknown {
  if (value instanceof ObjectId) return value.toHexString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(Reflect.get(value, key))]),
    );
  return value;
}

// Hash of the legacy inputs a derivation read; a continuous run rewrites a
// document only when its inputs changed since the last sync (02 §3a.4).
export const stableHash = (value: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(value)) ?? "null")
    .digest("hex")
    .slice(0, 32);

export function report(
  counts: Record<string, number>,
  discrepancies: string[],
  samples: Document[] = [],
): VerifyReport {
  return {
    ok: discrepancies.length === 0,
    counts,
    samples: samples.slice(0, 20),
    discrepancies: discrepancies.slice(0, 50),
  };
}

export const str = (value: unknown) =>
  typeof value === "string" ? value : undefined;

export const oid = (value: unknown) =>
  value instanceof ObjectId ? value : undefined;

export async function workspaceMaps(ctx: MigrationContext) {
  const workspaces = await ctx
    .read(names.workspaces)
    .find(
      {},
      {
        projection: {
          _id: 1,
          legacySub: 1,
          ownerUserId: 1,
          personal: 1,
          slug: 1,
        },
      },
    )
    .toArray();
  const bySub = new Map<string, ObjectId>();
  const byUserId = new Map<string, ObjectId>();
  let orphan: ObjectId | undefined;
  for (const workspace of workspaces) {
    const id = oid(workspace._id);
    if (!id) continue;
    if (workspace.slug === orphanWorkspaceSlug) orphan = id;
    if (!workspace.personal) continue;
    const sub = str(workspace.legacySub);
    const owner = str(workspace.ownerUserId);
    if (sub) bySub.set(sub, id);
    if (owner) byUserId.set(owner, id);
  }
  return { bySub, byUserId, orphan };
}

export async function existing(ctx: MigrationContext, collections: string[]) {
  const present: string[] = [];
  for (const name of collections)
    if (await ctx.exists(name)) present.push(name);
  return present;
}

export const isPinataUrl = (url: string | undefined) =>
  Boolean(
    url &&
    /^https?:\/\/[^/]*(mypinata\.cloud|pinata\.cloud|ipfs\.io)\//i.test(url),
  );

export async function assetMap(ctx: MigrationContext) {
  if (!(await ctx.exists(names.asset_migrations)))
    return new Map<string, string>();
  const rows = await ctx
    .read(names.asset_migrations)
    .find({}, { projection: { sourceUrl: 1, targetUrl: 1 } })
    .toArray();
  return new Map(
    rows.flatMap((row) => {
      const source = str(row.sourceUrl);
      const target = str(row.targetUrl);
      return source && target ? [[source, target] as const] : [];
    }),
  );
}
