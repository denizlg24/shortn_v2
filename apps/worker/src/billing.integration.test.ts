import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { applyFetched, products, type SubscriptionLike } from "@shortn/billing";
import { collection, physicalNames } from "@shortn/db";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { processBillingEvents, type BillingDeps } from "./billing";
import { noticesFor } from "./billing-notices";

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

  test("concurrent duplicates report only one plan transition", async () => {
    const { state } = await setup();
    await applyFetched(db, "sandbox", state.current);
    const next = {
      ...state.current,
      productId: products.sandbox.checkout.pro,
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
    expect(notices).toEqual([{ kind: "changed", plan: "pro" }]);
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
});
