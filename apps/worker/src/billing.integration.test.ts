import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { applyFetched, products, type SubscriptionLike } from "@shortn/billing";
import { collection, physicalNames } from "@shortn/db";
import type { Mailer } from "@shortn/emails";
import { MongoClient, ObjectId, type Db } from "mongodb";
import {
  cardPaymentFixture,
  paidOrderFixture,
  productFixture,
} from "../../../packages/billing/test-fixtures/receipts";
import { processBillingEvents, type BillingDeps } from "./billing";
import { mongoMailLedger, sendOnce } from "./billing-mail-ledger";
import { noticesFor } from "./billing-notices";
import { orderMailer } from "./billing-receipts";
import { billingRecipients } from "./billing-recipients";
import { polarServing } from "./billing-test-polar";

const mongoUrl = process.env.MONGO_TEST_URL;

(mongoUrl ? describe : describe.skip)("billing event processing", () => {
  let client: MongoClient;
  let db: Db;
  beforeAll(async () => {
    client = await new MongoClient(mongoUrl ?? "").connect();
    db = client.db(
      `shortn_worker_billing_${crypto.randomUUID().replaceAll("-", "")}`,
    );
    await collection(db, "subscriptions").createIndex(
      { polarSubscriptionId: 1 },
      { unique: true },
    );
  });
  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
  });

  const subscription = (
    overrides: Partial<SubscriptionLike> & { userId: string },
  ): SubscriptionLike => ({
    id: "sub_1",
    status: "active",
    metadata: {},
    customerId: "cus_1",
    productId: products.sandbox.checkout.plus,
    currentPeriodStart: new Date("2026-10-01T00:00:00Z"),
    currentPeriodEnd: new Date("2026-11-01T00:00:00Z"),
    cancelAtPeriodEnd: false,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    modifiedAt: new Date("2026-10-01T00:00:00Z"),
    endsAt: null,
    customer: { externalId: overrides.userId },
    product: { metadata: {}, name: "Plus Plan" },
    pendingUpdate: null,
    ...overrides,
  });

  async function setup() {
    const userId = new ObjectId().toHexString();
    const workspace = await db.collection(physicalNames.workspaces).insertOne({
      slug: `w-${userId}`,
      name: "W",
      ownerUserId: userId,
      personal: true,
      plan: "free",
      addOns: [],
      defaultDomain: "shortn.at",
    });
    const state = {
      current: subscription({ userId, id: `sub_${userId}` }),
      fail: false,
    };
    const deps: BillingDeps = {
      db,
      server: "sandbox",
      mode: "shadow",
      log: () => {},
      polar: {
        subscriptions: {
          async get() {
            if (state.fail) throw new Error("polar down");
            return state.current;
          },
        },
      },
    };
    const deliver = (webhookId: string) =>
      collection(db, "billing_events").insertOne({
        _id: webhookId,
        type: "subscription.updated",
        subscriptionIds: [state.current.id],
        receivedAt: new Date(),
      });
    return { userId, workspaceId: workspace.insertedId, state, deps, deliver };
  }

  // Hold one subscription write after its preliminary read, letting a
  // competing webhook finish first against the real Mongo collection.
  function delayedWrite() {
    const reached = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    const gatedDb = new Proxy(db, {
      get(target, key) {
        if (key === "collection")
          return (name: string) => {
            const targetCollection = target.collection(name);
            if (name !== physicalNames.subscriptions) return targetCollection;
            return new Proxy(targetCollection, {
              get(target, key) {
                const value = Reflect.get(target, key);
                if (key === "findOneAndUpdate")
                  return async (...args: unknown[]) => {
                    reached.resolve();
                    await released.promise;
                    return Reflect.apply(value, target, args);
                  };
                return typeof value === "function" ? value.bind(target) : value;
              },
            });
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    return {
      db: gatedDb,
      reached: reached.promise,
      release: () => released.resolve(),
    };
  }

  test("a delayed older write cannot overwrite a newer cancellation", async () => {
    const { workspaceId, state } = await setup();
    await applyFetched(db, "sandbox", state.current);
    const gate = delayedWrite();
    const pending = applyFetched(gate.db, "sandbox", {
      ...state.current,
      modifiedAt: new Date("2026-10-02"),
    });
    await gate.reached;
    try {
      await applyFetched(db, "sandbox", {
        ...state.current,
        status: "canceled",
        modifiedAt: new Date("2026-10-03"),
      });
    } finally {
      gate.release();
    }
    expect(await pending).toEqual({ status: "stale" });
    const mirror = await collection(db, "subscriptions").findOne({
      polarSubscriptionId: state.current.id,
    });
    expect(mirror?.status).toBe("canceled");
    expect(mirror?.modifiedAt).toEqual(new Date("2026-10-03"));
    expect(
      (await collection(db, "workspaces").findOne({ _id: workspaceId }))?.plan,
    ).toBe("free");
  });

  test("concurrent duplicates report only one failed payment", async () => {
    const { state } = await setup();
    await applyFetched(db, "sandbox", state.current);
    const next: SubscriptionLike = {
      ...state.current,
      status: "past_due",
      modifiedAt: new Date("2026-10-02"),
    };
    const gate = delayedWrite();
    const pending = applyFetched(gate.db, "sandbox", next);
    await gate.reached;
    let first;
    try {
      first = await applyFetched(db, "sandbox", next);
    } finally {
      gate.release();
    }
    const second = await pending;
    expect(first.status).toBe("applied");
    expect(second.status).toBe("applied");
    const notices = [first, second].flatMap((outcome) =>
      outcome.status === "applied"
        ? noticesFor(outcome.before, outcome.after)
        : [],
    );
    expect(notices).toEqual([{ kind: "payment_failed" }]);
    expect(
      await collection(db, "subscriptions").countDocuments({
        polarSubscriptionId: state.current.id,
      }),
    ).toBe(1);
  });

  test("replays converge and an older refetch never overwrites a newer mirror", async () => {
    const { workspaceId, state, deps, deliver } = await setup();
    for (let i = 0; i < 10; i++) await deliver(`msg_${state.current.id}_${i}`);
    expect(await processBillingEvents(deps)).toBe(10);
    const mirrors = db.collection(physicalNames.subscriptions);
    expect(
      await mirrors.countDocuments({ polarSubscriptionId: state.current.id }),
    ).toBe(1);
    expect(
      (
        await db
          .collection(physicalNames.workspaces)
          .findOne({ _id: workspaceId })
      )?.plan,
    ).toBe("plus");

    state.current = {
      ...state.current,
      productId: products.sandbox.checkout.pro,
      product: { metadata: {}, name: "Pro Plan" },
      modifiedAt: new Date("2026-10-05T00:00:00Z"),
      pendingUpdate: {
        productId: products.sandbox.checkout.basic,
        appliesAt: new Date("2026-11-01T00:00:00Z"),
      },
    };
    await deliver(`msg_${state.current.id}_new`);
    await processBillingEvents(deps);
    state.current = {
      ...state.current,
      productId: products.sandbox.checkout.plus,
      modifiedAt: new Date("2026-10-02T00:00:00Z"),
    };
    await deliver(`msg_${state.current.id}_old`);
    await processBillingEvents(deps);
    const mirror = await mirrors.findOne({
      polarSubscriptionId: state.current.id,
    });
    expect(mirror?.plan).toBe("pro");
    expect(mirror?.scheduledChange).toMatchObject({ plan: "basic" });
    expect(mirror?.workspaceId).toEqual(workspaceId);
    expect(
      await db
        .collection(physicalNames.billing_events)
        .countDocuments({ processedAt: { $exists: false } }),
    ).toBe(0);
  });

  test("shadow mode records disagreements with legacy's name rule", async () => {
    const { state, deps, deliver } = await setup();
    state.current = {
      ...state.current,
      product: { metadata: {}, name: "Shortn Pro (yearly)" },
    };
    await deliver(`msg_${state.current.id}_diff`);
    await processBillingEvents(deps);
    const diff = await db
      .collection(physicalNames.billing_shadow_diffs)
      .findOne({ subscriptionId: state.current.id });
    expect(diff).toMatchObject({ legacy: "pro", mirrored: "plus" });
  });

  test("a failing refetch backs off and keeps the event for retry", async () => {
    const { state, deps, deliver } = await setup();
    state.fail = true;
    await deliver(`msg_${state.current.id}_fail`);
    await processBillingEvents(deps);
    const event = await collection(db, "billing_events").findOne({
      _id: `msg_${state.current.id}_fail`,
    });
    expect(event?.processedAt).toBeUndefined();
    expect(event?.error).toContain("polar down");
    expect(event?.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
    expect(await processBillingEvents(deps)).toBe(0);
  });

  test("the mail ledger sends once, frees failed sends and expires stuck claims", async () => {
    const ledger = mongoMailLedger(db);
    const key = `receipt:${crypto.randomUUID()}`;
    const now = new Date("2026-10-01T12:00:00Z");
    let sends = 0;
    await expect(
      sendOnce(ledger, key, now, async () => {
        throw new Error("provider down");
      }),
    ).rejects.toThrow("provider down");
    expect(
      await sendOnce(ledger, key, now, async () => {
        sends++;
      }),
    ).toBe(true);
    expect(await sendOnce(ledger, key, now, async () => {})).toBe(false);
    expect(sends).toBe(1);

    const stuck = `receipt:${crypto.randomUUID()}`;
    expect(await ledger.claim(stuck, now)).toBe(true);
    expect(await ledger.claim(stuck, now)).toBe(false);
    expect(
      await ledger.claim(stuck, new Date(now.getTime() + 11 * 60_000)),
    ).toBe(true);
    expect(
      await collection(db, "billing_mail").findOne({ _id: key }),
    ).toMatchObject({ sentAt: now });
  });

  test("live order events mail one receipt to the owner; replays and shadow mode send none", async () => {
    const { userId, workspaceId, state, deps } = await setup();
    await db
      .collection(physicalNames.user)
      .insertOne({ _id: new ObjectId(userId), email: "owner@example.test" });
    await applyFetched(db, "sandbox", state.current);
    const product = productFixture(
      products.sandbox.checkout.plus,
      "Shortn Plus",
    );
    const order = paidOrderFixture(`ord_${userId}`, {
      subscription_id: state.current.id,
      billing_reason: "subscription_cycle",
      product_id: product.id,
      product,
    });
    const { polar } = polarServing({
      orders: [order],
      payments: [cardPaymentFixture(order.id)],
    });
    const receipts: Parameters<Mailer["billingReceipt"]>[0][] = [];
    const onOrder = orderMailer({
      polar,
      server: "sandbox",
      log: () => {},
      ledger: mongoMailLedger(db),
      recipients: billingRecipients(db, "https://app.example/"),
      mailer: {
        async billingReceipt(input) {
          receipts.push(input);
        },
        async billingRefund() {},
      },
    });
    const deliver = (webhookId: string) =>
      collection(db, "billing_events").insertOne({
        _id: webhookId,
        type: "order.paid",
        subscriptionIds: [state.current.id],
        orderId: order.id,
        receivedAt: new Date(),
      });

    await deliver(`msg_${userId}_shadow`);
    await processBillingEvents({ ...deps, onOrder });
    expect(receipts).toHaveLength(0);

    const live: BillingDeps = { ...deps, mode: "live", onOrder };
    for (let i = 0; i < 3; i++) await deliver(`msg_${userId}_paid_${i}`);
    await processBillingEvents(live);
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({
      to: "owner@example.test",
      workspace: "W",
      url: `https://app.example/w-${userId}/settings/billing`,
      idempotencyKey: `receipt:${order.id}`,
      receipt: { plan: "Plus", card: { brand: "visa", last4: "4242" } },
    });
    expect(
      await collection(db, "workspaces").findOne({ _id: workspaceId }),
    ).toMatchObject({ plan: "plus" });
  });
});
