import { randomUUID } from "node:crypto";
import { ObjectId, type Db } from "mongodb";
import { Queue, Worker } from "bullmq";
import type Redis from "ioredis";
import { collection } from "@shortn/db";
import {
  resolveAnalyticsExport,
  analyticsExportJobs,
  streamAnalyticsExport,
  LinkExportError,
  type ServiceContext,
} from "@shortn/core";
import type { ObjectStore } from "@shortn/storage";

interface Dependencies {
  db: Db;
  cache: Redis;
  store: ObjectStore;
  linkDomain: string;
}
export async function runAnalyticsExport(
  deps: Dependencies,
  id: string,
  now = new Date(),
) {
  if (!/^[a-f\d]{24}$/i.test(id)) return false;
  const jobs = analyticsExportJobs(deps.db),
    token = randomUUID();
  const job = await jobs.findOneAndUpdate(
    {
      _id: new ObjectId(id),
      kind: "analytics",
      expiresAt: { $gt: now },
      nextAttemptAt: { $lte: now },
      $or: [
        { state: "pending" },
        { state: "running", leaseUntil: { $lte: now } },
      ],
    },
    {
      $set: {
        state: "running",
        leaseToken: token,
        leaseUntil: new Date(now.getTime() + 300_000),
        done: 0,
      },
      $inc: { attempts: 1 },
    },
    { returnDocument: "after" },
  );
  if (!job) return false;
  const controller = new AbortController(),
    fence = { _id: job._id, state: "running" as const, leaseToken: token };
  let timer: ReturnType<typeof setInterval> | undefined,
    heartbeat: Promise<void> | undefined,
    done = 0;
  try {
    if (!deps.store.putStream) throw new Error("streaming_storage_required");
    const [workspace, member] = await Promise.all([
      collection(deps.db, "workspaces").findOne({ _id: job.workspaceId }),
      collection(deps.db, "workspace_members").findOne({
        workspaceId: job.workspaceId,
        userId: job.createdBy,
      }),
    ]);
    if (!workspace || !member) throw new LinkExportError("forbidden");
    const ctx: ServiceContext = {
      db: deps.db,
      cache: deps.cache,
      workspace,
      actor: { userId: member.userId, role: member.role },
      linkDomain: deps.linkDomain,
    };
    const renew = async (count?: number) => {
      const current = await resolveAnalyticsExport(
        ctx,
        job.query,
        job.createdAt,
      );
      if (current.range.from > new Date(job.range.from))
        throw new LinkExportError("feature_required");
      const at = new Date();
      const changed = await jobs.updateOne(
        { ...fence, leaseUntil: { $gt: at }, expiresAt: { $gt: at } },
        {
          $set: {
            leaseUntil: new Date(at.getTime() + 300_000),
            ...(count === undefined ? {} : { done: count }),
          },
        },
      );
      if (!changed.matchedCount) throw new Error("lease_lost");
    };
    timer = setInterval(() => {
      if (!heartbeat)
        heartbeat = renew()
          .catch(() => {
            controller.abort();
          })
          .finally(() => {
            heartbeat = undefined;
          });
    }, 30_000);
    const key = `exports/jobs/analytics/${job.workspaceId}/${job._id}/${token}.${job.format}`;
    const bytes = await deps.store.putStream(
      key,
      streamAnalyticsExport(
        ctx,
        job.query,
        job.createdAt,
        controller.signal,
        async (count) => {
          done = count;
          await renew(count);
        },
        job.range,
      ),
      job.format === "csv" ? "text/csv; charset=utf-8" : "application/x-ndjson",
      1024 * 1024 * 1024,
    );
    await renew(done);
    await jobs.updateOne(
      {
        ...fence,
        expiresAt: { $gt: new Date() },
        leaseUntil: { $gt: new Date() },
      },
      {
        $set: { state: "completed", done, objectKey: key, bytes },
        $unset: { leaseToken: "", leaseUntil: "", error: "" },
      },
    );
  } catch (error) {
    const code =
      error instanceof LinkExportError
        ? error.code
        : error instanceof Error &&
            [
              "lease_lost",
              "archive_too_large",
              "expired",
              "streaming_storage_required",
            ].includes(error.message)
          ? error.message
          : "storage_unavailable";
    if (code === "lease_lost") return true;
    const permanent =
      error instanceof LinkExportError ||
      code === "archive_too_large" ||
      code === "expired";
    await jobs.updateOne(fence, {
      $set: {
        state: permanent || job.attempts >= 5 ? "failed" : "pending",
        error: code,
        nextAttemptAt: new Date(
          Date.now() + Math.min(300_000, 5000 * 2 ** (job.attempts - 1)),
        ),
      },
      $unset: { leaseToken: "", leaseUntil: "" },
    });
  } finally {
    if (timer) clearInterval(timer);
    controller.abort();
    await heartbeat;
  }
  return true;
}
export function createAnalyticsExportWorker(
  deps: Dependencies & {
    durable: Redis;
    queueName?: string;
    log: (message: string, error?: unknown) => void;
  },
) {
  const name = deps.queueName ?? "shortn-analytics-exports",
    producer = deps.durable.duplicate({ maxRetriesPerRequest: 1 }),
    consumer = deps.durable.duplicate({ maxRetriesPerRequest: null });
  const queue = new Queue(name, { connection: producer }),
    worker = new Worker<{ id: string }>(
      name,
      (job) => runAnalyticsExport(deps, job.data.id),
      { connection: consumer, concurrency: 2 },
    );
  worker.on("error", (error) =>
    deps.log("Analytics export worker error", error),
  );
  queue.on("error", (error) =>
    deps.log("Analytics export producer error", error),
  );
  let pumping: Promise<void> | undefined,
    closing = false;
  const pump = () => {
    if (closing) return Promise.resolve();
    if (pumping) return pumping;
    pumping = (async () => {
      const now = new Date();
      const due = await analyticsExportJobs(deps.db)
        .find(
          {
            kind: "analytics",
            expiresAt: { $gt: now },
            nextAttemptAt: { $lte: now },
            $or: [
              { state: "pending" },
              { state: "running", leaseUntil: { $lte: now } },
            ],
          },
          { projection: { _id: 1, attempts: 1 } },
        )
        .sort({ nextAttemptAt: 1, _id: 1 })
        .limit(50)
        .toArray();
      for (const job of due)
        await queue.add(
          "export",
          { id: job._id.toHexString() },
          {
            jobId: `${job._id}-${job.attempts}`,
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
    queue,
    worker,
    pump,
    async close() {
      closing = true;
      await pumping?.catch((error) =>
        deps.log("Analytics export pump stopped", error),
      );
      await worker.close();
      await queue.close();
      producer.disconnect();
      consumer.disconnect();
    },
  };
}
