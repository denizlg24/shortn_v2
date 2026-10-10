import { expect, test } from "bun:test";
import { ObjectId } from "mongodb";
import { noticesFor } from "./billing-notices";

const mirror = (overrides: Record<string, unknown> = {}) => ({
  _id: new ObjectId(),
  workspaceId: new ObjectId(),
  polarSubscriptionId: "s",
  polarCustomerId: "c",
  productId: "p",
  status: "active" as const,
  plan: "plus" as const,
  currentPeriodStart: new Date("2026-10-01"),
  currentPeriodEnd: new Date("2026-11-01"),
  cancelAtPeriodEnd: false,
  ...overrides,
});

test("a new paid subscription sends only the welcome", () => {
  expect(noticesFor(null, mirror())).toEqual([
    { kind: "started", plan: "plus" },
  ]);
  expect(noticesFor(mirror({ status: "incomplete" }), mirror())).toEqual([
    { kind: "started", plan: "plus" },
  ]);
});

test("replaying the same state sends nothing", () => {
  const state = mirror({ cancelAtPeriodEnd: true });
  expect(noticesFor(state, state)).toEqual([]);
});

test("upgrade, cancellation, scheduled downgrade and failed payment", () => {
  expect(noticesFor(mirror(), mirror({ plan: "pro" }))).toEqual([
    { kind: "changed", plan: "pro" },
  ]);
  expect(noticesFor(mirror(), mirror({ cancelAtPeriodEnd: true }))).toEqual([
    { kind: "canceled", at: new Date("2026-11-01") },
  ]);
  const at = new Date("2026-11-01");
  expect(
    noticesFor(
      mirror(),
      mirror({ scheduledChange: { productId: "b", plan: "basic", at } }),
    ),
  ).toEqual([{ kind: "scheduled", plan: "basic", at }]);
  expect(noticesFor(mirror(), mirror({ status: "past_due" }))).toEqual([
    { kind: "payment_failed" },
  ]);
});

test("a subscription that ends sends nothing more", () => {
  expect(noticesFor(mirror(), mirror({ status: "canceled" }))).toEqual([]);
});
