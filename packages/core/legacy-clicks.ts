import { physicalNames } from "@shortn/db";
import type { Db } from "mongodb";

// Same as legacy lib/click-archive: copy to clicks_deleted, then delete
// exactly the archived ids, so a concurrent click is never lost.
export async function archiveLegacyClicks(
  db: Db,
  filter: { sub: string; urlCode: string; type: "click" | "scan" },
  now: Date,
) {
  const clicks = db.collection(physicalNames.clicks);
  for (;;) {
    const batch = await clicks
      .find(filter, { projection: { _id: 1 } })
      .limit(1000)
      .toArray();
    if (!batch.length) return;
    const ids = batch.map((click) => click._id);
    await clicks
      .aggregate([
        { $match: { _id: { $in: ids } } },
        { $addFields: { deletedAt: now } },
        {
          $merge: {
            into: "clicks_deleted",
            on: "_id",
            whenMatched: "keepExisting",
            whenNotMatched: "insert",
          },
        },
      ])
      .toArray();
    await clicks.deleteMany({ _id: { $in: ids } });
  }
}
