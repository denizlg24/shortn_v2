import { randomUUID } from "node:crypto";
import { ObjectId, type Db, type Document } from "mongodb";
import type { Redis } from "ioredis";
import { Queue, Worker } from "bullmq";
import { collection } from "@shortn/db";
import { requestSafetyScan, scanAndPersistLink } from "@shortn/core";

const week = 7 * 86400000;
type Scan = typeof scanAndPersistLink;
type Dependencies = {
  db: Db;
  cache: Redis;
  linkDomain: string;
  provider?: Parameters<Scan>[2];
  scan?: Scan;
};

export async function runSafetyScan(
  deps: Dependencies,
  id: string,
  generation: string,
  now = new Date(),
) {
  if (!ObjectId.isValid(id)) return;
  const links = collection(deps.db, "links"),
    token = randomUUID();
  const claimed = await links.findOneAndUpdate(
    {
      _id: new ObjectId(id),
      deletedAt: { $exists: false },
      "safetyScan.generation": generation,
      "safetyScan.dueAt": { $lte: now },
      $or: [
        { "safetyScan.leaseUntil": { $exists: false } },
        { "safetyScan.leaseUntil": { $lte: now } },
      ],
    },
    {
      $set: {
        "safetyScan.token": token,
        "safetyScan.leaseUntil": new Date(now.getTime() + 120000),
      },
      $inc: { "safetyScan.attempts": 1 },
    } as Document,
    { returnDocument: "after" },
  );
  if (!claimed) return;
  const attempts = claimed.safetyScan!.attempts;
  let retry: boolean;
  let errorCode: string | undefined;
  try {
    const result = await (deps.scan ?? scanAndPersistLink)(
      { db: deps.db, cache: deps.cache, linkDomain: deps.linkDomain },
      claimed._id,
      deps.provider,
      { generation, token },
    );
    retry = !result?.applied || Boolean(result.retryReputation);
    if (result?.retryReputation) errorCode = "reputation_unavailable";
    else if (!result?.applied) errorCode = "stale_destination";
  } catch {
    retry = true;
    errorCode = "scan_failed";
  }
  const completed = new Date();
  const delay = retry
    ? Math.min(3600000, 5000 * 2 ** Math.min(attempts - 1, 10))
    : week;
  await links.updateOne(
    {
      _id: claimed._id,
      "safetyScan.generation": generation,
      "safetyScan.token": token,
    },
    {
      $set: {
        "safetyScan.dueAt": new Date(completed.getTime() + delay),
        ...(retry
          ? { "safetyScan.lastError": errorCode! }
          : { "safetyScan.completedAt": completed, "safetyScan.attempts": 0 }),
      },
      $unset: {
        "safetyScan.token": "",
        "safetyScan.leaseUntil": "",
        ...(!retry ? { "safetyScan.lastError": "" } : {}),
      },
    },
  );
}

export function createSafetyWorker(
  deps: Dependencies & {
    durable: Redis;
    queueName?: string;
    log: (message: string, error?: unknown) => void;
  },
) {
  const name = deps.queueName ?? "shortn-safety-scans";
  const consumer = deps.durable.duplicate({ maxRetriesPerRequest: null }),
    producer = deps.durable.duplicate({ maxRetriesPerRequest: 1 });
  const queue = new Queue(name, { connection: producer });
  const worker = new Worker<{ id: string; generation: string }>(
    name,
    (job) => runSafetyScan(deps, job.data.id, job.data.generation),
    { connection: consumer, concurrency: 2 },
  );
  worker.on("error", (error) => deps.log("Safety queue error", error));
  queue.on("error", (error) => deps.log("Safety producer error", error));
  let pumping: Promise<void> | undefined,
    closing = false;
  function pump(): Promise<void> {
    if (closing) return Promise.resolve();
    if (pumping) return pumping;
    pumping = (async () => {
      const links = collection(deps.db, "links"),
        now = new Date();
      // Recover pending legacy/earlier-v2 links without loading the library.
      const pending = await links
        .find(
          {
            safetyStatus: "pending",
            deletedAt: { $exists: false },
            "safetyScan.generation": { $exists: false },
          },
          { projection: { _id: 1 } },
        )
        .sort({ _id: 1 })
        .limit(50)
        .toArray();
      for (const link of pending)
        await links.updateOne(
          { _id: link._id, "safetyScan.generation": { $exists: false } },
          { $set: { safetyScan: requestSafetyScan(now) } },
        );
      const due = await links
        .find(
          {
            "safetyScan.dueAt": { $lte: now },
            deletedAt: { $exists: false },
            $or: [
              { "safetyScan.leaseUntil": { $exists: false } },
              { "safetyScan.leaseUntil": { $lte: now } },
            ],
          },
          { projection: { safetyScan: 1 } },
        )
        .sort({ "safetyScan.dueAt": 1, _id: 1 })
        .limit(50)
        .toArray();
      for (const link of due)
        await queue.add(
          "scan",
          { id: String(link._id), generation: link.safetyScan!.generation },
          {
            jobId: `${link._id}-${link.safetyScan!.generation}`,
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
        deps.log("Safety pump failed during shutdown", error),
      );
      await worker.close();
      await queue.close();
      producer.disconnect();
      consumer.disconnect();
    },
  };
}
