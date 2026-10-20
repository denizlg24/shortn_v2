import { describe, expect, test } from "bun:test";
import type { EntitlementOverride } from "@shortn/db";
import { ObjectId } from "mongodb";
import { plans, type PlanId } from "./catalog";
import { effectivePlan, resolveEntitlements } from "./entitlements";

const now = new Date("2026-10-20T12:00:00Z");
const later = new Date("2026-12-01T00:00:00Z");
const earlier = new Date("2026-10-01T00:00:00Z");

const sub = (plan: PlanId, status: "active" | "past_due" | "canceled") => ({
  _id: new ObjectId(),
  workspaceId: new ObjectId(),
  polarSubscriptionId: `sub-${plan}`,
  polarCustomerId: "c1",
  productId: "p",
  status,
  plan,
  currentPeriodStart: new Date("2026-10-13T11:00:00Z"),
  currentPeriodEnd: new Date("2026-11-13T11:00:00Z"),
  cancelAtPeriodEnd: false,
});

const override = (
  fields: Partial<EntitlementOverride>,
): EntitlementOverride => ({
  reason: "test",
  grantedBy: "staff",
  grantedAt: earlier,
  ...fields,
});

describe("plan resolution: subscriptions × comp × expiry", () => {
  const cases: {
    name: string;
    subs: ReturnType<typeof sub>[];
    override?: EntitlementOverride;
    plan: PlanId;
    source: "subscription" | "comp" | "free";
  }[] = [
    { name: "nothing", subs: [], plan: "free", source: "free" },
    {
      name: "paid only",
      subs: [sub("plus", "active")],
      plan: "plus",
      source: "subscription",
    },
    {
      name: "comp on free",
      subs: [],
      override: override({ plan: "pro" }),
      plan: "pro",
      source: "comp",
    },
    {
      name: "comp above paid",
      subs: [sub("basic", "active")],
      override: override({ plan: "enterprise" }),
      plan: "enterprise",
      source: "comp",
    },
    {
      name: "comp below paid keeps the paid plan",
      subs: [sub("pro", "past_due")],
      override: override({ plan: "plus" }),
      plan: "pro",
      source: "subscription",
    },
    {
      name: "comp equal to paid is the subscription",
      subs: [sub("pro", "active")],
      override: override({ plan: "pro" }),
      plan: "pro",
      source: "subscription",
    },
    {
      name: "expired comp is ignored",
      subs: [],
      override: override({ plan: "pro", expiresAt: earlier }),
      plan: "free",
      source: "free",
    },
    {
      name: "unexpired comp applies",
      subs: [],
      override: override({ plan: "pro", expiresAt: later }),
      plan: "pro",
      source: "comp",
    },
    {
      name: "canceled subscription with comp",
      subs: [sub("enterprise", "canceled")],
      override: override({ plan: "plus" }),
      plan: "plus",
      source: "comp",
    },
    {
      name: "limits-only override keeps the plan",
      subs: [sub("plus", "active")],
      override: override({ limits: { links: 10 } }),
      plan: "plus",
      source: "subscription",
    },
  ];
  for (const item of cases)
    test(item.name, () => {
      const entitlements = resolveEntitlements(item.subs, now, item.override);
      expect(entitlements.plan).toBe(item.plan);
      expect(entitlements.sources.plan).toBe(item.source);
      expect(effectivePlan(item.subs, item.override, now)).toBe(item.plan);
      expect(entitlements.priceUsdMonthly).toBe(
        plans[item.plan].priceUsdMonthly,
      );
    });
});

test("a comp without a subscription uses the calendar month; with one, the billing period", () => {
  const comp = resolveEntitlements([], now, override({ plan: "pro" }));
  expect(comp.period.start.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  expect(comp.subscription).toBeUndefined();
  const paid = resolveEntitlements(
    [sub("basic", "active")],
    now,
    override({ plan: "pro" }),
  );
  expect(paid.period.start.toISOString()).toBe("2026-10-13T11:00:00.000Z");
  expect(paid.subscription?.id).toBe("sub-basic");
});

test("limit overrides replace single limits, may lower them, and null is unlimited", () => {
  const entitlements = resolveEntitlements(
    [sub("plus", "active")],
    now,
    override({
      limits: { links: 2, bioPages: null, apiPerMinute: 5 },
      expiresAt: later,
    }),
  );
  expect(entitlements.limits).toEqual({
    ...plans.plus.limits,
    links: 2,
    bioPages: null,
    apiPerMinute: 5,
  });
  expect([...entitlements.sources.overriddenLimits].sort()).toEqual([
    "apiPerMinute",
    "bioPages",
    "links",
  ]);
  expect(entitlements.sources.overrideExpiresAt).toEqual(later);
  // An expired override changes nothing at all.
  const expired = resolveEntitlements(
    [sub("plus", "active")],
    now,
    override({ limits: { links: 2 }, expiresAt: earlier }),
  );
  expect(expired.limits).toEqual(plans.plus.limits);
  expect(expired.sources).toEqual({
    plan: "subscription",
    overriddenLimits: [],
  });
});

test("feature overrides add and remove catalog features and ignore unknown names", () => {
  const entitlements = resolveEntitlements(
    [],
    now,
    override({ features: { add: ["api", "notAFeature"], remove: [] } }),
  );
  expect(entitlements.features).toEqual(["api"]);
  const removed = resolveEntitlements(
    [sub("pro", "active")],
    now,
    override({ features: { remove: ["api", "mcp"] } }),
  );
  expect(removed.features).not.toContain("api");
  expect(removed.features).not.toContain("mcp");
  expect(removed.features).toContain("passwords");
});

test("without an override the result is unchanged from before overrides", () => {
  const entitlements = resolveEntitlements([sub("plus", "active")], now);
  expect(entitlements.limits).toEqual(plans.plus.limits);
  expect(entitlements.features).toEqual([...plans.plus.features]);
  expect(entitlements.sources).toEqual({
    plan: "subscription",
    overriddenLimits: [],
  });
});
