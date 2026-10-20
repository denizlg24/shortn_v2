import { expect, test } from "bun:test";
import { resolveEntitlements } from "@shortn/billing";
import { ObjectId } from "mongodb";
import {
  apiRateLimit,
  enterpriseApiCeiling,
  rolloutApiPerMinute,
} from "./rate-limit";

const now = new Date("2026-10-20T12:00:00Z");
const paid = (plan: "basic" | "plus" | "pro" | "enterprise") => [
  {
    _id: new ObjectId(),
    workspaceId: new ObjectId(),
    polarSubscriptionId: plan,
    polarCustomerId: "c",
    productId: "p",
    status: "active" as const,
    plan,
    currentPeriodStart: now,
    currentPeriodEnd: new Date(now.getTime() + 86_400_000),
    cancelAtPeriodEnd: false,
  },
];
const grant = { reason: "r", grantedBy: "staff", grantedAt: now };

test("catalog rates apply; free keeps the rollout rate; enterprise runs under a ceiling", () => {
  expect(apiRateLimit(resolveEntitlements([], now))).toBe(rolloutApiPerMinute);
  expect(apiRateLimit(resolveEntitlements(paid("basic"), now))).toBe(60);
  expect(apiRateLimit(resolveEntitlements(paid("plus"), now))).toBe(300);
  expect(apiRateLimit(resolveEntitlements(paid("pro"), now))).toBe(1200);
  expect(apiRateLimit(resolveEntitlements(paid("enterprise"), now))).toBe(
    enterpriseApiCeiling,
  );
});

test("adding the API feature never makes a plan without a catalog rate unlimited", () => {
  expect(
    apiRateLimit(
      resolveEntitlements([], now, {
        ...grant,
        features: { add: ["api", "mcp"] },
      }),
    ),
  ).toBe(rolloutApiPerMinute);
});

test("staff overrides apply: a comp raises the tier, a limit lowers it, only an explicit null lifts it", () => {
  expect(
    apiRateLimit(resolveEntitlements([], now, { ...grant, plan: "pro" })),
  ).toBe(1200);
  expect(
    apiRateLimit(
      resolveEntitlements([], now, { ...grant, plan: "enterprise" }),
    ),
  ).toBe(enterpriseApiCeiling);
  expect(
    apiRateLimit(
      resolveEntitlements(paid("pro"), now, {
        ...grant,
        limits: { apiPerMinute: 5 },
      }),
    ),
  ).toBe(5);
  expect(
    apiRateLimit(
      resolveEntitlements([], now, {
        ...grant,
        limits: { apiPerMinute: null },
      }),
    ),
  ).toBeNull();
});
