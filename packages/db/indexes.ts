import { physicalNames, legacyCollectionKeys } from "./collections";
import type { PhysicalNames } from "./collections";
import { isDeepStrictEqual } from "node:util";
import type { Db, IndexDescription, IndexDescriptionInfo } from "mongodb";
export const legacyCollections = legacyCollectionKeys.map(
  (key) => physicalNames[key],
);
const imageCollections = [
  "links",
  "qr_codes",
  "bio_pages",
  "campaigns",
  "tags",
] as const;
const partial = (field: string) => ({
  partialFilterExpression: { [field]: { $type: "string" } },
});
export const desiredIndexes: Record<string, IndexDescription[]> = {
  [physicalNames.links]: [
    {
      name: "v2_domain_key",
      key: { domain: 1, key: 1 },
      unique: true,
      ...partial("key"),
    },
    { name: "v2_legacy_code", key: { urlCode: 1 } },
    { name: "v2_previous_keys", key: { domain: 1, previousKeys: 1 } },
    {
      name: "v2_workspace_created",
      key: { workspaceId: 1, createdAt: -1, _id: -1 },
    },
    { name: "v2_workspace_tags", key: { workspaceId: 1, tagIds: 1 } },
    { name: "v2_workspace_campaign", key: { workspaceId: 1, campaignId: 1 } },
  ],
  [physicalNames.qr_codes]: [
    {
      name: "v2_public_id",
      key: { publicId: 1 },
      unique: true,
      ...partial("publicId"),
    },
    { name: "v2_qr_link", key: { linkId: 1 } },
  ],
  [physicalNames.click_events]: [
    { name: "v2_link_time", key: { "m.linkId": 1, ts: -1 } },
    { name: "v2_event_sid", key: { sid: 1 } },
    { name: "v2_event_legacy_id", key: { legacyId: 1 } },
  ],
  [physicalNames.clicks]: [
    { name: "v2_click_sid", key: { sid: 1 }, ...partial("sid") },
  ],
  [physicalNames.click_ips]: [
    { name: "v2_ip_ttl", key: { ts: 1 }, expireAfterSeconds: 90 * 86_400 },
    { name: "v2_ip_sid", key: { sid: 1 }, unique: true, ...partial("sid") },
    {
      name: "v2_ip_legacy_id",
      key: { legacyId: 1 },
      unique: true,
      partialFilterExpression: { legacyId: { $type: "objectId" } },
    },
  ],
  [physicalNames.code_conflicts]: [
    { name: "v2_conflict_link", key: { linkId: 1 }, unique: true },
  ],
  [physicalNames.asset_migrations]: [
    { name: "v2_asset_source", key: { sourceUrl: 1 }, unique: true },
  ],
  [physicalNames.click_rollups]: [
    { name: "v2_link_day", key: { linkId: 1, day: 1 }, unique: true },
    { name: "v2_workspace_day", key: { workspaceId: 1, day: 1 } },
  ],
  [physicalNames.workspaces]: [
    { name: "v2_workspace_slug", key: { slug: 1 }, unique: true },
    {
      name: "v2_personal_owner",
      key: { ownerUserId: 1 },
      unique: true,
      partialFilterExpression: { personal: true },
    },
    { name: "v2_legacy_sub", key: { legacySub: 1 } },
  ],
  [physicalNames.workspace_members]: [
    { name: "v2_membership", key: { workspaceId: 1, userId: 1 }, unique: true },
  ],
  [physicalNames.tags]: [
    {
      name: "v2_tag_name",
      key: { workspaceId: 1, nameLower: 1 },
      unique: true,
      ...partial("nameLower"),
    },
  ],
  [physicalNames.campaigns]: [
    { name: "v2_workspace_campaigns", key: { workspaceId: 1, createdAt: -1 } },
  ],
  [physicalNames.bio_pages]: [
    {
      name: "v2_bio_handle",
      key: { handle: 1 },
      unique: true,
      ...partial("handle"),
    },
    {
      name: "v2_bio_domain",
      key: { customDomain: 1 },
      unique: true,
      ...partial("customDomain"),
    },
  ],
  [physicalNames.bio_aliases]: [
    { name: "v2_bio_alias", key: { slug: 1 }, unique: true },
  ],
  [physicalNames.domains]: [
    { name: "v2_hostname", key: { hostname: 1 }, unique: true },
  ],
  [physicalNames.subscriptions]: [
    {
      name: "v2_polar_subscription",
      key: { polarSubscriptionId: 1 },
      unique: true,
    },
  ],
  [physicalNames.usage_periods]: [
    {
      name: "v2_workspace_period",
      key: { workspaceId: 1, period: 1 },
      unique: true,
    },
  ],
  [physicalNames.api_keys]: [
    { name: "v2_hashed_key", key: { hashedKey: 1 }, unique: true },
  ],
};
export function equivalentIndex(
  desired: IndexDescription,
  existing: IndexDescriptionInfo,
): boolean {
  return (
    JSON.stringify(desired.key) === JSON.stringify(existing.key) &&
    Boolean(desired.unique) === Boolean(existing.unique) &&
    Boolean(desired.sparse) === Boolean(existing.sparse) &&
    isDeepStrictEqual(
      desired.partialFilterExpression ?? {},
      existing.partialFilterExpression ?? {},
    ) &&
    isDeepStrictEqual(desired.collation ?? {}, existing.collation ?? {}) &&
    desired.expireAfterSeconds === existing.expireAfterSeconds
  );
}
export async function syncIndexes(
  db: Db,
  options: {
    dryRun?: boolean;
    log?: (message: string) => void;
    physicalNames?: PhysicalNames;
  } = {},
) {
  const log = options.log ?? console.log;
  const present = await db.listCollections({}, { nameOnly: false }).toArray();
  const names = options.physicalNames ?? physicalNames;
  for (const key of legacyCollectionKeys)
    if (!present.some((item) => item.name === names[key]))
      throw new Error(
        `Missing legacy collection: ${names[key]}; refusing index sync`,
      );
  for (const [original, desired] of Object.entries(desiredIndexes)) {
    const key = Object.entries(physicalNames).find(
      ([, name]) => name === original,
    )?.[0];
    const name = key
      ? (Object.entries(names).find(([candidate]) => candidate === key)?.[1] ??
        original)
      : original;
    const info = present.find((item) => item.name === name);
    if (!info && !options.dryRun) {
      if (name === names.click_events)
        await db.createCollection(name, {
          timeseries: {
            timeField: "ts",
            metaField: "m",
            bucketMaxSpanSeconds: 86400,
            bucketRoundingSeconds: 86400,
          },
        });
      else await db.createCollection(name);
    }
    const existing = info
      ? await db.collection(name).listIndexes().toArray()
      : [];
    for (const index of desired) {
      if (existing.some((item) => equivalentIndex(index, item))) {
        log(`unchanged ${name}.${index.name}`);
        continue;
      }
      if (existing.some((item) => item.name === index.name)) {
        log(
          `conflict ${name}.${index.name}: manual review required; no drop or replacement`,
        );
        throw new Error(`Index conflict: ${name}.${index.name}`);
      }
      log(
        `${options.dryRun ? "would create" : "create"} ${name}.${index.name}`,
      );
      if (!options.dryRun) await db.collection(name).createIndexes([index]);
    }
    for (const index of existing)
      if (
        index.name !== "_id_" &&
        !desired.some((item) => equivalentIndex(item, index))
      )
        log(`drop suggestion (P7 review only): ${name}.${index.name}`);
    if (
      imageCollections.some((key) => names[key] === name) &&
      !info?.options?.changeStreamPreAndPostImages?.enabled
    ) {
      log(
        `${options.dryRun ? "would enable" : "enable"} ${name} changeStreamPreAndPostImages`,
      );
      if (!options.dryRun)
        await db.command({
          collMod: name,
          changeStreamPreAndPostImages: { enabled: true },
        });
    }
  }
}
