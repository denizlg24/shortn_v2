import { expect, test } from "bun:test";
import { ObjectId } from "mongodb";
import { platformFeatureEnabled } from "./features";

test("P6 flags default off and explicit workspace overrides win", () => {
  const workspace = { _id: new ObjectId() };
  expect(platformFeatureEnabled(workspace, "api")).toBe(false);
  expect(platformFeatureEnabled(workspace, "api", 100)).toBe(true);
  expect(
    platformFeatureEnabled(
      { ...workspace, platformFeatures: { api: false } },
      "api",
      100,
    ),
  ).toBe(false);
  expect(
    platformFeatureEnabled(
      { ...workspace, platformFeatures: { api: true } },
      "api",
      0,
    ),
  ).toBe(true);
  for (const percentage of [-1, NaN, Infinity, 101])
    expect(platformFeatureEnabled(workspace, "api", percentage)).toBe(false);
});

test("cohorts are repeatable, monotonic and cover approximately ten percent", () => {
  const workspaces = Array.from({ length: 10_000 }, (_, i) => ({
    _id: new ObjectId(i.toString(16).padStart(24, "0")),
  }));
  const ten = workspaces.filter((workspace) =>
    platformFeatureEnabled(workspace, "api", 10),
  );
  expect(ten.length).toBeGreaterThan(900);
  expect(ten.length).toBeLessThan(1100);
  for (const workspace of ten) {
    expect(platformFeatureEnabled(workspace, "api", 10)).toBe(true);
    expect(platformFeatureEnabled(workspace, "api", 50)).toBe(true);
  }
});
