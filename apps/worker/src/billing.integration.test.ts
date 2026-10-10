import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { products, type SubscriptionLike } from "@shortn/billing";
import { collection, physicalNames } from "@shortn/db";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { processBillingEvents, type BillingDeps } from "./billing";

const mongoUrl = process.env.MONGO_TEST_URL;

(mongoUrl ? describe : describe.skip)("billing event processing", () => {
  let client: MongoClient;
  let db: Db;
  beforeAll(async () => {
    client = await new MongoClient(mongoUrl ?? "").connect();
    db = client.db(
      `shortn_worker_billing_${crypto.randomUUID().replaceAll("-", "")}`,
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
