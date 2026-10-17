import { randomUUID } from "node:crypto";
import { ObjectId, type Db, type Document } from "mongodb";
import type { Redis } from "ioredis";
import { Queue, Worker } from "bullmq";
import { collection } from "@shortn/db";
import { requestRuleSchedule } from "@shortn/core";
import { invalidateLinks } from "@shortn/redis";

type Dependencies = {
  db: Db;
  cache: Redis;
  linkDomain: string;
  flush?: typeof invalidateLinks;
};
const jobIdentity = (
  id: string,
  generation: string,
  boundary: number,
  attempts: number,
) => `${id}-${generation}-${boundary}-${attempts}`;

export async function invalidateRuleBoundary(
  deps: Dependencies,
  id: string,
  generation: string,
  boundary: number,
  now = new Date(),
) {
  if (
    !ObjectId.isValid(id) ||
    !Number.isFinite(boundary) ||
    boundary > now.getTime()
  )
    return;
  const links = collection(deps.db, "links"),
    token = randomUUID();
  const row = await links.findOneAndUpdate(
    {
      _id: new ObjectId(id),
      "ruleSchedule.generation": generation,
      "ruleSchedule.nextAt": new Date(boundary),
      $and: [
        {
          $or: [
            { "ruleSchedule.leaseUntil": { $exists: false } },
            { "ruleSchedule.leaseUntil": { $lte: now } },
          ],
        },
        {
          $or: [
            { "ruleSchedule.retryAt": { $exists: false } },
            { "ruleSchedule.retryAt": { $lte: now } },
          ],
        },
      ],
    },
    {
      $set: {
        "ruleSchedule.token": token,
        "ruleSchedule.queued": true,
        "ruleSchedule.publishedAt": now,
        "ruleSchedule.leaseUntil": new Date(now.getTime() + 60000),
      },
      $inc: { "ruleSchedule.attempts": 1 },
    } as Document,
    { returnDocument: "after" },
  );
  if (!row) return;
  const fence = {
    _id: row._id,
    "ruleSchedule.generation": generation,
    "ruleSchedule.token": token,
  };
  try {
    await (deps.flush ?? invalidateLinks)(
      deps.cache,
      row.domain ?? deps.linkDomain,
      [
        ...new Set(
          [row.urlCode ?? row.key, ...(row.previousKeys ?? [])].filter(
            (key): key is string => Boolean(key),
          ),
        ),
      ],
    );
    const remaining = row.ruleSchedule!.remaining,
      next = remaining[0];
    await links.updateOne(fence, {
      $set: {
        "ruleSchedule.remaining": remaining.slice(1),
        "ruleSchedule.attempts": 0,
        "ruleSchedule.queued": false,
        ...(next
          ? { "ruleSchedule.nextAt": next }
          : { "ruleSchedule.completedAt": new Date() }),
      },
      $unset: {
        "ruleSchedule.token": "",
        "ruleSchedule.leaseUntil": "",
        "ruleSchedule.publishedAt": "",
        "ruleSchedule.retryAt": "",
        "ruleSchedule.lastError": "",
        ...(!next ? { "ruleSchedule.nextAt": "" } : {}),
      },
    });
  } catch {
    const delay = Math.min(
      60000,
      1000 * 2 ** Math.min(row.ruleSchedule!.attempts - 1, 6),
    );
    const retryAt = new Date(Date.now() + delay);
    await links.updateOne(fence, {
      $set: {
        "ruleSchedule.retryAt": retryAt,
        "ruleSchedule.queued": true,
        "ruleSchedule.publishedAt": new Date(retryAt.getTime() - 60000),
        "ruleSchedule.lastError": "cache_unavailable",
      },
      $unset: {
        "ruleSchedule.token": "",
        "ruleSchedule.leaseUntil": "",
      },
    });
  }
}

export function createRuleScheduleWorker(
  deps: Dependencies & {
    durable: Redis;
    queueName?: string;
    log: (message: string, error?: unknown) => void;
  },
) {
  const name = deps.queueName ?? "shortn-rule-schedules",
    consumer = deps.durable.duplicate({ maxRetriesPerRequest: null }),
    producer = deps.durable.duplicate({ maxRetriesPerRequest: 1 });
  const queue = new Queue(name, { connection: producer });
  const worker = new Worker<{
    id: string;
    generation: string;
    boundary: number;
  }>(
    name,
    (job) =>
      invalidateRuleBoundary(
        deps,
        job.data.id,
        job.data.generation,
        job.data.boundary,
      ),
    { connection: consumer, concurrency: 10 },
  );
  worker.on("error", (error) => deps.log("Rule schedule queue error", error));
  queue.on("error", (error) => deps.log("Rule schedule producer error", error));
  let pumping: Promise<void> | undefined,
    closing = false;
  function pump(): Promise<void> {
    if (closing) return Promise.resolve();
    if (pumping) return pumping;
    pumping = (async () => {
      const links = collection(deps.db, "links"),
        now = new Date();
      const legacy = await links
        .find(
          {
            "ruleSchedule.generation": { $exists: false },
            $or: ["activeFrom", "expiresAt", "startsAt"].map((field) => ({
              [`rules.${field}`]: { $type: "date" },
            })),
          },
          { projection: { rules: 1 } },
        )
        .sort({ _id: 1 })
        .limit(50)
        .toArray();
      for (const link of legacy) {
        const request = requestRuleSchedule(link.rules);
        if (request)
          await links.updateOne(
            {
              _id: link._id,
              "ruleSchedule.generation": { $exists: false },
              rules: link.rules,
            },
            { $set: { ruleSchedule: request } },
          );
      }
      const old = await links
        .find(
          {
            "ruleSchedule.nextAt": { $type: "date" },
            "ruleSchedule.queued": { $exists: false },
          },
          { projection: { ruleSchedule: 1 } },
        )
        .sort({ "ruleSchedule.nextAt": 1, _id: 1 })
        .limit(50)
        .toArray();
      for (const row of old)
        await links.updateOne(
          {
            _id: row._id,
            "ruleSchedule.generation": row.ruleSchedule!.generation,
            "ruleSchedule.queued": { $exists: false },
          },
          { $set: { "ruleSchedule.queued": false } },
        );
      const recover = await links
        .find(
          {
            "ruleSchedule.queued": true,
            "ruleSchedule.nextAt": { $type: "date" },
            "ruleSchedule.publishedAt": {
              $lte: new Date(now.getTime() - 60000),
            },
            $or: [
              { "ruleSchedule.leaseUntil": { $exists: false } },
              { "ruleSchedule.leaseUntil": { $lte: now } },
            ],
          },
          { projection: { ruleSchedule: 1 } },
        )
        .sort({ "ruleSchedule.publishedAt": 1, _id: 1 })
        .limit(100)
        .toArray();
      for (const row of recover) {
        const schedule = row.ruleSchedule!;
        const job = await queue.getJob(
          jobIdentity(
            String(row._id),
            schedule.generation,
            schedule.nextAt!.getTime(),
            schedule.attempts,
          ),
        );
        const state = job ? await job.getState() : "unknown";
        const existing =
          state === "delayed" ||
          state === "waiting" ||
          state === "active" ||
          state === "prioritized" ||
          state === "waiting-children";
        if (!existing && job) await job.remove();
        await links.updateOne(
          {
            _id: row._id,
            "ruleSchedule.generation": schedule.generation,
            "ruleSchedule.nextAt": schedule.nextAt,
            "ruleSchedule.publishedAt": schedule.publishedAt,
          },
          existing
            ? { $set: { "ruleSchedule.publishedAt": now } }
            : {
                $set: { "ruleSchedule.queued": false },
                $unset: { "ruleSchedule.publishedAt": "" },
              },
        );
      }
      const rows = await links
        .find(
          {
            "ruleSchedule.queued": false,
            "ruleSchedule.nextAt": { $lte: new Date(now.getTime() + 3600000) },
          },
          { projection: { ruleSchedule: 1 } },
        )
        .sort({ "ruleSchedule.nextAt": 1, _id: 1 })
        .limit(100)
        .toArray();
      for (const row of rows) {
        const schedule = row.ruleSchedule!,
          boundary = schedule.nextAt!.getTime(),
          timestamp = Date.now();
        await queue.add(
          "invalidate",
          { id: String(row._id), generation: schedule.generation, boundary },
          {
            jobId: jobIdentity(
              String(row._id),
              schedule.generation,
              boundary,
              schedule.attempts,
            ),
            timestamp,
            delay: Math.max(0, boundary - timestamp),
            removeOnComplete: true,
            removeOnFail: true,
          },
        );
        await links.updateOne(
          {
            _id: row._id,
            "ruleSchedule.generation": schedule.generation,
            "ruleSchedule.nextAt": schedule.nextAt,
            "ruleSchedule.queued": false,
          },
          {
            $set: {
              "ruleSchedule.publishedAt": now,
              "ruleSchedule.queued": true,
            },
          },
        );
      }
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
        deps.log("Rule pump failed during shutdown", error),
      );
      await worker.close();
      await queue.close();
      producer.disconnect();
      consumer.disconnect();
    },
  };
}
