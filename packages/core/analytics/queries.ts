import type { Entitlements } from "@shortn/billing";
import { collection, physicalNames } from "@shortn/db";
import type { Db, Document, ObjectId } from "mongodb";

export const dimensions = {
  country: "$country",
  city: "$city",
  continent: "$continent",
  device: "$device",
  browser: "$browser",
  os: "$os",
  referrer: "$refDomain",
  utmSource: "$utm.source",
  utmMedium: "$utm.medium",
  utmCampaign: "$utm.campaign",
  utmTerm: "$utm.term",
  utmContent: "$utm.content",
  language: "$lang",
  link: "$m.linkId",
  kind: "$m.kind",
} as const;
export type Dimension = keyof typeof dimensions;
export const isDimension = (value: string): value is Dimension =>
  Object.hasOwn(dimensions, value);

export type Interval = "hour" | "day" | "week" | "month";

export interface AnalyticsScope {
  workspaceId: ObjectId;
  linkIds?: ObjectId[] | undefined;
  kind?: "click" | "scan" | undefined;
}

export type Filters = Partial<Record<Dimension, string>>;

export interface Range {
  from: Date;
  to: Date;
  timezone: string;
}

const fieldOf = (dimension: Dimension) => dimensions[dimension].slice(1);

// Values the UI shows for "no value"; a filter on them matches the missing field.
const emptyValue: Partial<Record<Dimension, string>> = { referrer: "direct" };

function match(
  scope: AnalyticsScope,
  range: Range,
  filters: Filters,
): Document {
  const query: Document = {
    "m.workspaceId": scope.workspaceId,
    ts: { $gte: range.from, $lt: range.to },
  };
  if (scope.linkIds) query["m.linkId"] = { $in: scope.linkIds };
  if (scope.kind) query["m.kind"] = scope.kind;
  for (const [dimension, value] of Object.entries(filters)) {
    if (!isDimension(dimension) || value === undefined || dimension === "link")
      continue;
    const field = fieldOf(dimension);
    query[field] =
      value === "unknown" || value === emptyValue[dimension]
        ? { $exists: false }
        : value;
  }
  return query;
}

// Clamps the start to the plan's analytics window (06); data older than the
// window is kept, only hidden.
export function clampRange(
  range: Range,
  entitlements: Pick<Entitlements, "limits">,
  now = new Date(),
): Range {
  const days = entitlements.limits.analyticsDays;
  if (days === null) return range;
  const floor = new Date(now.getTime() - days * 86_400_000);
  return range.from < floor ? { ...range, from: floor } : range;
}

const events = (db: Db) => db.collection(physicalNames.click_events);

export interface Totals {
  clicks: number;
  scans: number;
  uniques: number;
}

export async function totals(
  db: Db,
  scope: AnalyticsScope,
  range: Range,
  filters: Filters = {},
): Promise<Totals> {
  const [row] = await events(db)
    .aggregate<{ clicks: number; scans: number; uniques: number }>([
      { $match: match(scope, range, filters) },
      {
        $group: {
          _id: null,
          clicks: { $sum: { $cond: [{ $eq: ["$m.kind", "click"] }, 1, 0] } },
          scans: { $sum: { $cond: [{ $eq: ["$m.kind", "scan"] }, 1, 0] } },
          visitors: { $addToSet: "$ipHash" },
        },
      },
      {
        $project: {
          _id: 0,
          clicks: 1,
          scans: 1,
          uniques: { $size: "$visitors" },
        },
      },
    ])
    .toArray();
  return row ?? { clicks: 0, scans: 0, uniques: 0 };
}

export interface SeriesPoint {
  t: string;
  clicks: number;
  scans: number;
}

export async function timeseries(
  db: Db,
  scope: AnalyticsScope,
  range: Range,
  interval: Interval,
  filters: Filters = {},
): Promise<SeriesPoint[]> {
  const rows = await events(db)
    .aggregate<{ _id: Date; clicks: number; scans: number }>([
      { $match: match(scope, range, filters) },
      {
        $group: {
          _id: {
            $dateTrunc: {
              date: "$ts",
              unit: interval,
              timezone: range.timezone,
              startOfWeek: "monday",
            },
          },
          clicks: { $sum: { $cond: [{ $eq: ["$m.kind", "click"] }, 1, 0] } },
          scans: { $sum: { $cond: [{ $eq: ["$m.kind", "scan"] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray();
  const byTime = new Map(rows.map((row) => [row._id.getTime(), row]));
  return bucketStarts(range, interval).map((start) => {
    const row = byTime.get(start.getTime());
    return {
      t: start.toISOString(),
      clicks: row?.clicks ?? 0,
      scans: row?.scans ?? 0,
    };
  });
}

// Every bucket in the range, so gaps render as zeros. Advancing past the
// longest possible bucket and truncating lands on the next bucket start,
// whatever the DST shifts or month lengths.
const advance: Record<Interval, number> = {
  hour: 3_600_000,
  day: 30 * 3_600_000,
  week: 8 * 86_400_000,
  month: 32 * 86_400_000,
};

export function bucketStarts(range: Range, interval: Interval): Date[] {
  const starts: Date[] = [];
  let start = truncate(range.from, interval, range.timezone);
  while (start < range.to && starts.length < 2000) {
    starts.push(start);
    start = truncate(
      new Date(start.getTime() + advance[interval]),
      interval,
      range.timezone,
    );
  }
  return starts;
}

function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    weekday: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(
      get("weekday"),
    ),
  };
}

function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  timezone: string,
) {
  const guess = Date.UTC(year, month - 1, day, hour);
  const parts = zonedParts(new Date(guess), timezone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour);
  return new Date(guess - (asUtc - guess));
}

export function truncate(
  date: Date,
  interval: Interval,
  timezone: string,
): Date {
  const p = zonedParts(date, timezone);
  if (interval === "hour")
    return zonedToUtc(p.year, p.month, p.day, p.hour, timezone);
  if (interval === "day")
    return zonedToUtc(p.year, p.month, p.day, 0, timezone);
  if (interval === "month") return zonedToUtc(p.year, p.month, 1, 0, timezone);
  const monday = new Date(Date.UTC(p.year, p.month - 1, p.day - p.weekday));
  return zonedToUtc(
    monday.getUTCFullYear(),
    monday.getUTCMonth() + 1,
    monday.getUTCDate(),
    0,
    timezone,
  );
}

export interface BreakdownRow {
  value: string;
  clicks: number;
  scans: number;
}

export async function breakdown(
  db: Db,
  scope: AnalyticsScope,
  range: Range,
  dimension: Dimension,
  filters: Filters = {},
  limit = 50,
): Promise<BreakdownRow[]> {
  const rows = await events(db)
    .aggregate<{ _id: unknown; clicks: number; scans: number }>([
      { $match: match(scope, range, filters) },
      {
        $group: {
          _id: dimensions[dimension],
          clicks: { $sum: { $cond: [{ $eq: ["$m.kind", "click"] }, 1, 0] } },
          scans: { $sum: { $cond: [{ $eq: ["$m.kind", "scan"] }, 1, 0] } },
        },
      },
      { $sort: { clicks: -1, scans: -1 } },
      { $limit: limit },
    ])
    .toArray();
  return rows.map((row) => ({
    value:
      row._id === null || row._id === undefined
        ? (emptyValue[dimension] ?? "unknown")
        : typeof row._id === "object" &&
            "toHexString" in row._id &&
            typeof row._id.toHexString === "function"
          ? String(row._id.toHexString())
          : String(row._id),
    clicks: row.clicks,
    scans: row.scans,
  }));
}

export interface ExportRow {
  ts: Date;
  kind: string;
  key: string;
  country: string | undefined;
  city: string | undefined;
  device: string | undefined;
  browser: string | undefined;
  os: string | undefined;
  referrer: string | undefined;
  utmSource: string | undefined;
  utmMedium: string | undefined;
  utmCampaign: string | undefined;
  utmTerm: string | undefined;
  utmContent: string | undefined;
}

export function exportCursor(
  db: Db,
  scope: AnalyticsScope,
  range: Range,
  filters: Filters = {},
) {
  return collection(db, "click_events")
    .find(match(scope, range, filters), {
      projection: {
        ts: 1,
        m: 1,
        country: 1,
        city: 1,
        device: 1,
        browser: 1,
        os: 1,
        refDomain: 1,
        utm: 1,
      },
    })
    .sort({ ts: -1 })
    .map((doc): ExportRow => ({
      ts: doc.ts,
      kind: doc.m.kind,
      key: doc.m.key,
      country: doc.country,
      city: doc.city,
      device: doc.device,
      browser: doc.browser,
      os: doc.os,
      referrer: doc.refDomain,
      utmSource: doc.utm?.source,
      utmMedium: doc.utm?.medium,
      utmCampaign: doc.utm?.campaign,
      utmTerm: doc.utm?.term,
      utmContent: doc.utm?.content,
    }));
}

// Daily clicks+scans per link for the last `days` UTC days, oldest first,
// from rollups (refreshed every 5 minutes), for the links table sparklines.
export async function dailyTrends(
  db: Db,
  linkIds: ObjectId[],
  days = 30,
  now = new Date(),
): Promise<Map<string, number[]>> {
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const from = new Date(today - (days - 1) * 86_400_000);
  const trends = new Map(
    linkIds.map((id) => [id.toHexString(), Array<number>(days).fill(0)]),
  );
  if (!linkIds.length) return trends;
  const rows = await collection(db, "click_rollups")
    .find(
      { linkId: { $in: linkIds }, day: { $gte: from } },
      { projection: { linkId: 1, day: 1, clicks: 1, scans: 1 } },
    )
    .toArray();
  for (const row of rows) {
    const series = trends.get(row.linkId.toHexString());
    const index = Math.round((row.day.getTime() - from.getTime()) / 86_400_000);
    if (series && index >= 0 && index < days)
      series[index] = (series[index] ?? 0) + row.clicks + row.scans;
  }
  return trends;
}
