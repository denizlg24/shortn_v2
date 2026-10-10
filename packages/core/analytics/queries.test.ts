import { expect, test } from "bun:test";
import { plans } from "@shortn/billing";
import { bucketStarts, clampRange, truncate } from "./queries";

test("day buckets follow the zone across the October DST change", () => {
  const starts = bucketStarts(
    {
      from: new Date("2026-10-24T00:00:00Z"),
      to: new Date("2026-10-27T00:00:00Z"),
      timezone: "Europe/Lisbon",
    },
    "day",
  ).map((d) => d.toISOString());
  expect(starts).toEqual([
    "2026-10-23T23:00:00.000Z",
    "2026-10-24T23:00:00.000Z",
    "2026-10-26T00:00:00.000Z",
  ]);
});

test("weeks start on Monday and months on the 1st in the zone", () => {
  expect(
    truncate(new Date("2026-10-10T12:00:00Z"), "week", "UTC").toISOString(),
  ).toBe("2026-10-05T00:00:00.000Z");
  const months = bucketStarts(
    {
      from: new Date("2026-01-15T00:00:00Z"),
      to: new Date("2026-04-01T00:00:00Z"),
      timezone: "UTC",
    },
    "month",
  ).map((d) => d.toISOString().slice(0, 10));
  expect(months).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
});

test("the plan window clamps the start, never the end", () => {
  const now = new Date("2026-10-10T00:00:00Z");
  const range = {
    from: new Date("2026-01-01T00:00:00Z"),
    to: now,
    timezone: "UTC",
  };
  expect(
    clampRange(range, { limits: plans.free.limits }, now).from.toISOString(),
  ).toBe("2026-09-10T00:00:00.000Z");
});
