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

test("paid starts and plan changes leave the mail to their order's receipt", () => {
  expect(noticesFor(null, mirror())).toEqual([]);
  expect(noticesFor(mirror({ status: "incomplete" }), mirror())).toEqual([]);
  expect(noticesFor(mirror(), mirror({ plan: "pro" }))).toEqual([]);
});

test("replaying the same state sends nothing", () => {
  const state = mirror({ cancelAtPeriodEnd: true });
  expect(noticesFor(state, state)).toEqual([]);
  const pastDue = mirror({ status: "past_due" });
  expect(noticesFor(pastDue, pastDue)).toEqual([]);
});

test("cancellation, scheduled downgrade and failed payment", () => {
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

test("a subscription that starts past due still reports the failed payment", () => {
  expect(noticesFor(null, mirror({ status: "past_due" }))).toEqual([
    { kind: "payment_failed" },
  ]);
});

test("a subscription that ends sends nothing more", () => {
  expect(noticesFor(mirror(), mirror({ status: "canceled" }))).toEqual([]);
});
