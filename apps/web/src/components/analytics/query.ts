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

// Filters on event attributes; they need the analyticsBreakdowns feature.
export const filterDimensions = [
  "branch",
  "country",
  "device",
  "browser",
  "os",
  "referrer",
  "utmSource",
  "utmMedium",
  "utmCampaign",
] as const satisfies readonly Dimension[];
export type FilterDimension = (typeof filterDimensions)[number];

// Filters that only narrow what is counted (one link, clicks or scans); every
// plan has them, since the link and QR pages already show the same numbers.
export const scopeFilters = ["link", "kind"] as const;
export type ScopeFilter = (typeof scopeFilters)[number];

export type QueryFilter = ScopeFilter | FilterDimension;
export const queryFilters: readonly QueryFilter[] = [
  ...scopeFilters,
  ...filterDimensions,
];
export type AnalyticsFilters = Partial<Record<QueryFilter, string>>;

export const eventKinds = ["click", "scan"] as const;
export type EventKind = (typeof eventKinds)[number];
export const isEventKind = (value: unknown): value is EventKind =>
  eventKinds.some((kind) => kind === value);

const objectIdPattern = /^[a-f0-9]{24}$/;

const filterValue = (filter: QueryFilter, raw: string | null) => {
  if (!raw) return null;
  if (filter === "link") return objectIdPattern.test(raw) ? raw : null;
  if (filter === "kind") return isEventKind(raw) ? raw : null;
  return raw.slice(0, 200);
};

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
  for (const filter of queryFilters) {
    const value = filterValue(filter, params.get(filter));
    if (value) filters[filter] = value;
  }
  return { range, from, to, interval, filters };
}

/** Every search param the query owns; pages keep the rest (e.g. `sort`). */
export const queryParamNames: ReadonlySet<string> = new Set([
  "range",
  "from",
  "to",
  "interval",
  ...queryFilters,
]);

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
  for (const filter of queryFilters) {
    const value = query.filters[filter];
    if (value) params.set(filter, value);
  }
  return params;
}

/**
 * Tidies what the filter bar submits: picking "Custom" fills in the last 30
 * days, swapped dates are put in order, a new range gets its default
 * interval, and defaults leave the URL. Params the query doesn't own stay.
 */
export function normalizeSearch(
  next: URLSearchParams,
  current: URLSearchParams,
  now: Date,
): URLSearchParams {
  const submitted = new URLSearchParams(next);
  if (submitted.get("range") === "custom") {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let end = parseDay(submitted.get("to")) ?? today;
    let start =
      parseDay(submitted.get("from")) ??
      new Date(end.getFullYear(), end.getMonth(), end.getDate() - 29);
    if (start > end) [start, end] = [end, start];
    submitted.set("from", formatDay(start));
    submitted.set("to", formatDay(end));
  }
  const previous = parseQuery(current);
  const parsed = parseQuery(submitted);
  const query =
    parsed.range === previous.range &&
    parsed.from === previous.from &&
    parsed.to === previous.to
      ? parsed
      : {
          ...parsed,
          interval: defaultInterval(
            spanDays(parsed.range, parsed.from, parsed.to),
          ),
        };
  const params = toSearchParams(query);
  for (const [name, value] of next)
    if (!queryParamNames.has(name)) params.append(name, value);
  return params;
}

/** The query as a search string, with extra params such as a scope's filters. */
export function queryString(
  query: AnalyticsQuery,
  extra: Record<string, string> = {},
): string {
  const params = toSearchParams(query);
  for (const [name, value] of Object.entries(extra)) params.set(name, value);
  const search = params.toString();
  return search ? `?${search}` : "";
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
