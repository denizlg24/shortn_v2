import { destinationHostRev } from "../destination-host";
import { names, report } from "./helpers";
import type { Migration } from "./runner";
export const linkDestHost: Migration = {
  id: "0013-link-dest-host",
  phase: "expand",
  continuous: true,
  async up(ctx) {
    await ctx.batch({
      name: names.links,
      checkpointId: "dest-host",
      operations: (docs) =>
        docs.flatMap((doc) => {
          const expected =
            typeof doc.longUrl === "string"
              ? destinationHostRev(doc.longUrl)
              : null;
          if (
            expected === doc.destHostRev ||
            (!expected && doc.destHostRev === undefined)
          )
            return [];
          return [
            {
              updateOne: {
                filter: { _id: doc._id, longUrl: doc.longUrl },
                update: expected
                  ? { $set: { destHostRev: expected } }
                  : { $unset: { destHostRev: "" } },
              },
            },
          ];
        }),
    });
  },
  async verify(ctx) {
    let wrong = 0;
    for await (const doc of ctx
      .read(names.links)
      .find(
        { longUrl: { $type: "string" } },
        { projection: { longUrl: 1, destHostRev: 1 } },
      )) {
      if (destinationHostRev(doc.longUrl) !== (doc.destHostRev ?? null))
        wrong++;
    }
    return report(
      { mismatched: wrong },
      wrong ? [`${wrong} destination hosts need repair`] : [],
    );
  },
  async down(ctx) {
    await ctx.batch({
      name: names.links,
      filter: { destHostRev: { $exists: true } },
      operations: (docs) =>
        docs.map((doc) => ({
          updateOne: {
            filter: { _id: doc._id },
            update: { $unset: { destHostRev: "" } },
          },
        })),
    });
  },
};
