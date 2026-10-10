import { describe, expect, test } from "bun:test";
import { MongoClient } from "mongodb";
import {
  receivePolarWebhook,
  subscriptionIdsOf,
  type Verify,
} from "./webhooks";

const secret = "polar-test-secret-1234567890abcdef";

test("a bad or missing signature is refused with 403", async () => {
  const deps = {
    db: new MongoClient("mongodb://127.0.0.1:1").db("never"),
    log: () => {},
  };
  const result = await receivePolarWebhook(
    {
      body: "{}",
      headers: {
        "webhook-id": "msg_1",
        "webhook-timestamp": `${Math.floor(Date.now() / 1000)}`,
        "webhook-signature": "v1,AAAA",
      },
      secret,
    },
    deps,
  );
  expect(result.status).toBe(403);
});

const mongoUrl = process.env.MONGO_TEST_URL;
(mongoUrl ? describe : describe.skip)("with Mongo", () => {
  test("first delivery is stored and enqueued; replays are 200 duplicates", async () => {
    const client = await new MongoClient(mongoUrl ?? "").connect();
    const db = client.db(
      `shortn_api_test_${crypto.randomUUID().replaceAll("-", "")}`,
    );
    const verify: Verify = () => ({
      type: "subscription.updated",
      data: { id: "sub_1" },
    });
    const deps = {
      db,
      log: () => {},
      verify,
    };
    const input = { body: "{}", headers: { "webhook-id": "msg_9" }, secret };
    try {
      expect(await receivePolarWebhook(input, deps)).toEqual({
        status: 202,
        id: "msg_9",
        subscriptionIds: ["sub_1"],
      });
      for (let i = 0; i < 9; i++)
        expect(await receivePolarWebhook(input, deps)).toEqual({
          status: 200,
          duplicate: true,
        });
      expect(await db.collection("billing_events").countDocuments()).toBe(1);
    } finally {
      await db.dropDatabase();
      await client.close();
    }
  });
});

test("subscription ids come from subscription, order and customer-state events", () => {
  const ids = subscriptionIdsOf;
  expect(ids({ type: "subscription.canceled", data: { id: "s" } })).toEqual([
    "s",
  ]);
  expect(ids({ type: "order.paid", data: { subscriptionId: "s2" } })).toEqual([
    "s2",
  ]);
  expect(ids({ type: "order.paid", data: { subscriptionId: null } })).toEqual(
    [],
  );
  expect(
    ids({
      type: "customer.state_changed",
      data: { activeSubscriptions: [{ id: "a" }, { id: "b" }] },
    }),
  ).toEqual(["a", "b"]);
  expect(ids({ type: "checkout.created", data: {} })).toEqual([]);
});
