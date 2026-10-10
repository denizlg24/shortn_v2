import type { ObjectId } from "mongodb";
import { names, oid, report, str } from "./helpers";
import type { Migration, MigrationContext } from "./runner";

interface Assignment {
  linkId: ObjectId;
  originalCode: string;
  assignedKey: string;
}

// The oldest document keeps a duplicated code (legacy findOne returns it in
// natural order); newer duplicates get `<code>-<n>` as their key. Their
// urlCode and current resolution are untouched.
async function assignments(ctx: MigrationContext): Promise<Assignment[]> {
  const groups = await ctx
    .read(names.links)
    .aggregate<{ _id: string; ids: ObjectId[] }>([
      { $match: { urlCode: { $type: "string" } } },
      { $sort: { _id: 1 } },
      { $group: { _id: "$urlCode", ids: { $push: "$_id" }, n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ])
    .toArray();
  if (!groups.length) return [];
  const taken = new Set<string>(
    (await ctx.read(names.links).distinct("urlCode", {})).filter(
      (code): code is string => typeof code === "string",
    ),
  );
  const conflicts = await ctx
    .read(names.links)
    .find({ codeConflict: { $exists: true } }, { projection: { key: 1 } })
    .toArray();
  const existingKey = new Map(
    conflicts.flatMap((doc) => {
      const id = oid(doc._id);
      const key = str(doc.key);
      return id && key ? [[id.toHexString(), key] as const] : [];
    }),
  );
  for (const key of existingKey.values()) taken.add(key);
  const result: Assignment[] = [];
  for (const group of groups) {
    let n = 2;
    for (const linkId of group.ids.slice(1)) {
      let assignedKey = existingKey.get(linkId.toHexString());
      if (!assignedKey) {
        while (taken.has(`${group._id}-${n}`)) n++;
        assignedKey = `${group._id}-${n}`;
        taken.add(assignedKey);
      }
      result.push({ linkId, originalCode: group._id, assignedKey });
    }
  }
  return result;
}

export const resolveDuplicateCodes: Migration = {
  id: "0001-resolve-duplicate-codes",
  phase: "backfill",
  continuous: true,
  async up(ctx) {
    const pending = await assignments(ctx);
    if (!pending.length) return;
    const byId = new Map(
      pending.map((item) => [item.linkId.toHexString(), item]),
    );
    const filter = { _id: { $in: pending.map((item) => item.linkId) } };
    await ctx.batch({
      name: names.links,
      filter,
      operations: (docs) =>
        docs.flatMap((doc) => {
          const item = byId.get(String(doc._id));
          if (!item) return [];
          return [
            {
              updateOne: {
                filter: { _id: doc._id, codeConflict: { $exists: false } },
                update: {
                  $set: {
                    key: item.assignedKey,
                    codeConflict: { originalCode: item.originalCode },
                  },
                },
              },
            },
          ];
        }),
    });
    await ctx.batch({
      name: names.links,
      target: names.code_conflicts,
      checkpointId: "links__code_conflicts",
      filter,
      operations: (docs) =>
        docs.flatMap((doc) => {
          const item = byId.get(String(doc._id));
          if (!item) return [];
          return [
            {
              updateOne: {
                filter: { linkId: item.linkId },
                update: {
                  $setOnInsert: {
                    linkId: item.linkId,
                    originalCode: item.originalCode,
                    assignedKey: item.assignedKey,
                    sub: doc.sub,
                    createdAt: new Date(),
                    notified: false,
                  },
                },
                upsert: true,
              },
            },
          ];
        }),
    });
  },
  async verify(ctx) {
    const pending = await assignments(ctx);
    const unresolved = [];
    for (const item of pending) {
      const doc = await ctx
        .read(names.links)
        .findOne(
          { _id: item.linkId },
          { projection: { key: 1, codeConflict: 1 } },
        );
      const resolved = doc?.codeConflict && str(doc.key) === item.assignedKey;
      if ((ctx.direction === "up") !== Boolean(resolved)) unresolved.push(item);
    }
    return report(
      { duplicates: pending.length, unresolved: unresolved.length },
      unresolved.map(
        (item) =>
          `${item.linkId.toHexString()} (${item.originalCode}) not ${ctx.direction === "up" ? "resolved" : "reverted"}`,
      ),
    );
  },
  async down(ctx) {
    await ctx.batch({
      name: names.links,
      filter: { codeConflict: { $exists: true } },
      operations: (docs) =>
        docs.map((doc) => ({
          updateOne: {
            filter: { _id: doc._id },
            update: { $unset: { codeConflict: "", key: "" } },
          },
        })),
    });
  },
};
