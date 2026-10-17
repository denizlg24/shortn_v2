import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { desiredIndexes, physicalNames } from "@shortn/db";
import { webhookOutbox, deliveries } from "@shortn/core";
import { captureWebhookClicks, flushWebhookClicks } from "./webhook-clicks";
import { fanoutWebhookEvents } from "./webhook-events";
import type { Decoded } from "./ingest";
const mongoUrl = process.env.MONGO_TEST_URL;
const config = { enabled: true, secretKey: "fixture".repeat(10) };
(mongoUrl ? describe : describe.skip)("durable click webhook batches", () => {
  let client: MongoClient, db: Db;
  beforeAll(async () => {
    if (!/^mongodb:\/\/(localhost|127\.0\.0\.1):/.test(mongoUrl!))
      throw new Error("Loopback Mongo required");
    client = await new MongoClient(mongoUrl!).connect();
    db = client.db(
      `shortn_webhook_clicks_${crypto.randomUUID().replaceAll("-", "")}`,
    );
    for (const name of [
      physicalNames.webhook_clicks,
      physicalNames.webhook_events,
      physicalNames.webhook_endpoints,
      physicalNames.webhook_deliveries,
    ])
      await db.collection(name).createIndexes(desiredIndexes[name]!);
  });
  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
  });
  async function fixture() {
    const workspaceId = new ObjectId(),
      linkId = new ObjectId(),
      qrId = new ObjectId(),
      now = new Date();
    await db
      .collection(physicalNames.workspaces)
      .insertOne({ _id: workspaceId, platformFeatures: { webhooks: true } });
    await db
      .collection(physicalNames.links)
      .insertOne({ _id: linkId, workspaceId, urlCode: "key" });
    await db
      .collection(physicalNames.qr_codes)
      .insertOne({ _id: qrId, workspaceId, linkId });
    const hook = {
      _id: new ObjectId(),
      workspaceId,
      enabled: true,
      createdAt: new Date(now.getTime() - 1000),
      events: ["link.clicked", "qr.scanned"],
    };
    await db.collection(physicalNames.webhook_endpoints).insertOne(hook);
    const message = (sid: string, scan = false): Decoded => ({
      sid: `${workspaceId}-${sid}`,
      message: {
        v: 1,
        ts: now.getTime(),
        linkId: linkId.toHexString(),
        ...(scan ? { qrId: qrId.toHexString() } : {}),
        bot: false,
        domain: "shortn.at",
        key: "key",
        ip: "203.0.113.1",
        ua: "private-agent",
        query: { secret: "private-query" },
        referrer: "https://private.example",
      },
    });
    return { workspaceId, linkId, qrId, hook, message, now };
  }
  test("100 flushes immediately; partial clicks and scans flush at ten seconds, with no replay duplicates", async () => {
    const f = await fixture();
    const clicks = Array.from({ length: 101 }, (_, i) => f.message(String(i))),
      scan = f.message("scan", true);
    await captureWebhookClicks(db, [...clicks, scan], config, f.now);
    await captureWebhookClicks(db, [...clicks, scan], config, f.now);
    expect(
      await db
        .collection(physicalNames.webhook_clicks)
        .countDocuments({ workspaceId: f.workspaceId }),
    ).toBe(102);
    await Promise.all([
      flushWebhookClicks(db, config, f.now),
      flushWebhookClicks(db, config, f.now),
    ]);
    const immediate = await webhookOutbox(db)
      .find({ workspaceId: f.workspaceId })
      .toArray();
    expect(immediate).toHaveLength(1);
    expect(immediate[0]?.event.data.count).toBe(100);
    await flushWebhookClicks(db, config, new Date(f.now.getTime() + 9999));
    expect(
      await webhookOutbox(db).countDocuments({ workspaceId: f.workspaceId }),
    ).toBe(1);
    await flushWebhookClicks(db, config, new Date(f.now.getTime() + 10000));
    const events = await webhookOutbox(db)
      .find({ workspaceId: f.workspaceId })
      .toArray();
    expect(events).toHaveLength(3);
    expect(
      events.filter((row) => row.event.type === "qr.scanned"),
    ).toHaveLength(1);
    const body = JSON.stringify(events);
    for (const secret of [
      "203.0.113.1",
      "private-agent",
      "private-query",
      "private.example",
    ])
      expect(body).not.toContain(secret);
    await captureWebhookClicks(
      db,
      [...clicks, scan],
      config,
      new Date(f.now.getTime() + 20000),
    );
    await flushWebhookClicks(db, config, new Date(f.now.getTime() + 30000));
    expect(
      await webhookOutbox(db).countDocuments({ workspaceId: f.workspaceId }),
    ).toBe(3);
    await fanoutWebhookEvents(db, config, new Date(f.now.getTime() + 10000));
    expect(
      await deliveries(db).countDocuments({ workspaceId: f.workspaceId }),
    ).toBe(3);
    expect(
      await db.collection(physicalNames.webhook_clicks).countDocuments({
        workspaceId: f.workspaceId,
        expiresAt: { $exists: true },
      }),
    ).toBe(102);
  });
  test("a large backlog drains in bounded batches and survives concurrent capture", async () => {
    const f = await fixture();
    const entries = Array.from({ length: 2001 }, (_, i) =>
      f.message(`backlog-${i}`),
    );
    await Promise.all([
      captureWebhookClicks(db, entries, config, f.now),
      captureWebhookClicks(db, entries, config, f.now),
    ]);
    expect(
      await db
        .collection(physicalNames.webhook_clicks)
        .countDocuments({ workspaceId: f.workspaceId }),
    ).toBe(2001);
    await flushWebhookClicks(db, config, f.now);
    const first = await webhookOutbox(db)
      .find({ workspaceId: f.workspaceId })
      .toArray();
    expect(first).toHaveLength(20);
    expect(first.every((row) => row.event.data.count === 100)).toBe(true);
    await flushWebhookClicks(db, config, new Date(f.now.getTime() + 10000));
    const all = await webhookOutbox(db)
      .find({ workspaceId: f.workspaceId })
      .toArray();
    expect(all).toHaveLength(21);
    const ids = all.flatMap((row) =>
      (row.event.data.events as { id: string }[]).map((event) => event.id),
    );
    expect(ids).toHaveLength(2001);
    expect(new Set(ids).size).toBe(2001);
  });

  test("requires opt-in and enabled rollout; scans are checked against QR ownership and backing link", async () => {
    const f = await fixture();
    await db
      .collection(physicalNames.webhook_endpoints)
      .updateOne({ _id: f.hook._id }, { $set: { events: ["link.created"] } });
    await captureWebhookClicks(db, [f.message("unsubscribed")], config, f.now);
    await db
      .collection(physicalNames.webhook_endpoints)
      .updateOne(
        { _id: f.hook._id },
        { $set: { events: ["link.clicked", "qr.scanned"] } },
      );
    await captureWebhookClicks(
      db,
      [f.message("off")],
      { enabled: false },
      f.now,
    );
    const bot = f.message("bot");
    bot.message.bot = true;
    await captureWebhookClicks(db, [bot], config, f.now);
    await db
      .collection(physicalNames.qr_codes)
      .updateOne({ _id: f.qrId }, { $set: { workspaceId: new ObjectId() } });
    await captureWebhookClicks(db, [f.message("foreign", true)], config, f.now);
    await db
      .collection(physicalNames.qr_codes)
      .updateOne(
        { _id: f.qrId },
        { $set: { workspaceId: f.workspaceId, linkId: new ObjectId() } },
      );
    await captureWebhookClicks(
      db,
      [f.message("wrong-link", true)],
      config,
      f.now,
    );
    await db
      .collection(physicalNames.workspaces)
      .updateOne(
        { _id: f.workspaceId },
        { $set: { platformFeatures: { webhooks: false } } },
      );
    await captureWebhookClicks(db, [f.message("workspace-off")], config, f.now);
    expect(
      await db
        .collection(physicalNames.webhook_clicks)
        .countDocuments({ workspaceId: f.workspaceId }),
    ).toBe(0);
  });
  test("outbox failure rolls back consumption and a replacement pump recovers", async () => {
    const f = await fixture();
    await captureWebhookClicks(db, [f.message("rollback")], config, f.now);
    await db.command({
      collMod: physicalNames.webhook_events,
      validator: { workspaceId: { $ne: f.workspaceId } },
      validationLevel: "strict",
      validationAction: "error",
    });
    let failed = false;
    try {
      await flushWebhookClicks(db, config, new Date(f.now.getTime() + 10000));
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
    expect(
      await db.collection(physicalNames.webhook_clicks).countDocuments({
        workspaceId: f.workspaceId,
        completedAt: { $exists: false },
      }),
    ).toBe(1);
    await db.command({ collMod: physicalNames.webhook_events, validator: {} });
    await flushWebhookClicks(db, config, new Date(f.now.getTime() + 10000));
    expect(
      await webhookOutbox(db).countDocuments({ workspaceId: f.workspaceId }),
    ).toBe(1);
  });
  test("small young groups cannot hide another workspace's full batch", async () => {
    const f = await fixture(),
      other = await fixture();
    await captureWebhookClicks(db, [f.message("young")], config, f.now);
    await captureWebhookClicks(
      db,
      Array.from({ length: 100 }, (_, i) => other.message(String(i))),
      config,
      new Date(f.now.getTime() + 1),
    );
    await flushWebhookClicks(db, config, new Date(f.now.getTime() + 2));
    expect(
      await webhookOutbox(db).countDocuments({
        workspaceId: other.workspaceId,
      }),
    ).toBe(1);
    expect(
      await webhookOutbox(db).countDocuments({ workspaceId: f.workspaceId }),
    ).toBe(0);
  });
});
