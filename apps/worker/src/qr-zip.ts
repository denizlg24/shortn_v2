import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import { Zip, ZipPassThrough } from "fflate";
import { collection } from "@shortn/db";
import {
  getQr,
  qrZipJobs,
  qrZipItems,
  QR_ZIP_MAX_BYTES,
  type QrZipJob,
  type QrZipItem,
} from "@shortn/core";
import { QrPrintError } from "@shortn/qr-render";
import { ensureQrArtifact, type QrArtifactDependencies } from "./qr-artifact";

async function readable(
  deps: QrArtifactDependencies,
  job: QrZipJob,
  item?: QrZipItem,
) {
  const [workspace, member] = await Promise.all([
    collection(deps.db, "workspaces").findOne({ _id: job.workspaceId }),
    collection(deps.db, "workspace_members").findOne({
      workspaceId: job.workspaceId,
      userId: job.userId,
    }),
  ]);
  if (!workspace || !member) return false;
  return (
    !item ||
    Boolean(
      await getQr(
        { db: deps.db, workspace, linkDomain: deps.linkDomain },
        item.qrId.toHexString(),
      ),
    )
  );
}

export async function runQrZipExport(
  deps: QrArtifactDependencies,
  id: string,
  now = new Date(),
) {
  if (!/^[a-f0-9]{24}$/i.test(id)) return false;
  const jobs = qrZipJobs(deps.db),
    items = qrZipItems(deps.db),
    token = randomUUID();
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
  const fence = { _id: job._id, state: "running" as const, leaseToken: token };
  let currentQrId: string | undefined;
  const heartbeat = async (done?: number) => {
    if (Date.now() >= job.expiresAt.getTime()) throw new Error("expired");
    const result = await jobs.updateOne(fence, {
      $set: { leaseUntil: new Date(Date.now() + 300_000) },
      ...(done !== undefined ? { $max: { done } } : {}),
    });
    if (!result.matchedCount) throw new Error("lease_lost");
  };
  try {
    if (!deps.store.putStream) throw new Error("streaming_unavailable");
    if (!(await readable(deps, job))) throw new Error("access_removed");
    let completed = 0;
    const cursor = items
      .find({ jobId: job._id })
      .sort({ position: 1 })
      .batchSize(10);
    for await (const item of cursor) {
      currentQrId = item.qrId.toHexString();
      await heartbeat();
      if (!(await readable(deps, job, item))) throw new Error("access_removed");
      const cached = item.objectKey
        ? await deps.store.head(item.objectKey)
        : null;
      if (!cached || cached.bytes <= 0) {
        const artifact = await ensureQrArtifact(
          deps,
          {
            workspaceId: job.workspaceId,
            design: item.design,
            data: item.data,
            format: job.itemFormat,
            size: job.size,
          },
          () => readable(deps, job, item),
        );
        await heartbeat();
        await items.updateOne(
          { _id: item._id, jobId: job._id },
          { $set: { objectKey: artifact.objectKey, bytes: artifact.bytes } },
        );
      }
      completed++;
      await heartbeat(completed);
    }
    if (completed !== job.total) throw new Error("snapshot_missing");
    await jobs.updateOne(fence, { $set: { phase: "assembling" } });
    const objectKey = `exports/jobs/qr/${job.workspaceId}/${job._id}/${token}.zip`;
    const chunks = async function* () {
      let queue: Uint8Array[] = [],
        failure: Error | undefined;
      const zip = new Zip((error, data) => {
        if (error) failure = error;
        else queue.push(data);
      });
      const entries = items
        .find({ jobId: job._id })
        .sort({ position: 1 })
        .batchSize(10);
      try {
        for await (const item of entries) {
          currentQrId = item.qrId.toHexString();
          await heartbeat();
          if (
            !item.objectKey?.startsWith(`exports/qr/${job.workspaceId}/`) ||
            !(await readable(deps, job, item))
          )
            throw new Error("access_removed");
          const bytes = await deps.store.get(item.objectKey, 64 * 1024 * 1024);
          const entry = new ZipPassThrough(item.name);
          entry.mtime = new Date("2000-01-01T00:00:00Z");
          zip.add(entry);
          entry.push(bytes, true);
          if (failure) throw failure;
          for (const chunk of queue) yield chunk;
          queue = [];
        }
        zip.end();
        if (failure) throw failure;
        for (const chunk of queue) yield chunk;
      } finally {
        await entries.close();
        zip.terminate();
      }
    };
    const bytes = await deps.store.putStream(
      objectKey,
      chunks(),
      "application/zip",
      QR_ZIP_MAX_BYTES,
    );
    await heartbeat();
    if (!(await readable(deps, job))) throw new Error("access_removed");
    // Verify all resources again before publishing a completed capability.
    const verify = items.find({ jobId: job._id }).batchSize(10);
    for await (const item of verify)
      if (!(await readable(deps, job, item))) throw new Error("access_removed");
    await jobs.updateOne(fence, {
      $set: { state: "completed", done: job.total, objectKey, bytes },
      $unset: { leaseToken: "", leaseUntil: "", error: "", failedQrId: "" },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "lease_lost") return true;
    const permanent =
      error instanceof QrPrintError ||
      (error instanceof Error &&
        [
          "access_removed",
          "expired",
          "archive_too_large",
          "snapshot_missing",
        ].includes(error.message));
    const code =
      error instanceof QrPrintError
        ? error.code
        : permanent && error instanceof Error
          ? error.message
          : "storage_unavailable";
    await jobs.updateOne(fence, {
      $set: {
        state: !permanent && job.attempts < 5 ? "pending" : "failed",
        error: code,
        ...(error instanceof QrPrintError && currentQrId
          ? { failedQrId: currentQrId }
          : {}),
        nextAttemptAt: new Date(
          Date.now() + Math.min(300_000, 5000 * 2 ** (job.attempts - 1)),
        ),
      },
      $unset: { leaseToken: "", leaseUntil: "" },
    });
  }
  return true;
}
