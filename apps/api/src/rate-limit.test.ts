import { expect, test } from "bun:test";
import { resolveEntitlements } from "@shortn/billing";
import { ObjectId } from "mongodb";
import { apiRateLimit, rolloutApiPerMinute } from "./rate-limit";

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

test("REST and MCP use catalog rates; enterprise is unlimited and free keeps the rollout rate", () => {
  for (const transport of ["api", "mcp"] as const) {
    expect(apiRateLimit(resolveEntitlements([], now), transport)).toBe(
      rolloutApiPerMinute,
    );
    expect(
      apiRateLimit(resolveEntitlements(paid("basic"), now), transport),
    ).toBe(60);
    expect(
      apiRateLimit(resolveEntitlements(paid("plus"), now), transport),
    ).toBe(300);
    expect(apiRateLimit(resolveEntitlements(paid("pro"), now), transport)).toBe(
      1200,
    );
    expect(
      apiRateLimit(resolveEntitlements(paid("enterprise"), now), transport),
    ).toBeNull();
  }
});

test("staff overrides apply: a comp raises the tier, a limit lowers or lifts it", () => {
  expect(
    apiRateLimit(
      resolveEntitlements([], now, { ...grant, plan: "pro" }),
      "api",
    ),
  ).toBe(1200);
  expect(
    apiRateLimit(
      resolveEntitlements(paid("pro"), now, {
        ...grant,
        limits: { apiPerMinute: 5 },
      }),
      "api",
    ),
  ).toBe(5);
  expect(
    apiRateLimit(
      resolveEntitlements([], now, {
        ...grant,
        limits: { apiPerMinute: null },
      }),
      "mcp",
    ),
  ).toBeNull();
});
