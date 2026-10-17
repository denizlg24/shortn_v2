import { describe, expect, test } from "bun:test";
import {
  breakdownSlugs,
  isOpenBreakdown,
  toggledFilter,
  nextSort,
  parseSort,
  sortParams,
  sortRows,
} from "./breakdowns";

import { parseQuery, queryString } from "./query";

test("branch drilldown preserves scope and survives URL round trips", () => {
  const query = parseQuery(
    new URLSearchParams(
      "range=7d&link=0123456789abcdef01234567&kind=scan&country=PT",
    ),
  );
  const filtered = toggledFilter(query, breakdownSlugs.branches, "rotation:1")!;
  expect(isOpenBreakdown("branch")).toBe(false);
  expect(filtered.filters).toEqual({ ...query.filters, branch: "rotation:1" });
  expect(
    parseQuery(new URLSearchParams(queryString(filtered).slice(1))),
  ).toEqual(filtered);
  expect(toggledFilter(filtered, "branch", "rotation:1")!.filters).toEqual(
    query.filters,
  );
});

const rows = [
  { value: "PT", label: "Portugal", clicks: 5, scans: 1 },
  { value: "ES", label: "Spain", clicks: 2, scans: 9 },
  { value: "BR", label: "Brazil", clicks: 5, scans: 1 },
];
const collator = new Intl.Collator("en");

describe("breakdown sorting", () => {
  test("defaults to the largest total first, ties by name", () => {
    const sort = parseSort(null, null);
    expect(sortRows(rows, sort, collator).map((row) => row.value)).toEqual([
      "ES",
      "BR",
      "PT",
    ]);
    expect(sortParams(sort)).toEqual({});
  });

  test("names sort A to Z first, numbers largest first", () => {
    expect(parseSort("name", null)).toEqual({
      column: "name",
      direction: "asc",
    });
    expect(nextSort(parseSort("name", null), "scans")).toEqual({
      column: "scans",
      direction: "desc",
    });
    expect(nextSort(parseSort("scans", null), "scans").direction).toBe("asc");
  });

  test("keeps only non-default params and ignores junk", () => {
    expect(sortParams({ column: "name", direction: "asc" })).toEqual({
      sort: "name",
    });
    expect(sortParams({ column: "total", direction: "asc" })).toEqual({
      sort: "total",
      dir: "asc",
    });
    expect(parseSort("ip", "up")).toEqual({
      column: "total",
      direction: "desc",
    });
  });
});
