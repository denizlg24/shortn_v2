import { describe, expect, test } from "bun:test";
import {
  allowedIntervals,
  normalizeSearch,
  parseQuery,
  resolveRange,
  spanDays,
  toSearchParams,
} from "./query";

const parse = (search: string) => parseQuery(new URLSearchParams(search));

describe("parseQuery", () => {
  test("defaults to the last 30 days by day", () => {
    expect(parse("")).toEqual({
      range: "30d",
      from: null,
      to: null,
      interval: "day",
      filters: {},
    });
  });

  test("drops intervals that don't fit the range", () => {
    expect(parse("range=12m&interval=hour").interval).toBe("week");
    expect(parse("range=7d&interval=hour").interval).toBe("hour");
  });

  test("falls back when a custom range is invalid", () => {
    expect(parse("range=custom&from=2026-10-09&to=2026-10-01").range).toBe(
      "30d",
    );
    expect(parse("range=custom&from=2026-02-30&to=2026-03-01").range).toBe(
      "30d",
    );
  });

  test("keeps known filters only", () => {
    expect(parse("country=PT&device=mobile&link=abc&foo=bar").filters).toEqual({
      country: "PT",
      device: "mobile",
    });
  });

  test("accepts a link id and a click or scan type", () => {
    const link = "64b7f0c2a1b2c3d4e5f60718";
    expect(parse(`link=${link}&kind=scan`).filters).toEqual({
      link,
      kind: "scan",
    });
    expect(parse("kind=views").filters).toEqual({});
  });

  test("round-trips through search params", () => {
    for (const search of [
      "",
      "range=7d&interval=hour",
      "range=custom&from=2026-09-01&to=2026-09-03&referrer=direct",
      "range=12m&interval=month&utmSource=newsletter",
    ]) {
      const query = parse(search);
      expect(parse(toSearchParams(query).toString())).toEqual(query);
    }
    expect(toSearchParams(parse("range=30d&interval=day")).toString()).toBe("");
  });
});

describe("ranges", () => {
  test("custom spans count both ends", () => {
    expect(spanDays("custom", "2026-10-01", "2026-10-01")).toBe(1);
    expect(spanDays("custom", "2026-10-01", "2026-10-07")).toBe(7);
  });

  test("hourly only for short ranges, monthly only for long ones", () => {
    expect(allowedIntervals(7)).toEqual(["hour", "day"]);
    expect(allowedIntervals(30)).toEqual(["day", "week"]);
    expect(allowedIntervals(365)).toEqual(["day", "week", "month"]);
  });

  test("presets start at a local midnight and end now", () => {
    const now = new Date(2026, 9, 10, 15, 30);
    const { from, to } = resolveRange(
      { range: "7d", from: null, to: null },
      now,
    );
    expect(from).toEqual(new Date(2026, 9, 4));
    expect(to).toEqual(now);
    expect(
      resolveRange({ range: "12m", from: null, to: null }, now).from,
    ).toEqual(new Date(2025, 10, 1));
  });

  test("custom ranges include the end day and never pass now", () => {
    const now = new Date(2026, 9, 10, 15, 30);
    expect(
      resolveRange(
        { range: "custom", from: "2026-10-01", to: "2026-10-03" },
        now,
      ),
    ).toEqual({ from: new Date(2026, 9, 1), to: new Date(2026, 9, 4) });
    expect(
      resolveRange(
        { range: "custom", from: "2026-10-08", to: "2026-10-10" },
        now,
      ).to,
    ).toEqual(now);
  });
});

describe("normalizeSearch", () => {
  const now = new Date(2026, 9, 10, 15, 30);
  const normalize = (next: string, current = "") =>
    normalizeSearch(
      new URLSearchParams(next),
      new URLSearchParams(current),
      now,
    ).toString();

  test("picking Custom fills in the last 30 days", () => {
    expect(normalize("range=custom&interval=day")).toBe(
      "range=custom&from=2026-09-11&to=2026-10-10",
    );
  });

  test("puts swapped dates in order", () => {
    expect(
      normalize(
        "range=custom&from=2026-10-05&to=2026-10-01",
        "range=custom&from=2026-09-01&to=2026-10-01",
      ),
    ).toBe("range=custom&from=2026-10-01&to=2026-10-05");
  });

  test("a new range gets its default interval; same range keeps the choice", () => {
    expect(normalize("range=12m&interval=day")).toBe("range=12m");
    expect(normalize("range=12m&interval=day", "range=12m")).toBe(
      "range=12m&interval=day",
    );
  });

  test("drops defaults and from/to outside custom, keeps foreign params", () => {
    expect(
      normalize(
        "range=30d&from=2026-10-01&to=2026-10-02&country=PT&sort=name",
        "range=30d",
      ),
    ).toBe("country=PT&sort=name");
  });
});
