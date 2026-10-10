import type { Dimension, Interval } from "@shortn/core";

export const rangePresets = ["7d", "30d", "90d", "12m"] as const;
export type RangePreset = (typeof rangePresets)[number];
export type RangeChoice = RangePreset | "custom";

export const intervals = [
  "hour",
  "day",
  "week",
  "month",
] as const satisfies readonly Interval[];

export const filterDimensions = [
  "country",
  "referrer",
  "device",
  "browser",
  "os",
  "utmSource",
  "utmMedium",
  "utmCampaign",
] as const satisfies readonly Dimension[];
export type FilterDimension = (typeof filterDimensions)[number];
export type AnalyticsFilters = Partial<Record<FilterDimension, string>>;

export interface AnalyticsQuery {
  range: RangeChoice;
  /** Inclusive calendar days (yyyy-mm-dd) in the viewer's time zone; custom ranges only. */
  from: string | null;
  to: string | null;
  interval: Interval;
  filters: AnalyticsFilters;
}

const DAY = 86_400_000;
const defaultRange: RangePreset = "30d";
const presetDays: Record<RangePreset, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "12m": 365,
};
const isoDay = /^\d{4}-\d{2}-\d{2}$/;

export function parseDay(value: string | null): Date | null {
  if (!value || !isoDay.test(value)) return null;
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
}

export function formatDay(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Whole calendar days the range covers, `to` included. */
export function spanDays(
  range: RangeChoice,
  from: string | null,
  to: string | null,
): number {
  if (range !== "custom") return presetDays[range];
  const start = parseDay(from);
  const end = parseDay(to);
  if (!start || !end) return presetDays[defaultRange];
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY) + 1);
}

// bucketStarts in @shortn/core caps a series at 2000 buckets; these keep
// every series well under that and readable.
export function allowedIntervals(days: number): Interval[] {
  return intervals.filter((interval) => {
    if (interval === "hour") return days <= 14;
    if (interval === "day") return days <= 731;
    if (interval === "week") return days >= 14;
    return days >= 60;
  });
}

export function defaultInterval(days: number): Interval {
  if (days <= 2) return "hour";
  if (days <= 120) return "day";
  if (days <= 400) return "week";
  return "month";
}

interface ParamSource {
  get(name: string): string | null;
}

export function parseQuery(params: ParamSource): AnalyticsQuery {
  const rawRange = params.get("range");
  let range: RangeChoice =
    rangePresets.find((preset) => preset === rawRange) ??
    (rawRange === "custom" ? "custom" : defaultRange);
  let from: string | null = null;
  let to: string | null = null;
  if (range === "custom") {
    const start = parseDay(params.get("from"));
    const end = parseDay(params.get("to"));
    if (start && end && start <= end) {
      from = formatDay(start);
      to = formatDay(end);
    } else range = defaultRange;
  }
  const days = spanDays(range, from, to);
  const rawInterval = params.get("interval");
  const interval =
    allowedIntervals(days).find((option) => option === rawInterval) ??
    defaultInterval(days);
  const filters: AnalyticsFilters = {};
  for (const dimension of filterDimensions) {
    const value = params.get(dimension);
    if (value) filters[dimension] = value.slice(0, 200);
  }
  return { range, from, to, interval, filters };
}

/** Only non-default values, so a plain /analytics URL means "last 30 days". */
export function toSearchParams(query: AnalyticsQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.range !== defaultRange) params.set("range", query.range);
  if (query.range === "custom" && query.from && query.to) {
    params.set("from", query.from);
    params.set("to", query.to);
  }
  const days = spanDays(query.range, query.from, query.to);
  if (query.interval !== defaultInterval(days))
    params.set("interval", query.interval);
  for (const dimension of filterDimensions) {
    const value = query.filters[dimension];
    if (value) params.set(dimension, value);
  }
  return params;
}

/** Changes the range and keeps the interval only if it still fits. */
export function withRange(
  query: AnalyticsQuery,
  range: RangeChoice,
  from: string | null = null,
  to: string | null = null,
): AnalyticsQuery {
  const days = spanDays(range, from, to);
  const interval = allowedIntervals(days).includes(query.interval)
    ? query.interval
    : defaultInterval(days);
  return {
    ...query,
    range,
    from: range === "custom" ? from : null,
    to: range === "custom" ? to : null,
    interval: range === query.range ? interval : defaultInterval(days),
  };
}

/** Local-time bounds; preset ranges end now and start at a local midnight. */
export function resolveRange(
  query: Pick<AnalyticsQuery, "range" | "from" | "to">,
  now: Date,
): { from: Date; to: Date } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (query.range === "custom") {
    const start = parseDay(query.from);
    const end = parseDay(query.to);
    if (start && end && start <= end) {
      const afterEnd = new Date(
        end.getFullYear(),
        end.getMonth(),
        end.getDate() + 1,
      );
      const to = afterEnd < now ? afterEnd : now;
      return { from: start, to: to > start ? to : afterEnd };
    }
  }
  const range = query.range === "custom" ? defaultRange : query.range;
  if (range === "12m")
    return {
      from: new Date(now.getFullYear(), now.getMonth() - 11, 1),
      to: now,
    };
  return {
    from: new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - (presetDays[range] - 1),
    ),
    to: now,
  };
}
