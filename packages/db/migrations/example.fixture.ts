import type { Migration } from "./runner";
// An isolated test collection only; never import this from the production registry.
export const exampleMigration: Migration = {
  id: "0001-example",
  phase: "expand",
  async up(ctx) {
    await ctx.batch({
      name: "migration_examples",
      filter: { expanded: { $exists: false } },
      operations: (docs) =>
        docs.map((doc) => ({
          updateOne: {
            filter: { _id: doc._id, expanded: { $exists: false } },
            update: { $set: { expanded: true } },
          },
        })),
    });
  },
  async verify(ctx) {
    const total = await ctx.read("migration_examples").countDocuments();
    const expanded = await ctx
      .read("migration_examples")
      .countDocuments({ expanded: true });
    const ok = ctx.direction === "up" ? expanded === total : expanded === 0;
    return {
      ok,
      counts: { total, expanded },
      samples: [],
      discrepancies: ok ? [] : ["Unexpected expanded document count"],
    };
  },
  async down(ctx) {
    await ctx.batch({
      name: "migration_examples",
      filter: { expanded: true },
      operations: (docs) =>
        docs.map((doc) => ({
          updateOne: {
            filter: { _id: doc._id },
            update: { $unset: { expanded: "" } },
          },
        })),
    });
  },
};
