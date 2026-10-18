import { expect, test } from "bun:test";
import { analyticsExportReview } from "./analytics-export-review";

test("review preserves owned scope, literal filters, timezone and requested aggregate group", () => {
  const value = analyticsExportReview(
    {
      from: "2026-10-01T00:00:00Z",
      to: "2026-10-15T00:00:00Z",
      timezone: "Europe/Copenhagen",
      interval: "week",
      campaign: "000000000000000000000001",
      link: "000000000000000000000002",
      country: "São João",
      dimension: "country",
      returnTo: "/demo/analytics/countries?country=S%C3%A3o",
    },
    "demo",
  );
  expect(value.input?.scope).toEqual({
    type: "campaign",
    id: "000000000000000000000001",
  });
  expect(value.input?.filters).toEqual({
    country: "São João",
    link: "000000000000000000000002",
  });
  expect(value.input?.dimensions).toEqual(["country"]);
  expect(value.input?.timezone).toBe("Europe/Copenhagen");
  expect(value.input?.interval).toBe("week");
  expect(value.back).toBe("/demo/analytics/countries?country=S%C3%A3o");
});
test("review rejects invalid ranges/groups and external, foreign-workspace or recursive returns", () => {
  for (const returnTo of [
    "https://foreign.invalid",
    "//foreign.invalid",
    "/other/analytics",
    "/demo/analytics/export",
    "/demo/analytics/exports",
    "/demo/analytics\\@foreign.invalid",
  ])
    expect(analyticsExportReview({ returnTo }, "demo").back).toBe(
      "/demo/analytics",
    );
  expect(analyticsExportReview({ from: "bad-date" }, "demo").input).toBeNull();
  expect(
    analyticsExportReview({ dimension: "$where" }, "demo").input,
  ).toBeNull();
  expect(
    analyticsExportReview({}, "demo", new Date("2026-10-15T12:00:00Z")).input
      ?.to,
  ).toBe("2026-10-15T12:00:00.000Z");
});
