import { collection, physicalNames } from "@shortn/db";
import type { AnyBulkWriteOperation, Db, Document, ObjectId } from "mongodb";

const day = { $dateTrunc: { date: "$ts", unit: "day", timezone: "UTC" } };

const dimensions = [
  ["byCountry", { $ifNull: ["$country", "unknown"] }],
  ["byDevice", { $ifNull: ["$device", "unknown"] }],
  ["byBrowser", { $ifNull: ["$browser", "unknown"] }],
  ["byOs", { $ifNull: ["$os", "unknown"] }],
  ["byRefDomain", { $ifNull: ["$refDomain", "direct"] }],
  ["byHour", { $toString: { $hour: { date: "$ts", timezone: "UTC" } } }],
  ["kind", "$m.kind"],
] as const;

// Rebuilds click_rollups from click_events for whole UTC days in [from, to).
// Rollups are derived data: recomputing a day is always safe and repairs any
// drift left by redelivered or crashed batches.
export function rollupPipeline(from: Date, to: Date, linkIds?: ObjectId[]) {
  return [
    {
      $match: {
        ts: { $gte: from, $lt: to },
        "m.linkId": linkIds ? { $in: linkIds } : { $ne: null },
      },
    },
    {
      $project: {
        linkId: "$m.linkId",
        workspaceId: "$m.workspaceId",
        day,
        dims: dimensions.map(([k, v]) => ({ k, v })),
      },
    },
    { $unwind: "$dims" },
    {
      $group: {
        _id: { linkId: "$linkId", day: "$day", k: "$dims.k", v: "$dims.v" },
        n: { $sum: 1 },
        workspaceId: { $max: "$workspaceId" },
      },
    },
    {
      $group: {
        _id: { linkId: "$_id.linkId", day: "$_id.day", k: "$_id.k" },
        values: { $push: { k: "$_id.v", v: "$n" } },
        workspaceId: { $max: "$workspaceId" },
      },
    },
    {
      $group: {
        _id: { linkId: "$_id.linkId", day: "$_id.day" },
        maps: { $push: { k: "$_id.k", v: { $arrayToObject: "$values" } } },
        workspaceId: { $max: "$workspaceId" },
      },
    },
    { $set: { maps: { $arrayToObject: "$maps" } } },
    {
      $project: {
        _id: 0,
        linkId: "$_id.linkId",
        day: "$_id.day",
        workspaceId: 1,
        clicks: { $ifNull: ["$maps.kind.click", 0] },
        scans: { $ifNull: ["$maps.kind.scan", 0] },
        byCountry: "$maps.byCountry",
        byDevice: "$maps.byDevice",
        byBrowser: "$maps.byBrowser",
        byOs: "$maps.byOs",
        byRefDomain: "$maps.byRefDomain",
        byHour: {
          $map: {
            input: { $range: [0, 24] },
            as: "hour",
            in: {
              $ifNull: [
                {
                  $getField: {
                    field: { $toString: "$$hour" },
                    input: "$maps.byHour",
                  },
                },
                0,
              ],
            },
          },
        },
      },
    },
    {
      $merge: {
        into: physicalNames.click_rollups,
        on: ["linkId", "day"],
        whenMatched: "replace",
        whenNotMatched: "insert",
      },
    },
  ];
}

export function utcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export async function recomputeRollups(
  db: Db,
  from: Date,
  to: Date,
  linkIds?: ObjectId[],
) {
  const start = utcDay(from);
  const end = utcDay(new Date(to.getTime() + 86_399_999));
  await collection(db, "click_events")
    .aggregate(rollupPipeline(start, end, linkIds))
    .toArray();
  const touched = linkIds
    ? linkIds
    : await collection(db, "click_events").distinct("m.linkId", {
        ts: { $gte: start, $lt: end },
        "m.linkId": { $ne: null },
      });
  await recomputeLinkStats(
    db,
    touched.filter((id): id is ObjectId => id !== null),
  );
  return touched.length;
}

// links.stats is the all-time event-derived total; stats.legacyTotal keeps the
// historic legacy counter (M7) and is never touched here.
export async function recomputeLinkStats(db: Db, linkIds: ObjectId[]) {
  if (!linkIds.length) return;
  const totals = await collection(db, "click_rollups")
    .aggregate<{ _id: ObjectId; clicks: number; scans: number }>([
      { $match: { linkId: { $in: linkIds } } },
      {
        $group: {
          _id: "$linkId",
          clicks: { $sum: "$clicks" },
          scans: { $sum: "$scans" },
        },
      },
    ])
    .toArray();
  const last = await collection(db, "click_events")
    .aggregate<{ _id: ObjectId; ts: Date }>([
      { $match: { "m.linkId": { $in: linkIds } } },
      { $group: { _id: "$m.linkId", ts: { $max: "$ts" } } },
    ])
    .toArray();
  const lastById = new Map(last.map((row) => [row._id.toHexString(), row.ts]));
  const operations: AnyBulkWriteOperation<Document>[] = totals.map((row) => {
    const lastClickAt = lastById.get(row._id.toHexString());
    return {
      updateOne: {
        filter: { _id: row._id },
        update: {
          $set: {
            "stats.clicks": row.clicks,
            "stats.scans": row.scans,
            ...(lastClickAt ? { "stats.lastClickAt": lastClickAt } : {}),
          },
        },
      },
    };
  });
  if (operations.length)
    await db
      .collection(physicalNames.links)
      .bulkWrite(operations, { ordered: false });
}
