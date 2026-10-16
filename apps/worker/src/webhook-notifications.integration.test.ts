import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { physicalNames } from "@shortn/db";
import type { Mailer } from "@shortn/emails";
import { sendWebhookNotifications } from "./webhook-notifications";

const mongoUrl = process.env.MONGO_TEST_URL;
(mongoUrl ? describe : describe.skip)("webhook owner notifications", () => {
  let client: MongoClient, db: Db;
  const workspaceId = new ObjectId(),
    userId = new ObjectId();
  beforeAll(async () => {
    if (!/^mongodb:\/\/(localhost|127\.0\.0\.1):/.test(mongoUrl!))
      throw new Error("Loopback Mongo required");
    client = await new MongoClient(mongoUrl!).connect();
    db = client.db(
      `shortn_webhook_mail_${crypto.randomUUID().replaceAll("-", "")}`,
    );
    await db.collection(physicalNames.workspaces).insertOne({
      _id: workspaceId,
      ownerUserId: userId.toHexString(),
      slug: "workspace",
    });
    await db
      .collection(physicalNames.user)
      .insertOne({ _id: userId, email: "owner@example.test", locale: "es" });
  });
  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
  });
  test("concurrent pumps send once; failures retry with the same identity", async () => {
    const notices = db.collection(physicalNames.webhook_notifications),
      now = new Date();
    const id = (
      await notices.insertOne({
        workspaceId,
        webhookId: new ObjectId(),
        generation: "first",
        name: "Receiver",
        createdAt: now,
      })
    ).insertedId;
    const calls: Parameters<Mailer["webhookDisabled"]>[0][] = [];
    let fail = true;
    const mailer = {
      async webhookDisabled(input: Parameters<Mailer["webhookDisabled"]>[0]) {
        calls.push(input);
        await Bun.sleep(20);
        if (fail) throw new Error("provider failure with private data");
      },
    };
    await Promise.all(
      Array.from({ length: 4 }, () =>
        sendWebhookNotifications(db, mailer, "https://app.example/", now),
      ),
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      to: "owner@example.test",
      locale: "es",
      name: "Receiver",
      url: "https://app.example/workspace/settings",
    });
    expect((await notices.findOne({ _id: id }))?.lastError).toBe("mail_failed");
    await sendWebhookNotifications(
      db,
      mailer,
      "https://app.example",
      new Date(now.getTime() + 299999),
    );
    expect(calls).toHaveLength(1);
    fail = false;
    await sendWebhookNotifications(
      db,
      mailer,
      "https://app.example",
      new Date(now.getTime() + 300000),
    );
    expect(calls).toHaveLength(2);
    expect(calls[1]?.idempotencyKey).toBe(calls[0]?.idempotencyKey);
    await sendWebhookNotifications(
      db,
      mailer,
      "https://app.example",
      new Date(now.getTime() + 600000),
    );
    expect(calls).toHaveLength(2);
    expect((await notices.findOne({ _id: id }))?.sentAt).toBeDefined();
  });
  test("a new disablement fences an in-flight notification and gets its own identity", async () => {
    const notices = db.collection(physicalNames.webhook_notifications),
      now = new Date();
    const id = (
      await notices.insertOne({
        workspaceId,
        webhookId: new ObjectId(),
        generation: "old",
        createdAt: now,
      })
    ).insertedId;
    const identities: string[] = [];
    await sendWebhookNotifications(
      db,
      {
        async webhookDisabled(input) {
          identities.push(input.idempotencyKey);
          await notices.updateOne(
            { _id: id },
            {
              $set: {
                generation: "new",
                createdAt: new Date(now.getTime() + 1),
              },
              $unset: { lease: "", leaseUntil: "", sentAt: "" },
            },
          );
        },
      },
      "https://app.example",
      now,
    );
    expect((await notices.findOne({ _id: id }))?.sentAt).toBeUndefined();
    await sendWebhookNotifications(
      db,
      {
        async webhookDisabled(input) {
          identities.push(input.idempotencyKey);
        },
      },
      "https://app.example",
      new Date(now.getTime() + 2),
    );
    expect(identities).toHaveLength(2);
    expect(identities[0]).not.toBe(identities[1]);
    expect((await notices.findOne({ _id: id }))?.sentAt).toBeDefined();
  });
  test("expired leases recover and unavailable owners remain retryable", async () => {
    const notices = db.collection(physicalNames.webhook_notifications),
      now = new Date();
    const id = (
      await notices.insertOne({
        workspaceId: new ObjectId(),
        webhookId: new ObjectId(),
        generation: "missing",
        createdAt: now,
        lease: "crashed",
        leaseUntil: new Date(now.getTime() - 1),
      })
    ).insertedId;
    let calls = 0;
    await sendWebhookNotifications(
      db,
      {
        async webhookDisabled() {
          calls++;
        },
      },
      "https://app.example",
      now,
    );
    expect(calls).toBe(0);
    expect((await notices.findOne({ _id: id }))?.nextAttemptAt).toEqual(
      new Date(now.getTime() + 300000),
    );
    expect((await notices.findOne({ _id: id }))?.lease).toBeUndefined();
  });
});
