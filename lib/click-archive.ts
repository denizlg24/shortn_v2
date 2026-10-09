import Clicks from "@/models/url/Click";

type ClickFilter = {
  sub: string;
  urlCode: string;
  type: "click" | "scan";
};

// Removed analytics are copied to `clicks_deleted` first so a deletion can
// always be recovered; the rebuild migrations reconcile against this archive.
export async function archiveAndDeleteClicks(filter: ClickFilter) {
  await Clicks.aggregate([
    { $match: filter },
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
  await Clicks.deleteMany(filter);
}
