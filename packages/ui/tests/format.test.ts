import { describe, expect, test } from "bun:test";
import {
  formatAge,
  formatNumber,
  formatPercent,
  INTL_LOCALE,
  uiStringsEn,
  uiStringsPt,
} from "@shortn/ui";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const now = new Date("2026-06-15T12:00:00Z");
const ago = (elapsed: number) => new Date(now.getTime() - elapsed);

describe("formatAge", () => {
  test.each([
    [0, "now"],
    [MINUTE - 1, "now"],
    [MINUTE, "1m"],
    [59 * MINUTE, "59m"],
    [HOUR, "1h"],
    [23 * HOUR, "23h"],
    [DAY, "1d"],
    [13 * DAY, "13d"],
    [14 * DAY, "2w"],
    [59 * DAY, "8w"],
    [60 * DAY, "2mo"],
    [364 * DAY, "12mo"],
    [365 * DAY, "1y"],
  ])("%d ms ago reads %s", (elapsed, expected) => {
    expect(formatAge(ago(elapsed), now, uiStringsEn.ageUnits)).toBe(expected);
  });

  test("treats future dates as now", () => {
    expect(formatAge(ago(-5 * MINUTE), now, uiStringsEn.ageUnits)).toBe("now");
  });

  test("uses the locale's units and separator", () => {
    expect(formatAge(ago(3 * HOUR), now, uiStringsPt.ageUnits)).toBe("3 h");
    expect(formatAge(ago(21 * DAY), now, uiStringsPt.ageUnits)).toBe("3 sem");
  });
});

describe("number formatting", () => {
  test("groups thousands for the locale", () => {
    expect(formatNumber(1_234_567, INTL_LOCALE.en)).toBe("1,234,567");
    expect(formatNumber(1_234_567, "de-DE")).toBe("1.234.567");
  });

  test("formats ratios as percentages with at most one decimal", () => {
    expect(formatPercent(0.1234, INTL_LOCALE.en)).toBe("12.3%");
    expect(formatPercent(1, INTL_LOCALE.en)).toBe("100%");
  });
});
