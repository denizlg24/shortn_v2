import { describe, expect, test } from "bun:test";
import { nextSort, parseSort, sortParams, sortRows } from "./breakdowns";

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
