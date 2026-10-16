import { flushWebhookClicks } from "./webhook-clicks";
import { fanoutWebhookEvents } from "./webhook-events";
import { Queue, Worker } from "bullmq";
import type { Redis } from "ioredis";
import { ObjectId, type Db } from "mongodb";
import { collection, physicalNames } from "@shortn/db";
import {
  endpoints,
  deliveries,
  openWebhookSecret,
  webhookSignature,
  platformFeatureEnabled,
  type WebhookConfig,
} from "@shortn/core";
import { sendWebhook, WebhookSendError } from "./webhook-sender";

export const webhookRetryDelay = (attempts: number) =>
  Math.min(3600000, 1000 * 2 ** Math.min(20, Math.max(0, attempts - 1)));
export async function deliverWebhook(
  db: Db,
  id: string,
  config: WebhookConfig,
  send = sendWebhook,
  now = new Date(),
) {
  if (!config.enabled || !/^[a-f\d]{24}$/i.test(id)) return;
  const token = crypto.randomUUID();
  const delivery = await deliveries(db).findOneAndUpdate(
    {
      _id: new ObjectId(id),
      retryUntil: { $gt: now },
      $or: [
        { status: "pending", nextAttemptAt: { $lte: now } },
        { status: "sending", leaseUntil: { $lte: now } },
      ],
    },
    {
      $set: {
        status: "sending",
        leaseUntil: new Date(now.getTime() + 60000),
        leaseToken: token,
      },
      $inc: { attempts: 1 },
    },
    { returnDocument: "after" },
  );
  if (!delivery) return;
  const match = { _id: delivery._id, leaseToken: token };
  const endpoint = await endpoints(db).findOne({
    _id: delivery.webhookId,
    workspaceId: delivery.workspaceId,
    enabled: true,
  });
  const workspace = await collection(db, "workspaces").findOne({
    _id: delivery.workspaceId,
  });
  if (
    !endpoint ||
    !workspace ||
    !platformFeatureEnabled(workspace, "webhooks", config.rolloutPercent)
  ) {
    await deliveries(db).updateOne(match, {
      $set: { status: "cancelled", lastError: "endpoint_disabled" },
      $unset: { leaseToken: "", leaseUntil: "" },
    });
    return;
  }
  const body = JSON.stringify(delivery.event),
    timestamp = Math.floor(now.getTime() / 1000);
  let status = 0,
    error = "";
  try {
    status = await send(endpoint.url, body, {
      "Content-Type": "application/json",
      "User-Agent": "Shortn-Webhooks/1.0",
      "Shortn-Signature": webhookSignature(
        openWebhookSecret(endpoint.secret, config.secretKey),
        timestamp,
        body,
      ),
      "Shortn-Delivery-Id": id,
      "Shortn-Event-Id": delivery.event.id,
    });
    if (status < 200 || status >= 300) error = "http_error";
  } catch (cause) {
    error = cause instanceof WebhookSendError ? cause.code : "delivery_error";
  }
  await db.collection(physicalNames.webhook_attempts).updateOne(
    { deliveryId: delivery._id, attempt: delivery.attempts },
    {
      $setOnInsert: {
        workspaceId: delivery.workspaceId,
        webhookId: delivery.webhookId,
        status,
        error: error || null,
        createdAt: now,
        expiresAt: delivery.expiresAt,
      },
    },
    { upsert: true },
  );
  if (!error) {
    const updated = await deliveries(db).updateOne(match, {
      $set: { status: "delivered", deliveredAt: now, lastStatus: status },
      $unset: { leaseToken: "", leaseUntil: "", lastError: "" },
    });
    if (!updated.matchedCount) return;
    await endpoints(db).updateOne(
      { _id: endpoint._id, workspaceId: delivery.workspaceId },
      { $unset: { failureSince: "" } },
    );
  } else {
    const next = new Date(now.getTime() + webhookRetryDelay(delivery.attempts));
    const updated = await deliveries(db).updateOne(match, {
      $set: {
        status: next < delivery.retryUntil ? "pending" : "failed",
        nextAttemptAt: next,
        lastStatus: status,
        lastError: error,
      },
      $unset: { leaseToken: "", leaseUntil: "" },
    });
    if (!updated.matchedCount) return;
    await endpoints(db).updateOne(
      { _id: endpoint._id, failureSince: { $exists: false } },
      { $set: { failureSince: now } },
    );
  }
}
export async function maintainWebhookFailures(db: Db, now = new Date()) {
  await deliveries(db).updateMany(
    { status: { $in: ["pending", "sending"] }, retryUntil: { $lte: now } },
    {
      $set: { status: "failed", lastError: "retry_window_expired" },
      $unset: { leaseToken: "", leaseUntil: "" },
    },
  );
  const stale = await endpoints(db)
    .find({
      enabled: true,
      failureSince: { $lte: new Date(now.getTime() - 3 * 86400000) },
    })
    .limit(100)
    .toArray();
  for (const endpoint of stale) {
    const failureSince = endpoint.failureSince;
    if (!failureSince) continue;
    const session = db.client.startSession();
    try {
      await session.withTransaction(async () => {
        const result = await endpoints(db).updateOne(
          {
            _id: endpoint._id,
            enabled: true,
            failureSince,
          },
          { $set: { enabled: false, disabledAt: now, updatedAt: now } },
          { session },
        );
        if (result.modifiedCount)
          await db.collection(physicalNames.webhook_notifications).updateOne(
            { webhookId: endpoint._id },
            {
              $set: {
                workspaceId: endpoint.workspaceId,
                name: endpoint.name,
                generation: crypto.randomUUID(),
                createdAt: now,
              },
              $unset: {
                sentAt: "",
                lease: "",
                leaseUntil: "",
                nextAttemptAt: "",
                lastError: "",
              },
            },
            { session, upsert: true },
          );
      });
    } finally {
      await session.endSession();
    }
  }
}
export function createWebhookWorker(deps: {
  db: Db;
  durable: Redis;
  config: WebhookConfig;
  queueName?: string;
  send?: typeof sendWebhook;
  log: (message: string, error?: unknown) => void;
}) {
  const name = deps.queueName ?? "shortn-webhooks";
  const connection = deps.durable.duplicate({ maxRetriesPerRequest: null });
  // Blocking consumers retry indefinitely; the producer must return queue errors
  // so the Mongo outbox can be retried and shutdown can finish.
  const producer = deps.durable.duplicate({ maxRetriesPerRequest: 1 });
  const queue = new Queue(name, { connection: producer });
  const worker = new Worker<{ id: string }>(
    name,
    async (job) => deliverWebhook(deps.db, job.data.id, deps.config, deps.send),
    { connection, concurrency: 10 },
  );
  worker.on("error", (error) => deps.log("Webhook queue error", error));
  queue.on("error", (error) => deps.log("Webhook producer error", error));
  let pumping: Promise<void> | undefined;
  let closing = false;
  function pump(): Promise<void> {
    if (closing || !deps.config.enabled) return Promise.resolve();
    if (pumping) return pumping;
    pumping = (async () => {
      const now = new Date();
      await flushWebhookClicks(deps.db, deps.config, now);
      await fanoutWebhookEvents(deps.db, deps.config, now);
      await maintainWebhookFailures(deps.db, now);
      const rows = await deliveries(deps.db)
        .find({
          retryUntil: { $gt: now },
          $or: [
            { status: "pending", nextAttemptAt: { $lte: now } },
            { status: "sending", leaseUntil: { $lte: now } },
          ],
        })
        .sort({ nextAttemptAt: 1 })
        .limit(100)
        .toArray();
      for (const row of rows)
        await queue.add(
          "deliver",
          { id: row._id.toHexString() },
          {
            jobId: `${row._id.toHexString()}-${row.attempts}`,
            removeOnComplete: true,
            removeOnFail: true,
          },
        );
    })().finally(() => {
      pumping = undefined;
    });
    return pumping;
  }
  return {
    pump,
    queue,
    worker,
    async close() {
      closing = true;
      await pumping?.catch((error) =>
        deps.log("Webhook pump failed during shutdown", error),
      );
      await worker.close();
      await queue.close();
      producer.disconnect();
      connection.disconnect();
    },
  };
}
