import { createHash } from "node:crypto";
import { ObjectId, type Db } from "mongodb";
import { collection, physicalNames } from "@shortn/db";
import { getQr } from "./service";
import type { ServiceContext } from "../workspaces/context";
import { can } from "../workspaces/authz";
import { ok, fail } from "../result";

export type QrJobFormat = "svg" | "png" | "pdf";
export interface QrExportJob {
  _id: ObjectId;
  requestKey: string;
  workspaceId: ObjectId;
  userId: string;
  qrId: ObjectId;
  design: Record<string, unknown>;
  data: string;
  name: string;
  format: QrJobFormat;
  size: number;
  state: "pending" | "running" | "completed" | "failed";
  attempts: number;
  createdAt: Date;
  nextAttemptAt: Date;
  expiresAt: Date;
  leaseToken?: string;
  leaseUntil?: Date;
  objectKey?: string;
  error?: string;
  contentType?: string;
  bytes?: number;
  print?: { minimumMm: number; quietModules: number; correction: string };
}
export const qrExportJobs = (db: Db) =>
  db.collection<QrExportJob>(physicalNames.qr_export_jobs);

/** Public view omits the design, private key and creator metadata. */
export const qrExportView = (job: QrExportJob) => ({
  id: job._id.toHexString(),
  state: job.state,
  format: job.format,
  size: job.size,
  createdAt: job.createdAt.toISOString(),
  expiresAt: job.expiresAt.toISOString(),
  ...(job.error ? { error: job.error } : {}),
  ...(job.print ? { print: job.print } : {}),
});

export async function requestQrExport(
  ctx: ServiceContext,
  id: string,
  input: { format: QrJobFormat; size?: number },
  now = new Date(),
) {
  if (!can(ctx.actor, "workspace.view")) return fail("forbidden");
  if (
    !(await collection(ctx.db, "workspace_members").findOne({
      workspaceId: ctx.workspace._id,
      userId: ctx.actor.userId,
    }))
  )
    return fail("forbidden");
  const size = input.size ?? 1024;
  if (
    !["svg", "png", "pdf"].includes(input.format) ||
    !Number.isInteger(size) ||
    size < 128 ||
    size > 4096
  )
    return fail("invalid_export");
  const qr = await getQr(ctx, id);
  if (!qr) return fail("not_found");
  const design = structuredClone(qr.storedDesign);
  const snapshot = JSON.stringify({ design, data: qr.shortUrl });
  if (Buffer.byteLength(snapshot) > 65536) return fail("invalid_export");
  // One immutable snapshot per creator/day deduplicates retries without
  // sharing a creator's liveness check with a different requesting member.
  const day = Math.floor(now.getTime() / 86400000);
  const requestKey = createHash("sha256")
    .update(
      `${ctx.workspace._id}:${ctx.actor.userId}:${id}:${input.format}:${size}:${day}:${snapshot}`,
    )
    .digest("hex");
  const expiresAt = new Date(now.getTime() + 86400000);
  const job = await qrExportJobs(ctx.db)
    .findOneAndUpdate(
      { requestKey },
      {
        $setOnInsert: {
          _id: new ObjectId(),
          requestKey,
          workspaceId: ctx.workspace._id,
          userId: ctx.actor.userId,
          qrId: new ObjectId(qr.id),
          design,
          data: qr.shortUrl,
          name: qr.publicId || qr.id,
          format: input.format,
          size,
          state: "pending",
          attempts: 0,
          createdAt: now,
          nextAttemptAt: now,
          expiresAt,
        },
      },
      { upsert: true, returnDocument: "after" },
    )
    .catch(async (error: unknown) => {
      if ((error as { code?: number }).code !== 11000) throw error;
      return qrExportJobs(ctx.db).findOne({ requestKey });
    });
  return ok(qrExportView(job!));
}

export async function getQrExport(
  ctx: ServiceContext,
  id: string,
  now = new Date(),
) {
  if (!/^[a-f0-9]{24}$/i.test(id) || !can(ctx.actor, "workspace.view"))
    return null;
  const job = await qrExportJobs(ctx.db).findOne({
    _id: new ObjectId(id),
    workspaceId: ctx.workspace._id,
    expiresAt: { $gt: now },
  });
  if (!job || !(await getQr(ctx, job.qrId.toHexString()))) return null;
  // Removed members cannot poll even when an older service context is reused.
  if (
    !(await collection(ctx.db, "workspace_members").findOne({
      workspaceId: ctx.workspace._id,
      userId: ctx.actor.userId,
    }))
  )
    return null;
  return job;
}

export async function qrExportDelivery(
  ctx: ServiceContext,
  id: string,
  sign: (key: string, seconds: number, filename: string) => Promise<string>,
  now = new Date(),
) {
  const job = await getQrExport(ctx, id, now);
  if (!job) return null;
  const view = qrExportView(job);
  if (
    job.state !== "completed" ||
    !job.objectKey?.startsWith(`exports/qr/${ctx.workspace._id}/`)
  )
    return view;
  const seconds = Math.min(
    86400,
    Math.floor((job.expiresAt.getTime() - now.getTime()) / 1000),
  );
  if (seconds < 1) return null;
  const filename = `${job.name.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 140)}.${job.format}`;
  return {
    ...view,
    downloadUrl: await sign(job.objectKey, seconds, filename),
    downloadExpiresAt: new Date(now.getTime() + seconds * 1000).toISOString(),
  };
}
