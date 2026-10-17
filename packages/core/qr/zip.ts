import { createHash } from "node:crypto";
import { ObjectId, type Db } from "mongodb";
import { collection, physicalNames } from "@shortn/db";
import type { ServiceContext } from "../workspaces/context";
import { can } from "../workspaces/authz";
import { ok, fail } from "../result";
import { getQr } from "./service";
import type { QrJobFormat } from "./exports";

export const QR_ZIP_LIMIT = 500;
export const QR_ZIP_MAX_BYTES = 512 * 1024 * 1024;
export interface QrZipJob {
  _id: ObjectId;
  requestKey: string;
  workspaceId: ObjectId;
  userId: string;
  itemFormat: QrJobFormat;
  size: number;
  total: number;
  done: number;
  state: "pending" | "running" | "completed" | "failed";
  phase: "rendering" | "assembling";
  attempts: number;
  createdAt: Date;
  expiresAt: Date;
  nextAttemptAt: Date;
  leaseToken?: string;
  leaseUntil?: Date;
  objectKey?: string;
  bytes?: number;
  error?: string;
  failedQrId?: string;
}
export interface QrZipItem {
  _id: ObjectId;
  jobId: ObjectId;
  position: number;
  qrId: ObjectId;
  design: Record<string, unknown>;
  data: string;
  name: string;
  expiresAt: Date;
  objectKey?: string;
  bytes?: number;
}
export const qrZipJobs = (db: Db) =>
  db.collection<QrZipJob>(physicalNames.qr_zip_jobs);
export const qrZipItems = (db: Db) =>
  db.collection<QrZipItem>(physicalNames.qr_zip_items);
export const qrZipView = (job: QrZipJob) => ({
  id: job._id.toHexString(),
  state: job.state,
  phase: job.phase,
  itemFormat: job.itemFormat,
  size: job.size,
  total: job.total,
  done: job.done,
  limit: QR_ZIP_LIMIT,
  maximumBytes: QR_ZIP_MAX_BYTES,
  createdAt: job.createdAt.toISOString(),
  expiresAt: job.expiresAt.toISOString(),
  ...(job.error ? { error: job.error } : {}),
  ...(job.failedQrId ? { failedQrId: job.failedQrId } : {}),
});

export async function requestQrZip(
  ctx: ServiceContext,
  input: { ids: string[]; format: QrJobFormat; size?: number },
  now = new Date(),
) {
  const size = input.size ?? 1024;
  if (
    !Array.isArray(input.ids) ||
    !input.ids.length ||
    input.ids.length > QR_ZIP_LIMIT ||
    input.ids.some((id) => !/^[a-f0-9]{24}$/i.test(id)) ||
    !["svg", "png", "pdf"].includes(input.format) ||
    !Number.isInteger(size) ||
    size < 128 ||
    size > 4096
  )
    return fail("invalid_export");
  if (
    !can(ctx.actor, "workspace.view") ||
    !(await collection(ctx.db, "workspace_members").findOne({
      workspaceId: ctx.workspace._id,
      userId: ctx.actor.userId,
    }))
  )
    return fail("forbidden");
  const ids = [...new Set(input.ids.map((id) => id.toLowerCase()))].sort();
  const jobId = new ObjectId(),
    expiresAt = new Date(now.getTime() + 86400000);
  const items: QrZipItem[] = [];
  const hash = createHash("sha256").update(
    `${ctx.workspace._id}:${ctx.actor.userId}:${input.format}:${size}:${Math.floor(now.getTime() / 86400000)}`,
  );
  for (const id of ids) {
    const qr = await getQr(ctx, id);
    if (!qr) return fail("not_found");
    const design = structuredClone(qr.storedDesign),
      snapshot = JSON.stringify({ id, design, data: qr.shortUrl });
    if (Buffer.byteLength(snapshot) > 65536) return fail("invalid_export");
    hash.update(`\n${snapshot}`);
    items.push({
      _id: new ObjectId(),
      jobId,
      position: items.length,
      qrId: new ObjectId(id),
      design,
      data: qr.shortUrl,
      name: `${String(items.length + 1).padStart(3, "0")}-${(qr.publicId || id).replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 100)}.${input.format}`,
      expiresAt,
    });
  }
  const requestKey = hash.digest("hex"),
    jobs = qrZipJobs(ctx.db);
  const previous = await jobs.findOne({ requestKey });
  if (previous) return ok(qrZipView(previous));
  const job: QrZipJob = {
    _id: jobId,
    requestKey,
    workspaceId: ctx.workspace._id,
    userId: ctx.actor.userId,
    itemFormat: input.format,
    size,
    total: items.length,
    done: 0,
    state: "pending",
    phase: "rendering",
    attempts: 0,
    createdAt: now,
    expiresAt,
    nextAttemptAt: now,
  };
  const session = ctx.db.client.startSession();
  try {
    await session.withTransaction(async () => {
      await jobs.insertOne(job, { session });
      await qrZipItems(ctx.db).insertMany(items, { session });
    });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const raced = await jobs.findOne({ requestKey });
    if (!raced) throw error;
    return ok(qrZipView(raced));
  } finally {
    await session.endSession();
  }
  return ok(qrZipView(job));
}

export async function qrZipDelivery(
  ctx: ServiceContext,
  id: string,
  sign: (key: string, seconds: number, filename: string) => Promise<string>,
  now = new Date(),
) {
  if (
    !/^[a-f0-9]{24}$/i.test(id) ||
    !can(ctx.actor, "workspace.view") ||
    !(await collection(ctx.db, "workspace_members").findOne({
      workspaceId: ctx.workspace._id,
      userId: ctx.actor.userId,
    }))
  )
    return null;
  const job = await qrZipJobs(ctx.db).findOne({
    _id: new ObjectId(id),
    workspaceId: ctx.workspace._id,
    expiresAt: { $gt: now },
  });
  if (!job) return null;
  // All selected resources must remain readable before issuing the capability.
  const cursor = qrZipItems(ctx.db)
    .find({ jobId: job._id }, { projection: { qrId: 1 } })
    .sort({ position: 1 })
    .batchSize(25);
  let count = 0;
  for await (const item of cursor) {
    if (!(await getQr(ctx, item.qrId.toHexString()))) return null;
    count++;
  }
  if (count !== job.total) return null;
  if (
    !(await collection(ctx.db, "workspace_members").findOne({
      workspaceId: ctx.workspace._id,
      userId: ctx.actor.userId,
    }))
  )
    return null;
  const view = qrZipView(job),
    seconds = Math.min(
      86400,
      Math.floor((job.expiresAt.getTime() - now.getTime()) / 1000),
    );
  if (seconds < 1) return null;
  if (
    job.state !== "completed" ||
    !job.objectKey?.startsWith(
      `exports/jobs/qr/${ctx.workspace._id}/${job._id}/`,
    )
  )
    return view;
  return {
    ...view,
    downloadUrl: await sign(job.objectKey, seconds, `qr-${job._id}.zip`),
    downloadExpiresAt: new Date(now.getTime() + seconds * 1000).toISOString(),
  };
}
