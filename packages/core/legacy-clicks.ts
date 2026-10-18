import { physicalNames } from "@shortn/db";
import type { Db, ClientSession, ObjectId } from "mongodb";

// Same as legacy lib/click-archive: copy to clicks_deleted, then delete
// exactly the archived ids, so a concurrent click is never lost.
export async function archiveLegacyClicks(
  db: Db,
  filter: {
    sub: string;
    urlCode: string;
    type: "click" | "scan";
    workspaceId?: ObjectId;
  },
  now: Date,
  session?: ClientSession,
) {
  const clicks = db.collection(physicalNames.clicks);
  const { workspaceId, ...legacyFilter } = filter;
  const ownedFilter = workspaceId
    ? {
        $and: [
          legacyFilter,
          { $or: [{ workspaceId }, { workspaceId: { $exists: false } }] },
        ],
      }
    : legacyFilter;
  for (;;) {
    const batch = await clicks
      .find(ownedFilter, {
        ...(session ? { session } : { projection: { _id: 1 } }),
      })
      .limit(1000)
      .toArray();
    if (!batch.length) return;
    const ids = batch.map((click) => click._id);
    if (session) {
      await db.collection("clicks_deleted").bulkWrite(
        batch.map((click) => ({
          updateOne: {
            filter: { _id: click._id },
            update: { $setOnInsert: { ...click, deletedAt: now } },
            upsert: true,
          },
        })),
        { session },
      );
    } else
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
    await clicks.deleteMany({ _id: { $in: ids } }, session ? { session } : {});
  }
}
