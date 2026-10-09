import type { AnyBulkWriteOperation, Document, ObjectId } from "mongodb";
import { names, oid, report, stableHash, str } from "./helpers";
import type { Migration, MigrationContext } from "./runner";

const createdBy = "migration:0005-normalize-tags";

interface Embedded {
  id?: string;
  name: string;
  lower: string;
}

function embeddedTags(doc: Document): Embedded[] {
  if (!Array.isArray(doc.tags)) return [];
  return doc.tags.flatMap((tag: unknown) => {
    if (!tag || typeof tag !== "object") return [];
    const name = (
      str(Reflect.get(tag, "tagName")) ?? str(Reflect.get(tag, "name"))
    )?.trim();
    if (!name) return [];
    const id = str(Reflect.get(tag, "id"));
    return [{ ...(id ? { id } : {}), name, lower: name.toLowerCase() }];
  });
}

async function canonicalTags(ctx: MigrationContext, workspaceIds: ObjectId[]) {
  const tags = await ctx
    .read(names.tags)
    .find(
      { workspaceId: { $in: workspaceIds }, nameLower: { $type: "string" } },
      { projection: { workspaceId: 1, nameLower: 1, name: 1 } },
    )
    .toArray();
  const map = new Map<string, { id: ObjectId; name: string }>();
  for (const tag of tags) {
    const id = oid(tag._id);
    const workspaceId = oid(tag.workspaceId);
    const lower = str(tag.nameLower);
    if (id && workspaceId && lower)
      map.set(`${workspaceId.toHexString()}:${lower}`, {
        id,
        name: str(tag.name) ?? lower,
      });
  }
  return map;
}

const workspaceIdsOf = (docs: Document[]) =>
  docs.flatMap((doc) => oid(doc.workspaceId) ?? []);

async function ensureEmbeddedTags(ctx: MigrationContext, collection: string) {
  await ctx.batch({
    name: collection,
    target: names.tags,
    checkpointId: `${collection}__tags`,
    filter: { workspaceId: { $exists: true }, "tags.0": { $exists: true } },
    operations: (docs) =>
      docs.flatMap((doc) =>
        embeddedTags(doc).map((tag) => ({
          updateOne: {
            filter: { workspaceId: doc.workspaceId, nameLower: tag.lower },
            update: {
              $setOnInsert: {
                workspaceId: doc.workspaceId,
                name: tag.name,
                nameLower: tag.lower,
                sub: doc.sub,
                createdAt: new Date(),
                createdBy,
              },
              ...(tag.id ? { $addToSet: { legacyIds: tag.id } } : {}),
            },
            upsert: true,
          },
        })),
      ),
  });
}

async function mapTagIds(ctx: MigrationContext, collection: string) {
  await ctx.batch({
    name: collection,
    filter: {
      workspaceId: { $exists: true },
      $or: [{ "tags.0": { $exists: true } }, { tagIds: { $exists: true } }],
    },
    operations: async (docs) => {
      const canonical = await canonicalTags(ctx, workspaceIdsOf(docs));
      return docs.flatMap((doc): AnyBulkWriteOperation<Document>[] => {
        const tags = embeddedTags(doc);
        const tagsHash = stableHash(tags.map((tag) => tag.lower).sort());
        if (doc._sync?.tagsHash === tagsHash && Array.isArray(doc.tagIds))
          return [];
        const workspace = String(doc.workspaceId);
        const tagIds = [
          ...new Map(
            tags.flatMap((tag) => {
              const found = canonical.get(`${workspace}:${tag.lower}`);
              return found ? [[found.id.toHexString(), found.id] as const] : [];
            }),
          ).values(),
        ];
        return [
          {
            updateOne: {
              filter: { _id: doc._id },
              update: { $set: { tagIds, "_sync.tagsHash": tagsHash } },
            },
          },
        ];
      });
    },
  });
}

export const normalizeTags: Migration = {
  id: "0005-normalize-tags",
  phase: "backfill",
  continuous: true,
  async up(ctx) {
    await ctx.batch({
      name: names.tags,
      filter: {
        workspaceId: { $exists: true },
        nameLower: { $exists: false },
        mergedInto: { $exists: false },
      },
      operations: async (docs) => {
        const canonical = await canonicalTags(ctx, workspaceIdsOf(docs));
        const operations: AnyBulkWriteOperation<Document>[] = [];
        for (const doc of docs) {
          const name = (str(doc.tagName) ?? str(doc.name))?.trim();
          if (!name) continue;
          const lower = name.toLowerCase();
          const key = `${String(doc.workspaceId)}:${lower}`;
          const legacyId = str(doc.id);
          const existingTag = canonical.get(key);
          if (existingTag && oid(doc._id)?.equals(existingTag.id) !== true) {
            operations.push({
              updateOne: {
                filter: { _id: doc._id },
                update: { $set: { mergedInto: existingTag.id } },
              },
            });
            if (legacyId)
              operations.push({
                updateOne: {
                  filter: { _id: existingTag.id },
                  update: { $addToSet: { legacyIds: legacyId } },
                },
              });
            continue;
          }
          const id = oid(doc._id);
          if (id) canonical.set(key, { id, name });
          operations.push({
            updateOne: {
              filter: { _id: doc._id },
              update: {
                $set: { name, nameLower: lower },
                ...(legacyId ? { $addToSet: { legacyIds: legacyId } } : {}),
              },
            },
          });
        }
        return operations;
      },
    });
    for (const collection of [names.links, names.qr_codes]) {
      await ensureEmbeddedTags(ctx, collection);
      await mapTagIds(ctx, collection);
    }
  },
  async verify(ctx) {
    const discrepancies: string[] = [];
    const counts: Record<string, number> = {};
    const up = ctx.direction === "up";
    for (const collection of [names.links, names.qr_codes]) {
      if (!up) {
        const remaining = await ctx
          .read(collection)
          .countDocuments({ tagIds: { $exists: true } });
        counts[`${collection}.withTagIds`] = remaining;
        if (remaining)
          discrepancies.push(`${collection}: ${remaining} keep tagIds`);
        continue;
      }
      const docs = await ctx
        .read(collection)
        .find(
          { "tags.0": { $exists: true } },
          { projection: { tags: 1, tagIds: 1, workspaceId: 1 } },
        )
        .toArray();
      counts[`${collection}.tagged`] = docs.length;
      const ids = docs.flatMap((doc) =>
        Array.isArray(doc.tagIds) ? doc.tagIds : [],
      );
      const tags = await ctx
        .read(names.tags)
        .find({ _id: { $in: ids } }, { projection: { nameLower: 1 } })
        .toArray();
      const lowerById = new Map(
        tags.map((tag) => [String(tag._id), str(tag.nameLower)]),
      );
      for (const doc of docs) {
        const expected = new Set(embeddedTags(doc).map((tag) => tag.lower));
        const actual = new Set(
          (Array.isArray(doc.tagIds) ? doc.tagIds : []).map((id: unknown) =>
            lowerById.get(String(id)),
          ),
        );
        const same =
          expected.size === actual.size &&
          [...expected].every((name) => actual.has(name));
        if (!same)
          discrepancies.push(
            `${collection} ${String(doc._id)} tag names differ`,
          );
      }
    }
    if (!up) {
      const created = await ctx.read(names.tags).countDocuments({ createdBy });
      if (created) discrepancies.push(`${created} migration tags remain`);
    }
    return report(counts, discrepancies);
  },
  async down(ctx) {
    for (const collection of [names.links, names.qr_codes])
      await ctx.batch({
        name: collection,
        filter: {
          $or: [
            { tagIds: { $exists: true } },
            { "_sync.tagsHash": { $exists: true } },
          ],
        },
        operations: (docs) =>
          docs.map((doc) => ({
            updateOne: {
              filter: { _id: doc._id },
              update: { $unset: { tagIds: "", "_sync.tagsHash": "" } },
            },
          })),
      });
    await ctx.batch({
      name: names.tags,
      checkpointId: "tags__tags_down",
      filter: {
        $or: [
          { createdBy },
          { nameLower: { $exists: true } },
          { mergedInto: { $exists: true } },
          { legacyIds: { $exists: true } },
        ],
      },
      operations: (docs) =>
        docs.map((doc) =>
          doc.createdBy === createdBy
            ? { deleteOne: { filter: { _id: doc._id } } }
            : {
                updateOne: {
                  filter: { _id: doc._id },
                  update: {
                    $unset: {
                      name: "",
                      nameLower: "",
                      legacyIds: "",
                      mergedInto: "",
                    },
                  },
                },
              },
        ),
    });
  },
};
