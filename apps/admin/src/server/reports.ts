import "server-only";
import { physicalNames } from "@shortn/db";
import { BSON, type Db, type Document } from "mongodb";
import { param, type SearchParams } from "./list";
export async function groupedReports(db: Db, search: SearchParams) {
  const status = param(search, "status") ?? "open";
  const match: Document = {
    status: ["open", "reviewed", "dismissed"].includes(status)
      ? status
      : "open",
  };
  const reason = param(search, "reason");
  if (reason) match.reason = reason;
  const field =
    param(search, "sort") === "count"
      ? "count"
      : param(search, "sort") === "oldest"
        ? "first"
        : "last";
  const order = field === "first" ? 1 : -1;
  let cursor: Document | undefined;
  try {
    const raw = param(search, "after");
    if (raw && raw.length < 512)
      cursor = BSON.EJSON.parse(Buffer.from(raw, "base64url").toString());
  } catch {
    /* First page for an invalid cursor. */
  }
  const pipeline: Document[] = [
    { $match: match },
    {
      $group: {
        _id: { $ifNull: ["$linkId", "$urlCode"] },
        count: { $sum: 1 },
        reasons: { $addToSet: "$reason" },
        first: { $min: "$createdAt" },
        last: { $max: "$createdAt" },
      },
    },
  ];
  if (cursor && cursor.field === field && cursor.id !== undefined)
    pipeline.push({
      $match: {
        $or: [
          { [field]: { [order === 1 ? "$gt" : "$lt"]: cursor.value } },
          {
            [field]: cursor.value,
            _id: { [order === 1 ? "$gt" : "$lt"]: cursor.id },
          },
        ],
      },
    });
  pipeline.push({ $sort: { [field]: order, _id: order } }, { $limit: 51 });
  const rows = await db
    .collection(physicalNames.link_reports)
    .aggregate<{
      _id: unknown;
      count: number;
      reasons: string[];
      first: Date;
      last: Date;
    }>(pipeline, { maxTimeMS: 10000, allowDiskUse: true })
    .toArray();
  const more = rows.length > 50;
  if (more) rows.pop();
  const last = rows.at(-1);
  return {
    rows,
    next:
      more && last
        ? Buffer.from(
            BSON.EJSON.stringify({ field, id: last._id, value: last[field] }),
          ).toString("base64url")
        : undefined,
  };
}
