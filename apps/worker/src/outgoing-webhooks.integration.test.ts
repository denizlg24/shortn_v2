import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { Redis } from "ioredis";
import { collection, physicalNames, desiredIndexes } from "@shortn/db";
import {
  createWebhook,
  testWebhook,
  redeliverWebhook,
  ensurePersonalWorkspace,
  endpoints,
  deliveries,
  openWebhookSecret,
  type ServiceContext,
} from "@shortn/core";
import {
  createWebhookWorker,
  deliverWebhook,
  maintainWebhookFailures,
  webhookRetryDelay,
} from "./outgoing-webhooks";
const mongoUrl = process.env.MONGO_TEST_URL,
  redisUrl = process.env.REDIS_DURABLE_TEST_URL ?? process.env.REDIS_TEST_URL;
const config = {
  enabled: true,
  secretKey: "webhook-test-encryption-key-".repeat(3),
};
(mongoUrl && redisUrl ? describe : describe.skip)(
  "outgoing webhook delivery with Mongo, BullMQ and a receiver",
  () => {
    let client: MongoClient, db: Db, redis: Redis, ctx: ServiceContext;
    beforeAll(async () => {
      if (
        !/^mongodb:\/\/(localhost|127\.0\.0\.1):/.test(mongoUrl!) ||
        !/^redis:\/\/(localhost|127\.0\.0\.1):/.test(redisUrl!)
      )
        throw new Error("Webhook fixtures require loopback services");
      client = await new MongoClient(mongoUrl!).connect();
      db = client.db(
        `shortn_webhooks_${crypto.randomUUID().replaceAll("-", "")}`,
      );
      redis = new Redis(redisUrl!);
      for (const name of [
        physicalNames.webhook_endpoints,
        physicalNames.webhook_deliveries,
        physicalNames.webhook_attempts,
        physicalNames.webhook_notifications,
      ])
        await db.collection(name).createIndexes(desiredIndexes[name]!);
      const actor = {
        userId: new ObjectId().toHexString(),
        role: "owner" as const,
      };
      const workspace = await ensurePersonalWorkspace(db, {
        id: actor.userId,
        name: "Webhooks",
      });
      workspace.platformFeatures = { webhooks: true };
      await collection(db, "workspaces").updateOne(
        { _id: workspace._id },
        { $set: { platformFeatures: workspace.platformFeatures } },
      );
      ctx = { db, actor, workspace, cache: redis, linkDomain: "shortn.at" };
    }, 30000);
    afterAll(async () => {
      redis?.disconnect();
      await db?.dropDatabase();
      await client?.close();
    });
    async function endpoint() {
      const result = await createWebhook(
        ctx,
        {
          name: "Receiver",
          url: "https://receiver.example/hook",
          events: ["link.created"],
        },
        config,
      );
      if (!result.ok) throw new Error(result.error);
      return result.value;
    }
    test("BullMQ sends timestamped HMACs to the receiver, preserves identity and suppresses duplicate jobs", async () => {
      const hook = await endpoint();
      const received: {
        body: string;
        signature: string;
        delivery: string;
        event: string;
      }[] = [];
      const server = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        async fetch(request) {
          received.push({
            body: await request.text(),
            signature: request.headers.get("Shortn-Signature") ?? "",
            delivery: request.headers.get("Shortn-Delivery-Id") ?? "",
            event: request.headers.get("Shortn-Event-Id") ?? "",
          });
          return new Response(null, { status: 204 });
        },
      });
      // Only the injected transport maps the public fixture URL to this local receiver.
      const queueName = `webhook-test-${crypto.randomUUID()}`;
      const errors: unknown[] = [];
      const worker = createWebhookWorker({
        db,
        durable: redis,
        config,
        queueName,
        send: async (_url, body, headers) =>
          (
            await fetch(`http://127.0.0.1:${server.port}`, {
              method: "POST",
              body,
              headers,
            })
          ).status,
        log: (_message, error) => errors.push(error),
      });
      try {
        const queued = await testWebhook(ctx, hook.id, config);
        if (!queued.ok) throw new Error(queued.error);
        await worker.pump();
        await worker.pump();
        const deadline = Date.now() + 5000;
        while (
          Date.now() < deadline &&
          (await deliveries(db).findOne({ _id: new ObjectId(queued.value.id) }))
            ?.status !== "delivered"
        )
          await Bun.sleep(20);
        expect(
          (await deliveries(db).findOne({ _id: new ObjectId(queued.value.id) }))
            ?.status,
        ).toBe("delivered");
        expect(received).toHaveLength(1);
        const message = received[0]!;
        const timestamp = Number(message.signature.match(/^t=(\d+),v1=/)?.[1]);
        const digest = createHmac("sha256", hook.secret)
          .update(`${timestamp}.${message.body}`)
          .digest("hex");
        expect(message.signature).toBe(`t=${timestamp},v1=${digest}`);
        expect(Math.abs(Date.now() / 1000 - timestamp)).toBeLessThan(10);
        expect(message.delivery).toBe(queued.value.id);
        expect(message.event).toBe(queued.value.eventId);
        expect(JSON.parse(message.body)).toMatchObject({
          type: "webhook.test",
          workspaceId: ctx.workspace._id.toHexString(),
          data: {},
        });
        await deliverWebhook(db, queued.value.id, config, async () => {
          throw new Error("Duplicate job reached sender");
        });
        expect(
          (await deliveries(db).findOne({ _id: new ObjectId(queued.value.id) }))
            ?.attempts,
        ).toBe(1);
        expect(
          await db
            .collection(physicalNames.webhook_attempts)
            .countDocuments({ deliveryId: new ObjectId(queued.value.id) }),
        ).toBe(1);
        expect(errors).toEqual([]);
      } finally {
        await worker.worker.close();
        await worker.queue.obliterate({ force: true });
        await worker.close();
        await server.stop(true);
      }
    }, 15000);
    test("a restarted BullMQ worker resumes the durable retry without a new event", async () => {
      const hook = await endpoint(),
        queued = await testWebhook(ctx, hook.id, config);
      if (!queued.ok) throw new Error(queued.error);
      const queueName = `webhook-restart-${crypto.randomUUID()}`;
      let calls = 0;
      const deps = { db, durable: redis, config, queueName, log: () => {} };
      const first = createWebhookWorker({
        ...deps,
        send: async () => {
          calls++;
          return 503;
        },
      });
      try {
        await first.pump();
        const deadline = Date.now() + 5000;
        while (
          Date.now() < deadline &&
          (await deliveries(db).findOne({ _id: new ObjectId(queued.value.id) }))
            ?.attempts !== 1
        )
          await Bun.sleep(20);
      } finally {
        await first.close();
      }
      const pending = await deliveries(db).findOne({
        _id: new ObjectId(queued.value.id),
      });
      expect(pending?.status).toBe("pending");
      const second = createWebhookWorker({
        ...deps,
        send: async () => {
          calls++;
          return 204;
        },
      });
      try {
        await Bun.sleep(
          Math.max(0, pending!.nextAttemptAt.getTime() - Date.now() + 20),
        );
        await second.pump();
        const deadline = Date.now() + 5000;
        while (
          Date.now() < deadline &&
          (await deliveries(db).findOne({ _id: new ObjectId(queued.value.id) }))
            ?.status !== "delivered"
        )
          await Bun.sleep(20);
        const complete = await deliveries(db).findOne({
          _id: new ObjectId(queued.value.id),
        });
        expect(complete?.status).toBe("delivered");
        expect(complete?.event.id).toBe(queued.value.eventId);
        expect(complete?.attempts).toBe(2);
        expect(calls).toBe(2);
      } finally {
        await second.worker.close();
        await second.queue.obliterate({ force: true });
        await second.close();
      }
    }, 15000);
    test("a failed queue producer leaves the outbox available to a replacement worker", async () => {
      const hook = await endpoint(),
        queued = await testWebhook(ctx, hook.id, config);
      if (!queued.ok) throw new Error(queued.error);
      const deps = {
        db,
        durable: redis,
        config,
        queueName: `webhook-producer-${crypto.randomUUID()}`,
        log: () => {},
      };
      const first = createWebhookWorker({ ...deps, send: async () => 204 });
      try {
        await first.queue.waitUntilReady();
        await first.queue.disconnect();
        const interruptedPump = first.pump();
        const closing = first.close();
        await expect(interruptedPump).rejects.toThrow();
        await closing;
        expect(
          (await deliveries(db).findOne({ _id: new ObjectId(queued.value.id) }))
            ?.status,
        ).toBe("pending");
      } finally {
        await first.close();
      }
      const second = createWebhookWorker({ ...deps, send: async () => 204 });
      try {
        await second.pump();
        const deadline = Date.now() + 5000;
        while (
          Date.now() < deadline &&
          (await deliveries(db).findOne({ _id: new ObjectId(queued.value.id) }))
            ?.status !== "delivered"
        )
          await Bun.sleep(20);
        expect(
          (await deliveries(db).findOne({ _id: new ObjectId(queued.value.id) }))
            ?.status,
        ).toBe("delivered");
      } finally {
        await second.worker.close();
        await second.queue.obliterate({ force: true });
        await second.close();
      }
    }, 15000);
    test("failures back off, retry within 24 hours, recover leases and disable after three days", async () => {
      const hook = await endpoint();
      const queued = await testWebhook(ctx, hook.id, config);
      if (!queued.ok) throw new Error(queued.error);
      const id = new ObjectId(queued.value.id),
        now = new Date(Date.now() + 1000);
      let sends = 0;
      const failure = async () => {
        sends++;
        return 503;
      };
      await deliverWebhook(db, queued.value.id, config, failure, now);
      const first = await deliveries(db).findOne({ _id: id });
      expect(first?.status).toBe("pending");
      expect(first?.attempts).toBe(1);
      expect(first?.nextAttemptAt.getTime()).toBe(now.getTime() + 1000);
      await deliverWebhook(db, queued.value.id, config, failure, now);
      expect(sends).toBe(1);
      await deliverWebhook(
        db,
        queued.value.id,
        config,
        failure,
        first!.nextAttemptAt,
      );
      expect((await deliveries(db).findOne({ _id: id }))?.attempts).toBe(2);
      await deliveries(db).updateOne(
        { _id: id },
        {
          $set: { status: "sending", leaseUntil: new Date(now.getTime() - 1) },
        },
      );
      await deliverWebhook(db, queued.value.id, config, async () => 204, now);
      expect((await deliveries(db).findOne({ _id: id }))?.status).toBe(
        "delivered",
      );
      expect(
        (await endpoints(db).findOne({ _id: new ObjectId(hook.id) }))
          ?.failureSince,
      ).toBeUndefined();
      expect(webhookRetryDelay(1)).toBe(1000);
      expect(webhookRetryDelay(3)).toBe(4000);
      expect(webhookRetryDelay(100)).toBe(3600000);
      const expired = await testWebhook(ctx, hook.id, config);
      if (!expired.ok) throw new Error(expired.error);
      await maintainWebhookFailures(db, new Date(now.getTime() + 86400000));
      expect(
        (await deliveries(db).findOne({ _id: new ObjectId(expired.value.id) }))
          ?.status,
      ).toBe("failed");
      await endpoints(db).updateOne(
        { _id: new ObjectId(hook.id) },
        { $set: { failureSince: new Date(now.getTime() - 3 * 86400000) } },
      );
      await maintainWebhookFailures(db, now);
      expect(
        (await endpoints(db).findOne({ _id: new ObjectId(hook.id) }))?.enabled,
      ).toBe(false);
      expect(
        await db
          .collection(physicalNames.webhook_notifications)
          .findOne({ webhookId: new ObjectId(hook.id) }),
      ).toMatchObject({
        name: "Receiver",
        url: "https://receiver.example/hook",
      });
      expect(
        await db
          .collection(physicalNames.webhook_notifications)
          .countDocuments({ webhookId: new ObjectId(hook.id) }),
      ).toBe(1);
      await maintainWebhookFailures(db, now);
      expect(
        await db
          .collection(physicalNames.webhook_notifications)
          .countDocuments({ webhookId: new ObjectId(hook.id) }),
      ).toBe(1);
    });
    test("a fenced attempt cannot overwrite endpoint health after a newer successful attempt", async () => {
      const hook = await endpoint(),
        queued = await testWebhook(ctx, hook.id, config);
      if (!queued.ok) throw new Error(queued.error);
      let finish: (status: number) => void = () => {
        throw new Error("Sender not started");
      };
      let started: () => void = () => {};
      const ready = new Promise<void>((resolve) => {
        started = resolve;
      });
      const now = new Date(Date.now() + 1000);
      const old = deliverWebhook(
        db,
        queued.value.id,
        config,
        () =>
          new Promise<number>((resolve) => {
            finish = resolve;
            started();
          }),
        now,
      );
      await ready;
      await deliveries(db).updateOne(
        { _id: new ObjectId(queued.value.id) },
        { $set: { leaseUntil: new Date(now.getTime() - 1) } },
      );
      await deliverWebhook(db, queued.value.id, config, async () => 204, now);
      finish(503);
      await old;
      expect(
        (await deliveries(db).findOne({ _id: new ObjectId(queued.value.id) }))
          ?.status,
      ).toBe("delivered");
      expect(
        (await endpoints(db).findOne({ _id: new ObjectId(hook.id) }))
          ?.failureSince,
      ).toBeUndefined();
    });
    test("worker rechecks tenant and feature state; redelivery creates a new delivery for the same event", async () => {
      const hook = await endpoint(),
        queued = await testWebhook(ctx, hook.id, config);
      if (!queued.ok) throw new Error(queued.error);
      const again = await redeliverWebhook(
        ctx,
        hook.id,
        queued.value.id,
        config,
      );
      if (!again.ok) throw new Error(again.error);
      expect(again.value.id).not.toBe(queued.value.id);
      expect(again.value.eventId).toBe(queued.value.eventId);
      await endpoints(db).updateOne(
        { _id: new ObjectId(hook.id) },
        { $set: { workspaceId: new ObjectId() } },
      );
      await deliverWebhook(
        db,
        queued.value.id,
        config,
        async () => {
          throw new Error("Foreign endpoint was contacted");
        },
        new Date(Date.now() + 1000),
      );
      expect(
        (await deliveries(db).findOne({ _id: new ObjectId(queued.value.id) }))
          ?.status,
      ).toBe("cancelled");
      const stored = await endpoints(db).findOne({
        _id: new ObjectId(hook.id),
      });
      expect(stored?.secret).not.toContain(hook.secret);
      expect(openWebhookSecret(stored!.secret, config.secretKey)).toBe(
        hook.secret,
      );
      await collection(db, "workspaces").updateOne(
        { _id: ctx.workspace._id },
        { $set: { "platformFeatures.webhooks": false } },
      );
      const other = await endpoint(),
        pending = await testWebhook(ctx, other.id, config);
      if (!pending.ok) throw new Error(pending.error);
      await deliverWebhook(
        db,
        pending.value.id,
        config,
        async () => {
          throw new Error("Disabled workspace contacted");
        },
        new Date(Date.now() + 1000),
      );
      expect(
        (await deliveries(db).findOne({ _id: new ObjectId(pending.value.id) }))
          ?.status,
      ).toBe("cancelled");
    });
  },
);
