import type { AnyBulkWriteOperation, Document, ObjectId } from "mongodb";
import { names, oid, report, stableHash, str } from "./helpers";
import type { Migration, MigrationContext } from "./runner";

interface Variant {
  vid: string;
  source?: string;
  medium?: string;
  term?: string;
  content?: string;
  campaignId?: ObjectId;
}

// Legacy replaces utmLinks wholesale with fresh subdocument ids on every edit
// (linkActions.ts:841), so a variant's id is a hash of its parameters.
export function utmVariants(doc: Document): Variant[] {
  if (!Array.isArray(doc.utmLinks)) return [];
  return doc.utmLinks.flatMap((entry: unknown) => {
    if (!entry || typeof entry !== "object") return [];
    const params = {
      source: str(Reflect.get(entry, "source")),
      medium: str(Reflect.get(entry, "medium")),
      term: str(Reflect.get(entry, "term")),
      content: str(Reflect.get(entry, "content")),
    };
    const campaign = Reflect.get(entry, "campaign");
    const campaignId =
      campaign && typeof campaign === "object"
        ? oid(Reflect.get(campaign, "_id"))
        : undefined;
    const variant: Variant = {
      vid: stableHash({ ...params, campaignId }).slice(0, 12),
    };
    for (const [key, value] of Object.entries(params))
      if (value) Reflect.set(variant, key, value);
    if (campaignId) variant.campaignId = campaignId;
    return [variant];
  });
}

async function reverseLinks(ctx: MigrationContext, campaignIds: ObjectId[]) {
  const links = await ctx
    .read(names.links)
    .find(
      { "utmLinks.campaign._id": { $in: campaignIds } },
      { projection: { "utmLinks.campaign._id": 1 } },
    )
    .toArray();
  const map = new Map<string, ObjectId[]>();
  for (const link of links) {
    const linkId = oid(link._id);
    if (!linkId) continue;
    for (const variant of utmVariants(link)) {
      if (!variant.campaignId) continue;
      const key = variant.campaignId.toHexString();
      map.set(key, [...(map.get(key) ?? []), linkId]);
    }
  }
  return map;
}

const objectIds = (value: unknown) =>
  (Array.isArray(value) ? value : []).flatMap(
    (item: unknown) => oid(item) ?? [],
  );

export const normalizeCampaignsUtm: Migration = {
  id: "0006-normalize-campaigns-utm",
  phase: "backfill",
  continuous: true,
  async up(ctx) {
    await ctx.batch({
      name: names.links,
      filter: {
        $or: [
          { "utmLinks.0": { $exists: true } },
          { utmVariants: { $exists: true } },
        ],
      },
      operations: (docs) =>
        docs.flatMap((doc): AnyBulkWriteOperation<Document>[] => {
          const variants = utmVariants(doc);
          const utmHash = stableHash(variants);
          if (doc._sync?.utmHash === utmHash) return [];
          return [
            {
              updateOne: {
                filter: { _id: doc._id },
                update: {
                  $set: { utmVariants: variants, "_sync.utmHash": utmHash },
                },
              },
            },
          ];
        }),
    });
    if (!(await ctx.exists(names.campaigns))) return;
    // Both directions of the legacy association are kept; the union is truth.
    await ctx.batch({
      name: names.campaigns,
      operations: async (docs) => {
        const reverse = await reverseLinks(
          ctx,
          docs.flatMap((doc) => oid(doc._id) ?? []),
        );
        return docs.flatMap((doc): AnyBulkWriteOperation<Document>[] => {
          const union = new Map<string, ObjectId>();
          for (const id of objectIds(doc.links))
            union.set(id.toHexString(), id);
          for (const id of reverse.get(String(doc._id)) ?? [])
            union.set(id.toHexString(), id);
          const linkIds = [...union.values()].sort((a, b) =>
            a.toHexString().localeCompare(b.toHexString()),
          );
          const current = objectIds(doc.linkIds).map((id) => id.toHexString());
          if (
            current.length === linkIds.length &&
            linkIds.every((id, index) => id.toHexString() === current[index])
          )
            return [];
          return [
            {
              updateOne: {
                filter: { _id: doc._id },
                update: { $set: { linkIds } },
              },
            },
          ];
        });
      },
    });
  },
  async verify(ctx) {
    const up = ctx.direction === "up";
    const discrepancies: string[] = [];
    const links = await ctx
      .read(names.links)
      .find(
        {
          $or: [
            { "utmLinks.0": { $exists: true } },
            { utmVariants: { $exists: true } },
          ],
        },
        { projection: { utmLinks: 1, utmVariants: 1 } },
      )
      .toArray();
    for (const link of links) {
      const expected = up
        ? Array.isArray(link.utmLinks)
          ? link.utmLinks.length
          : 0
        : 0;
      const actual = Array.isArray(link.utmVariants)
        ? link.utmVariants.length
        : up
          ? -1
          : 0;
      if (expected !== actual)
        discrepancies.push(
          `link ${String(link._id)} has ${actual} variants, expected ${expected}`,
        );
    }
    let campaigns = 0;
    if (await ctx.exists(names.campaigns)) {
      const docs = await ctx.read(names.campaigns).find({}).toArray();
      campaigns = docs.length;
      const reverse = await reverseLinks(
        ctx,
        docs.flatMap((doc) => oid(doc._id) ?? []),
      );
      for (const doc of docs) {
        const derived = new Set(
          objectIds(doc.linkIds).map((id) => id.toHexString()),
        );
        if (!up) {
          if (derived.size)
            discrepancies.push(`campaign ${String(doc._id)} keeps linkIds`);
          continue;
        }
        const required = [
          ...objectIds(doc.links).map((id) => id.toHexString()),
          ...(reverse.get(String(doc._id)) ?? []).map((id) => id.toHexString()),
        ];
        const missing = required.filter((id) => !derived.has(id));
        if (missing.length)
          discrepancies.push(
            `campaign ${String(doc._id)} misses ${missing.length} links`,
          );
      }
    }
    return report({ links: links.length, campaigns }, discrepancies);
  },
  async down(ctx) {
    await ctx.batch({
      name: names.links,
      filter: {
        $or: [
          { utmVariants: { $exists: true } },
          { "_sync.utmHash": { $exists: true } },
        ],
      },
      operations: (docs) =>
        docs.map((doc) => ({
          updateOne: {
            filter: { _id: doc._id },
            update: { $unset: { utmVariants: "", "_sync.utmHash": "" } },
          },
        })),
    });
    if (await ctx.exists(names.campaigns))
      await ctx.batch({
        name: names.campaigns,
        filter: { linkIds: { $exists: true } },
        operations: (docs) =>
          docs.map((doc) => ({
            updateOne: {
              filter: { _id: doc._id },
              update: { $unset: { linkIds: "" } },
            },
          })),
      });
  },
};
