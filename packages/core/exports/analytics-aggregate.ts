import { collection } from "@shortn/db";
import type { ClientSession, Db, Document } from "mongodb";
import {
  dimensions,
  type Dimension,
  type Interval,
} from "../analytics/queries";

export interface AnalyticsAggregateRow {
  section: string;
  dimension: string;
  value: string;
  period: string;
  clicks: number;
  scans: number;
  uniques: number;
}
const counts = {
  clicks: { $sum: { $cond: [{ $eq: ["$m.kind", "click"] }, 1, 0] } },
  scans: { $sum: { $cond: [{ $eq: ["$m.kind", "scan"] }, 1, 0] } },
};
const valueOf = (value: unknown, dimension?: Dimension) =>
  value === null || value === undefined
    ? dimension === "referrer"
      ? "direct"
      : "unknown"
    : String(value);
/** Low-level cursor shared by authorized analytics and workspace portability jobs. */
export async function* analyticsAggregateRows(
  db: Db,
  predicate: Document,
  input: { timezone: string; interval: Interval; dimensions: Dimension[] },
  session: ClientSession,
  check: () => Promise<void>,
  signal?: AbortSignal,
): AsyncGenerator<AnalyticsAggregateRow> {
  const sections: {
    section: string;
    dimension?: Dimension;
    bucket: unknown;
  }[] = [
    { section: "total", bucket: null },
    {
      section: "series",
      bucket: {
        $dateTrunc: {
          date: "$ts",
          unit: input.interval,
          timezone: input.timezone,
          startOfWeek: "monday",
        },
      },
    },
    ...[...new Set(input.dimensions)].map((dimension) => ({
      section: "breakdown",
      dimension,
      bucket: dimensions[dimension],
    })),
  ];
  for (const section of sections) {
    await check();
    let populated = false;
    // Count visitors without accumulating one unbounded array per group.
    const cursor = collection(db, "click_events").aggregate<Document>(
      [
        { $match: predicate },
        {
          $group: {
            _id: {
              bucket: { $ifNull: [section.bucket, null] },
              visitor: "$ipHash",
            },
            ...counts,
          },
        },
        {
          $group: {
            _id: "$_id.bucket",
            clicks: { $sum: "$clicks" },
            scans: { $sum: "$scans" },
            uniques: {
              $sum: {
                $cond: [
                  { $ne: [{ $ifNull: ["$_id.visitor", null] }, null] },
                  1,
                  0,
                ],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ],
      { allowDiskUse: true, batchSize: 500, session, signal },
    );
    try {
      for await (const row of cursor) {
        if (signal?.aborted) {
          await check();
          return;
        }
        populated = true;
        yield {
          section: section.section,
          dimension: section.dimension ?? "",
          value:
            section.section === "breakdown"
              ? valueOf(row._id, section.dimension)
              : "",
          period: section.section === "series" ? row._id.toISOString() : "",
          clicks: row.clicks,
          scans: row.scans,
          uniques: row.uniques,
        };
      }
    } finally {
      await cursor.close();
    }
    if (!populated && section.section === "total")
      yield {
        section: "total",
        dimension: "",
        value: "",
        period: "",
        clicks: 0,
        scans: 0,
        uniques: 0,
      };
  }
}
