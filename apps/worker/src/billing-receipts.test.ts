import { describe, expect, test } from "bun:test";
import { products } from "@shortn/billing";
import type { Mailer } from "@shortn/emails";
import { MongoClient, ObjectId } from "mongodb";
import {
  cardPaymentFixture,
  itemFixture,
  paidOrderFixture,
  percentageDiscountFixture,
  productFixture,
  subscriptionFixture,
} from "../../../packages/billing/test-fixtures/receipts";
import { billingMailer, handleEvent, type BillingDeps } from "./billing";
import type { MailLedger } from "./billing-mail-ledger";
import { orderMailer } from "./billing-receipts";
import { polarServing, type PolarState } from "./billing-test-polar";

const pro = productFixture(products.sandbox.checkout.pro, "Shortn Pro");
const plus = productFixture(products.sandbox.checkout.plus, "Shortn Plus");
const domains = productFixture("prod_domains", "Custom domains", {
  shortn_addon: "custom_domains",
});

/** Same semantics as the Mongo ledger, kept in memory. */
function memoryLedger(): MailLedger & { keys: () => string[] } {
  const entries = new Map<string, { sentAt?: Date; claimedUntil?: Date }>();
  return {
    async claim(key, now) {
      const entry = entries.get(key);
      if (entry && (entry.sentAt || (entry.claimedUntil ?? now) > now))
        return false;
      entries.set(key, { claimedUntil: new Date(now.getTime() + 600_000) });
      return true;
    },
    async sent(key, now) {
      entries.set(key, { sentAt: now });
    },
    async release(key) {
      if (!entries.get(key)?.sentAt) entries.delete(key);
    },
    keys: () => [...entries.keys()],
  };
}

const recipient = {
  to: "owner@example.test",
  workspace: "Vida Económica",
  url: "https://app.shortn.at/vida-economica/settings/billing",
};

function receiptsFor(state: PolarState, ledger = memoryLedger()) {
  const { polar } = polarServing(state);
  const receipts: Parameters<Mailer["billingReceipt"]>[0][] = [];
  const refunds: Parameters<Mailer["billingRefund"]>[0][] = [];
  let failNext = false;
  const send = orderMailer({
    polar,
    ledger,
    server: "sandbox",
    log: () => {},
    recipients: { forOrder: async () => recipient },
    mailer: {
      async billingReceipt(input) {
        if (failNext) {
          failNext = false;
          throw new Error("Resend: application_error");
        }
        receipts.push(input);
      },
      async billingRefund(input) {
        refunds.push(input);
      },
    },
  });
  return {
    send,
    receipts,
    refunds,
    ledger,
    failNextSend: () => {
      failNext = true;
    },
  };
}

describe("receipts", () => {
  test("a new subscription with a percentage discount and tax", async () => {
    const order = paidOrderFixture("ord_new", {
      billing_reason: "subscription_create",
      product_id: pro.id,
      product: pro,
      subscription: subscriptionFixture("sub_1", pro.id),
      discount: percentageDiscountFixture("Launch offer", "LAUNCH20", 2000),
      discount_id: "00000000-0000-4000-8000-0000000000d1",
      items: [itemFixture("Shortn Pro", 1500, 276)],
      subtotal_amount: 1500,
      discount_amount: 300,
      net_amount: 1200,
      tax_amount: 276,
      total_amount: 1476,
      invoice_number: "SHORTN-2026-0042",
    });
    const { send, receipts } = receiptsFor({
      orders: [order],
      payments: [cardPaymentFixture(order.id, { amount: 1476 })],
    });
    await send({ type: "order.paid", orderId: order.id });
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({
      ...recipient,
      locale: "en",
      idempotencyKey: "receipt:ord_new",
      receipt: {
        reason: "subscription_create",
        plan: "Pro",
        product: "Shortn Pro",
        currency: "eur",
        items: [{ label: "Shortn Pro", amount: 1500 }],
        subtotal: 1500,
        discount: { amount: 300, name: "Launch offer", code: "LAUNCH20" },
        tax: 276,
        appliedBalance: 0,
        total: 1476,
        card: { brand: "visa", last4: "4242" },
        invoiceNumber: "SHORTN-2026-0042",
        period: {
          start: new Date("2026-10-01T12:00:00Z"),
          end: new Date("2026-11-01T12:00:00Z"),
        },
        nextRenewal: new Date("2026-11-01T12:00:00Z"),
      },
    });
  });

  test("an upgrade lists its proration lines", async () => {
    const order = paidOrderFixture("ord_upgrade", {
      billing_reason: "subscription_update",
      product_id: pro.id,
      product: pro,
      subscription: subscriptionFixture("sub_1", pro.id),
      items: [
        itemFixture("Unused time on Shortn Plus", -400, -92, true),
        itemFixture("Remaining time on Shortn Pro", 750, 172, true),
      ],
      subtotal_amount: 350,
      net_amount: 350,
      tax_amount: 80,
      total_amount: 430,
    });
    const { send, receipts } = receiptsFor({
      orders: [order],
      payments: [cardPaymentFixture(order.id, { brand: "mastercard" })],
    });
    await send({ type: "order.paid", orderId: order.id });
    expect(receipts[0]?.receipt).toMatchObject({
      reason: "subscription_update",
      plan: "Pro",
      items: [
        { label: "Unused time on Shortn Plus", amount: -400 },
        { label: "Remaining time on Shortn Pro", amount: 750 },
      ],
      total: 430,
      card: { brand: "mastercard", last4: "4242" },
    });
    expect(receipts[0]?.receipt.discount).toBeUndefined();
  });

  test("a renewal, and no next renewal once it is set to cancel", async () => {
    const renewal = paidOrderFixture("ord_cycle", {
      billing_reason: "subscription_cycle",
      product_id: plus.id,
      product: plus,
      subscription: subscriptionFixture("sub_1", plus.id, {
        current_period_start: "2026-11-01T12:00:00Z",
        current_period_end: "2026-12-01T12:00:00Z",
      }),
      items: [itemFixture("Shortn Plus", 800, 184)],
      subtotal_amount: 800,
      net_amount: 800,
      tax_amount: 184,
      total_amount: 984,
    });
    const ending = paidOrderFixture("ord_cycle_ending", {
      ...renewal,
      id: "ord_cycle_ending",
      subscription: subscriptionFixture("sub_1", plus.id, {
        cancel_at_period_end: true,
      }),
    });
    const { send, receipts } = receiptsFor({
      orders: [renewal, ending],
      payments: [cardPaymentFixture(renewal.id)],
    });
    await send({ type: "order.paid", orderId: renewal.id });
    await send({ type: "order.paid", orderId: ending.id });
    expect(receipts[0]?.receipt).toMatchObject({
      reason: "subscription_cycle",
      plan: "Plus",
      period: {
        start: new Date("2026-11-01T12:00:00Z"),
        end: new Date("2026-12-01T12:00:00Z"),
      },
      nextRenewal: new Date("2026-12-01T12:00:00Z"),
    });
    expect(receipts[1]?.receipt.nextRenewal).toBeUndefined();
  });

  test("a zero-total order has no card to show", async () => {
    const order = paidOrderFixture("ord_free", {
      billing_reason: "subscription_create",
      product_id: pro.id,
      product: pro,
      subscription: subscriptionFixture("sub_1", pro.id),
      discount: percentageDiscountFixture("Press partners", null, 10000),
      items: [itemFixture("Shortn Pro", 1500, 0)],
      subtotal_amount: 1500,
      discount_amount: 1500,
      net_amount: 0,
      tax_amount: 0,
      total_amount: 0,
    });
    const { send, receipts } = receiptsFor({ orders: [order], payments: [] });
    await send({ type: "order.paid", orderId: order.id });
    expect(receipts[0]?.receipt).toMatchObject({ total: 0 });
    expect(receipts[0]?.receipt.card).toBeUndefined();
  });

  test("an add-on order is a receipt for the product, not a plan", async () => {
    const order = paidOrderFixture("ord_addon", {
      billing_reason: "subscription_create",
      product_id: domains.id,
      product: domains,
      items: [itemFixture("Custom domains", 300, 69)],
      subtotal_amount: 300,
      net_amount: 300,
      tax_amount: 69,
      total_amount: 369,
    });
    const { send, receipts } = receiptsFor({
      orders: [order],
      payments: [cardPaymentFixture(order.id)],
    });
    await send({ type: "order.paid", orderId: order.id });
    expect(receipts[0]?.receipt).toMatchObject({
      product: "Custom domains",
      reason: "subscription_create",
    });
    expect(receipts[0]?.receipt.plan).toBeUndefined();
  });

  test("replays, redeliveries and other workers never resend", async () => {
    const order = paidOrderFixture("ord_replay", { product: pro });
    const ledger = memoryLedger();
    const state = {
      orders: [order],
      payments: [cardPaymentFixture(order.id)],
    };
    const first = receiptsFor(state, ledger);
    const second = receiptsFor(state, ledger);
    await first.send({ type: "order.paid", orderId: order.id });
    await first.send({ type: "order.paid", orderId: order.id });
    await second.send({ type: "order.paid", orderId: order.id });
    expect(first.receipts.length + second.receipts.length).toBe(1);
    expect(ledger.keys()).toEqual(["receipt:ord_replay"]);
  });

  test("a failed send is retried rather than lost", async () => {
    const order = paidOrderFixture("ord_retry", { product: pro });
    const { send, receipts, failNextSend } = receiptsFor({
      orders: [order],
      payments: [cardPaymentFixture(order.id)],
    });
    failNextSend();
    await expect(
      send({ type: "order.paid", orderId: order.id }),
    ).rejects.toThrow("Resend");
    await send({ type: "order.paid", orderId: order.id });
    expect(receipts).toHaveLength(1);
  });

  test("an unpaid order and unrelated order events send nothing", async () => {
    const order = paidOrderFixture("ord_pending", {
      status: "pending",
      paid: false,
    });
    const { send, receipts, refunds } = receiptsFor({
      orders: [order],
      payments: [],
    });
    await send({ type: "order.paid", orderId: order.id });
    await send({ type: "order.created", orderId: order.id });
    await send({ type: "order.refunded", orderId: order.id });
    expect(receipts).toHaveLength(0);
    expect(refunds).toHaveLength(0);
  });
});

describe("refunds", () => {
  test("a refund reports the amount with tax, the card and the order", async () => {
    const order = paidOrderFixture("ord_refund", {
      status: "refunded",
      product: pro,
      total_amount: 1476,
      refunded_amount: 1200,
      refunded_tax_amount: 276,
      invoice_number: "SHORTN-2026-0042",
    });
    const { send, refunds } = receiptsFor({
      orders: [order],
      payments: [cardPaymentFixture(order.id, { last4: "0005" })],
    });
    await send({ type: "order.refunded", orderId: order.id });
    await send({ type: "order.refunded", orderId: order.id });
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({
      ...recipient,
      idempotencyKey: "refund:ord_refund:1476",
      refund: {
        currency: "eur",
        refunded: 1200,
        refundedTax: 276,
        originalTotal: 1476,
        product: "Shortn Pro",
        card: { brand: "visa", last4: "0005" },
        reference: "SHORTN-2026-0042",
      },
    });
  });

  test("a second partial refund is its own email", async () => {
    const order = paidOrderFixture("ord_partial", {
      status: "partially_refunded",
      product: pro,
      refunded_amount: 500,
      refunded_tax_amount: 115,
    });
    const state = { orders: [order], payments: [] };
    const { send, refunds } = receiptsFor(state);
    await send({ type: "order.refunded", orderId: order.id });
    state.orders = [
      { ...order, refunded_amount: 1000, refunded_tax_amount: 230 },
    ];
    await send({ type: "order.refunded", orderId: order.id });
    expect(refunds.map((refund) => refund.idempotencyKey)).toEqual([
      "refund:ord_partial:615",
      "refund:ord_partial:1230",
    ]);
    expect(refunds[0]?.refund.card).toBeUndefined();
  });
});

describe("failed payments", () => {
  const mirror = (status: "active" | "past_due") => ({
    _id: new ObjectId(),
    workspaceId: new ObjectId(),
    polarSubscriptionId: "sub_late",
    polarCustomerId: "cus_1",
    productId: pro.id,
    status,
    plan: "pro" as const,
    currentPeriodStart: new Date("2026-10-01"),
    currentPeriodEnd: new Date("2026-11-01"),
    cancelAtPeriodEnd: false,
  });

  function failedPaymentMail(state: PolarState) {
    const { polar } = polarServing(state);
    const sent: Parameters<Mailer["billing"]>[0][] = [];
    const onApplied = billingMailer({
      polar,
      ledger: memoryLedger(),
      log: () => {},
      recipients: { forWorkspace: async () => recipient },
      mailer: {
        async billing(input) {
          sent.push(input);
        },
      },
    });
    const transition = () =>
      onApplied({
        status: "applied",
        before: mirror("active"),
        after: mirror("past_due"),
      });
    return { sent, transition };
  }

  test("the email names the amount, card, decline and next attempt", async () => {
    const order = paidOrderFixture("ord_late", {
      status: "pending",
      paid: false,
      subscription_id: "sub_late",
      billing_reason: "subscription_cycle",
      total_amount: 1476,
      due_amount: 1476,
      next_payment_attempt_at: "2026-11-04T12:00:00Z",
    });
    const { sent, transition } = failedPaymentMail({
      orders: [order],
      payments: [
        cardPaymentFixture(order.id, {
          status: "failed",
          created_at: "2026-11-01T12:00:00Z",
          decline_reason: "insufficient_funds",
          decline_message: "Your card has insufficient funds.",
          last4: "9995",
        }),
      ],
    });
    await transition();
    await transition();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      ...recipient,
      idempotencyKey: "payment-failed:ord_late",
      notice: {
        kind: "payment_failed",
        failure: {
          currency: "eur",
          amountDue: 1476,
          card: { brand: "visa", last4: "9995" },
          declineReason: "insufficient_funds",
          declineMessage: "Your card has insufficient funds.",
          nextAttemptAt: new Date("2026-11-04T12:00:00Z"),
        },
      },
    });
  });

  test("a Polar outage still sends the plain notice", async () => {
    const { sent, transition } = failedPaymentMail({
      orders: [],
      payments: [],
      down: true,
    });
    await transition();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.notice).toEqual({ kind: "payment_failed" });
    // Keyed by subscription and period, so later events while past due
    // don't resend it.
    expect(sent[0]?.idempotencyKey).toMatch(/^payment-failed:sub_late:/);
    await transition();
    expect(sent).toHaveLength(1);
  });
});

describe("event routing", () => {
  // Never connected: an event without subscriptions touches no collection.
  const db = new MongoClient("mongodb://127.0.0.1:1").db("never");
  const routed = (mode: BillingDeps["mode"]) => {
    const calls: { type: string; orderId: string }[] = [];
    const deps: BillingDeps = {
      db,
      mode,
      server: "sandbox",
      log: () => {},
      polar: {
        subscriptions: {
          get: async () => {
            throw new Error("no subscription expected");
          },
        },
      },
      onOrder: async (event) => {
        calls.push(event);
      },
    };
    return { deps, calls };
  };
  const event = {
    _id: "msg_order",
    type: "order.paid",
    subscriptionIds: [],
    orderId: "ord_1",
  };

  test("shadow mode sends nothing for order events", async () => {
    const { deps, calls } = routed("shadow");
    await handleEvent(deps, event);
    expect(calls).toEqual([]);
  });

  test("live mode hands order events to the mailer", async () => {
    const { deps, calls } = routed("live");
    await handleEvent(deps, event);
    await handleEvent(deps, {
      ...event,
      _id: "msg_sub",
      type: "subscription.updated",
      orderId: undefined,
    });
    expect(calls).toEqual([{ type: "order.paid", orderId: "ord_1" }]);
  });
});
