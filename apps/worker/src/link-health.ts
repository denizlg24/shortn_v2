import { randomUUID } from "node:crypto";
import { ObjectId, type Db, type Document } from "mongodb";
import type { Redis } from "ioredis";
import { Queue, Worker } from "bullmq";
import { collection } from "@shortn/db";
import { requestHealthCheck, healthSignature } from "@shortn/core";
import {
  probeHealth,
  reserveHealthHost,
  type HealthProbeResult,
} from "./health-probe";
const week = 7 * 86400000;
type Dependencies = {
  db: Db;
  durable: Redis;
  probe?: (url: string) => Promise<HealthProbeResult>;
};
export async function runHealthCheck(
  deps: Dependencies,
  id: string,
  generation: string,
  iteration: number,
  now = new Date(),
) {
  if (
    !/^[a-f\d]{24}$/i.test(id) ||
    !Number.isSafeInteger(iteration) ||
    iteration < 0
  )
    return;
  const links = collection(deps.db, "links"),
    token = randomUUID();
  const claimed = await links.findOneAndUpdate(
    {
      _id: new ObjectId(id),
      deletedAt: { $exists: false },
      "health.generation": generation,
      "health.iteration": iteration,
      "health.nextAt": { $lte: now },
      $or: [
        { "health.leaseUntil": { $exists: false } },
        { "health.leaseUntil": { $lte: now } },
      ],
    },
    {
      $set: {
        "health.token": token,
        "health.leaseUntil": new Date(now.getTime() + 60000),
      },
      $inc: { "health.attempts": 1 },
    } as Document,
    { returnDocument: "after" },
  );
  if (!claimed?.health) return;
  const health = claimed.health;
  const fence = {
    _id: claimed._id,
    deletedAt: { $exists: false },
    "health.generation": generation,
    "health.iteration": iteration,
    "health.token": token,
    longUrl: claimed.longUrl,
    rules: claimed.rules === undefined ? { $exists: false } : claimed.rules,
  };
  // Legacy mutations can bypass the core mutation helpers. Never check a stale
  // target list or publish a result for the previous destination set.
  if (
    !claimed.longUrl ||
    health.signature !== healthSignature(claimed.longUrl, claimed.rules)
  ) {
    await links.updateOne(fence, {
      $set: {
        health: requestHealthCheck(claimed.longUrl ?? "", claimed.rules, now),
      },
    });
    return;
  }
  const target = health.remaining[0];
  if (!target) return;
  let outcome: HealthProbeResult;
  try {
    outcome = await (
      deps.probe ??
      ((url) =>
        probeHealth(url, {
          reserve: (host) => reserveHealthHost(deps.durable, host),
        }))
    )(target);
  } catch {
    await links.updateOne(fence, {
      $set: {
        "health.lastError": "probe_failed",
        "health.nextAt": new Date(
          Date.now() +
            Math.min(60000, 5000 * 2 ** Math.min(health.attempts - 1, 4)),
        ),
      },
      $unset: { "health.token": "", "health.leaseUntil": "" },
    });
    return;
  }
  const completed = new Date();
  if ("retryAfter" in outcome) {
    await links.updateOne(fence, {
      $set: {
        "health.nextAt": new Date(
          completed.getTime() +
            Math.max(1000, Math.min(60000, outcome.retryAfter)),
        ),
        "health.attempts": 0,
      },
      $unset: { "health.token": "", "health.leaseUntil": "" },
    });
    return;
  }
  const previous = health.checks.find((check) => check.url === target);
  const streak =
    outcome.status === "http_error"
      ? (previous?.status === "http_error" ? previous.streak : 0) + 1
      : 0;
  const check = {
    url: target,
    ...outcome,
    checkedAt: completed,
    streak,
    ...(streak
      ? {
          failingSince:
            previous?.status === "http_error"
              ? (previous.failingSince ?? completed)
              : completed,
        }
      : {}),
  };
  const remaining = health.remaining.slice(1),
    done = remaining.length === 0;
  await links.updateOne(fence, {
    $set: {
      "health.checks": [
        ...health.checks.filter((check) => check.url !== target),
        check,
      ],
      "health.remaining": done ? health.targets : remaining,
      "health.nextAt": new Date(completed.getTime() + (done ? week : 0)),
      "health.iteration": iteration + 1,
      "health.attempts": 0,
      ...(done ? { "health.completedAt": completed } : {}),
    },
    $unset: {
      "health.token": "",
      "health.leaseUntil": "",
      "health.lastError": "",
    },
  });
}
export function createHealthWorker(
  deps: Dependencies & {
    queueName?: string;
    log: (message: string, error?: unknown) => void;
  },
) {
  const name = deps.queueName ?? "shortn-link-health",
    consumer = deps.durable.duplicate({ maxRetriesPerRequest: null }),
    producer = deps.durable.duplicate({ maxRetriesPerRequest: 1 });
  const queue = new Queue(name, { connection: producer });
  const worker = new Worker<{
    id: string;
    generation: string;
    iteration: number;
  }>(
    name,
    (job) =>
      runHealthCheck(
        deps,
        job.data.id,
        job.data.generation,
        job.data.iteration,
      ),
    { connection: consumer, concurrency: 2 },
  );
  worker.on("error", (error) => deps.log("Health queue error", error));
  queue.on("error", (error) => deps.log("Health producer error", error));
  let pumping: Promise<void> | undefined,
    closing = false;
  const pump = (): Promise<void> => {
    if (closing) return Promise.resolve();
    if (pumping) return pumping;
    pumping = (async () => {
      const links = collection(deps.db, "links"),
        now = new Date();
      const missing = await links
        .find(
          {
            deletedAt: { $exists: false },
            longUrl: { $type: "string" },
            "health.generation": { $exists: false },
          },
          { projection: { longUrl: 1, rules: 1 } },
        )
        .sort({ _id: 1 })
        .limit(50)
        .toArray();
      for (const link of missing)
        await links.updateOne(
          {
            _id: link._id,
            deletedAt: { $exists: false },
            longUrl: link.longUrl,
            rules: link.rules === undefined ? { $exists: false } : link.rules,
            "health.generation": { $exists: false },
          },
          {
            $set: {
              health: requestHealthCheck(link.longUrl!, link.rules, now),
            },
          },
        );
      const due = await links
        .find(
          {
            deletedAt: { $exists: false },
            "health.nextAt": { $lte: now },
            $or: [
              { "health.leaseUntil": { $exists: false } },
              { "health.leaseUntil": { $lte: now } },
            ],
          },
          { projection: { health: 1 } },
        )
        .sort({ "health.nextAt": 1, _id: 1 })
        .limit(50)
        .toArray();
      for (const link of due)
        await queue.add(
          "health",
          {
            id: String(link._id),
            generation: link.health!.generation,
            iteration: link.health!.iteration,
          },
          {
            jobId: `${link._id}-${link.health!.generation}-${link.health!.iteration}`,
            removeOnComplete: true,
            removeOnFail: true,
          },
        );
    })().finally(() => {
      pumping = undefined;
    });
    return pumping;
  };
  return {
    pump,
    queue,
    worker,
    async close() {
      closing = true;
      await pumping?.catch((error) =>
        deps.log("Health pump failed during shutdown", error),
      );
      await worker.close();
      await queue.close();
      producer.disconnect();
      consumer.disconnect();
    },
  };
}
