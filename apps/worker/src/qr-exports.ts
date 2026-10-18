import { blockingQueueRedis } from "./queue-redis";
import { randomUUID } from "node:crypto";
import { Queue, Worker } from "bullmq";
import type Redis from "ioredis";
import type { Db } from "mongodb";
import { collection } from "@shortn/db";
import { getQr, qrExportJobs, qrZipJobs, type QrExportJob } from "@shortn/core";
import { QrPrintError } from "@shortn/qr-render";
import type { ObjectStore } from "@shortn/storage";
import { ensureQrArtifact } from "./qr-artifact";
import { runQrZipExport } from "./qr-zip";

interface Dependencies {
  db: Db;
  store: ObjectStore;
  linkDomain: string;
  logoOrigins: string[];
}
async function live(deps: Dependencies, job: QrExportJob) {
  const [workspace, member] = await Promise.all([
    collection(deps.db, "workspaces").findOne({ _id: job.workspaceId }),
    collection(deps.db, "workspace_members").findOne({
      workspaceId: job.workspaceId,
      userId: job.userId,
    }),
  ]);
  return Boolean(
    workspace &&
    member &&
    (await getQr(
      { db: deps.db, workspace, linkDomain: deps.linkDomain },
      job.qrId.toHexString(),
    )),
  );
}

export async function runQrExport(
  deps: Dependencies,
  id: string,
  now = new Date(),
) {
  const jobs = qrExportJobs(deps.db),
    token = randomUUID();
  if (!/^[a-f0-9]{24}$/i.test(id)) return false;
  const { ObjectId } = await import("mongodb");
  const job = await jobs.findOneAndUpdate(
    {
      _id: new ObjectId(id),
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
      },
      $inc: { attempts: 1 },
    },
    { returnDocument: "after" },
  );
  if (!job) return false;
  const fence = { _id: job._id, leaseToken: token, state: "running" as const };
  try {
    if (!(await live(deps, job))) throw new Error("access_removed");
    const artifact = await ensureQrArtifact(deps, job, () => live(deps, job));
    const finishedAt = new Date();
    if (finishedAt >= job.expiresAt) throw new Error("expired");
    await jobs.updateOne(fence, {
      $set: { state: "completed", ...artifact },
      $unset: { leaseToken: "", leaseUntil: "", error: "" },
    });
  } catch (error) {
    const permanent =
      error instanceof QrPrintError ||
      (error instanceof Error &&
        ["access_removed", "expired"].includes(error.message));
    const code =
      error instanceof QrPrintError
        ? error.code
        : permanent && error instanceof Error
          ? error.message
          : "storage_unavailable";
    const retry = !permanent && job.attempts < 5;
    await jobs.updateOne(fence, {
      $set: {
        state: retry ? "pending" : "failed",
        error: code,
        nextAttemptAt: new Date(
          Date.now() + Math.min(300_000, 5000 * 2 ** (job.attempts - 1)),
        ),
      },
      $unset: { leaseToken: "", leaseUntil: "" },
    });
  }
  return true;
}

export function createQrExportWorker(
  deps: Dependencies & {
    durable: Redis;
    queueName?: string;
    log: (message: string, error?: unknown) => void;
  },
) {
  const name = deps.queueName ?? "shortn-qr-exports";
  const consumer = blockingQueueRedis(deps.durable),
    producer = deps.durable.duplicate({ maxRetriesPerRequest: 1 });
  const queue = new Queue(name, { connection: producer });
  const worker = new Worker<{ id: string; kind?: "zip" }>(
    name,
    (job) =>
      job.data.kind === "zip"
        ? runQrZipExport(deps, job.data.id)
        : runQrExport(deps, job.data.id),
    { connection: consumer, concurrency: 2 },
  );
  worker.on("error", (error) => deps.log("QR export queue error", error));
  queue.on("error", (error) => deps.log("QR export producer error", error));
  let pumping: Promise<void> | undefined,
    closing = false;
  const pump = () => {
    if (closing) return Promise.resolve();
    if (pumping) return pumping;
    pumping = (async () => {
      const now = new Date();
      const due = await qrExportJobs(deps.db)
        .find(
          {
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
          "render",
          { id: job._id.toHexString() },
          {
            jobId: `${job._id}-${job.attempts}`,
            removeOnComplete: true,
            removeOnFail: true,
          },
        );
      const zips = await qrZipJobs(deps.db)
        .find(
          {
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
        .limit(25)
        .toArray();
      for (const job of zips)
        await queue.add(
          "zip",
          { id: job._id.toHexString(), kind: "zip" },
          {
            jobId: `zip-${job._id}-${job.attempts}`,
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
        deps.log("QR export pump stopped", error),
      );
      await worker.close();
      await queue.close();
      producer.disconnect();
      consumer.disconnect();
    },
  };
}
