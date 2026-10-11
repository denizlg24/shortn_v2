import { expect, test } from "bun:test";
import { ObjectId } from "mongodb";
import { minimumPlanFor, planForProduct, resolveEntitlements } from "./index";

const sub = (overrides: Record<string, unknown>) => ({
  _id: new ObjectId(),
  workspaceId: new ObjectId(),
  polarSubscriptionId: "s1",
  polarCustomerId: "c1",
  productId: "p",
  status: "active" as const,
  plan: "plus" as const,
  currentPeriodStart: new Date("2026-09-13T11:00:00Z"),
  currentPeriodEnd: new Date("2026-10-13T11:00:00Z"),
  cancelAtPeriodEnd: false,
  ...overrides,
});

test("no paid subscription means free on the UTC calendar month", () => {
  const e = resolveEntitlements([], new Date("2026-10-10T12:00:00Z"));
  expect(e.plan).toBe("free");
  expect(e.limits.links).toBe(5);
  expect(e.period.start.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  expect(e.period.end.toISOString()).toBe("2026-11-01T00:00:00.000Z");
});

test("the highest paid plan wins and canceled ones are ignored", () => {
  const e = resolveEntitlements([
    sub({ plan: "pro", status: "canceled" }),
    sub({ plan: "basic", status: "past_due" }),
    sub({ plan: "plus" }),
  ]);
  expect(e.plan).toBe("plus");
  expect(e.interstitialByDefault).toBe(false);
});

test("a stale mirror period rolls forward to contain now", () => {
  const e = resolveEntitlements([sub({})], new Date("2026-12-01T00:00:00Z"));
  expect(e.period.start.toISOString()).toBe("2026-11-13T11:00:00.000Z");
  expect(e.period.end.toISOString()).toBe("2026-12-13T11:00:00.000Z");
});

test("products map by id or metadata, never by name", () => {
  expect(
    planForProduct("production", "b00069fc-96e0-40ac-9e06-ced7592b9667"),
  ).toBe("pro");
  expect(
    planForProduct("sandbox", "eeda3681-3c94-495e-9ba0-47c5e46810ab"),
  ).toBe("basic");
  expect(planForProduct("production", "unknown")).toBeUndefined();
  expect(planForProduct("production", "x", { shortn_plan: "enterprise" })).toBe(
    "enterprise",
  );
});

test("feature gates keep the legacy plan floor", () => {
  expect(minimumPlanFor("passwords")).toBe("pro");
  expect(minimumPlanFor("campaigns")).toBe("plus");
  expect(minimumPlanFor("customKeys")).toBe("basic");
});
