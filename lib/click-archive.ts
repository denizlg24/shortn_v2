import Clicks from "@/models/url/Click";

type ClickFilter = {
  sub: string;
  urlCode: string;
  type: "click" | "scan";
};

const BATCH_SIZE = 1000;

// Removed analytics are copied to `clicks_deleted` before removal so a deletion
// can always be recovered. Deleting by the exact ids just archived means a click
// written concurrently is either archived in a later batch or left in place,
// never removed without a copy.
export async function archiveAndDeleteClicks(filter: ClickFilter) {
  for (;;) {
    const batch = await Clicks.find(filter, { _id: 1 })
      .limit(BATCH_SIZE)
      .lean();
    if (batch.length === 0) return;

    const ids = batch.map((click) => click._id);
    await Clicks.aggregate([
      { $match: { _id: { $in: ids } } },
      { $addFields: { deletedAt: new Date() } },
      {
        $merge: {
          into: "clicks_deleted",
          on: "_id",
          whenMatched: "keepExisting",
          whenNotMatched: "insert",
        },
      },
    ]);
    await Clicks.deleteMany({ _id: { $in: ids } });
  }
}
