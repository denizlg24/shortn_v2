import type { Dimension } from "@shortn/core";
import type { AnalyticsQuery, FilterDimension, QueryFilter } from "./query";

// One full-table page per breakdown: /analytics/{slug} (17 §Analytics).
export const breakdownSlugs = {
  links: "link",
  branches: "branch",
  countries: "country",
  cities: "city",
  referrers: "referrer",
  devices: "device",
  browsers: "browser",
  os: "os",
  "utm-source": "utmSource",
  "utm-medium": "utmMedium",
  "utm-campaign": "utmCampaign",
} as const satisfies Record<string, Dimension>;

export type BreakdownSlug = keyof typeof breakdownSlugs;
export type BreakdownDimension = (typeof breakdownSlugs)[BreakdownSlug];

export const breakdownOrder = Object.keys(breakdownSlugs).filter(
  (slug): slug is BreakdownSlug => Object.hasOwn(breakdownSlugs, slug),
);

export const isBreakdownSlug = (value: string): value is BreakdownSlug =>
  Object.hasOwn(breakdownSlugs, value);

// Every plan sees which links were clicked; the rest is analyticsBreakdowns.
export const isOpenBreakdown = (dimension: BreakdownDimension) =>
  dimension === "link";

/** The URL filter a row of this breakdown sets; cities have no filter. */
export function filterFor(dimension: BreakdownDimension): QueryFilter | null {
  if (dimension === "link") return "link";
  if (dimension === "city") return null;
  return dimension satisfies FilterDimension;
}

/** The query with a row's filter set, or cleared when it already has it. */
export function toggledFilter(
  query: AnalyticsQuery,
  dimension: BreakdownDimension,
  value: string,
): AnalyticsQuery | null {
  const filter = filterFor(dimension);
  if (!filter) return null;
  const filters = { ...query.filters };
  if (filters[filter] === value) delete filters[filter];
  else filters[filter] = value;
  return { ...query, filters };
}

export const sortColumns = ["name", "clicks", "scans", "total"] as const;
export type SortColumn = (typeof sortColumns)[number];
export type SortDirection = "asc" | "desc";
export interface TableSort {
  column: SortColumn;
  direction: SortDirection;
}

const defaultSort: TableSort = { column: "total", direction: "desc" };
export const firstDirection = (column: SortColumn): SortDirection =>
  column === "name" ? "asc" : "desc";

export function parseSort(sort: string | null, dir: string | null): TableSort {
  const column = sortColumns.find((option) => option === sort);
  if (!column) return defaultSort;
  return {
    column,
    direction: dir === "asc" || dir === "desc" ? dir : firstDirection(column),
  };
}

/** Only non-default sorting goes in the URL. */
export function sortParams(sort: TableSort): Record<string, string> {
  if (
    sort.column === defaultSort.column &&
    sort.direction === defaultSort.direction
  )
    return {};
  return sort.direction === firstDirection(sort.column)
    ? { sort: sort.column }
    : { sort: sort.column, dir: sort.direction };
}

/** Clicking a sorted column flips it; another column starts at its default. */
export const nextSort = (current: TableSort, column: SortColumn): TableSort =>
  current.column === column
    ? { column, direction: current.direction === "asc" ? "desc" : "asc" }
    : { column, direction: firstDirection(column) };

export interface TableRow {
  value: string;
  label: string;
  clicks: number;
  scans: number;
}

export function sortRows<T extends TableRow>(
  rows: readonly T[],
  sort: TableSort,
  collator: Intl.Collator,
): T[] {
  const sign = sort.direction === "asc" ? 1 : -1;
  const measure = (row: T) =>
    sort.column === "clicks"
      ? row.clicks
      : sort.column === "scans"
        ? row.scans
        : row.clicks + row.scans;
  return rows.toSorted((a, b) =>
    sort.column === "name"
      ? sign * collator.compare(a.label, b.label)
      : sign * (measure(a) - measure(b)) || collator.compare(a.label, b.label),
  );
}
