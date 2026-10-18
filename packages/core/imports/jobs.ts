import { ObjectId, type Db } from "mongodb";
import { physicalNames } from "@shortn/db";
import type { CreateLinkInput } from "../links/service";
import { can } from "../workspaces/authz";
import { nowOf, type ServiceContext } from "../workspaces/context";
import { fail, ok } from "../result";
import { withMutation } from "../webhooks/events";
import {
  importLimits,
  validateImportMapping,
  type ImportMapping,
  type ImportRecord,
} from "./csv";
import { importReservations } from "./quota";
export type ImportState =
  | "uploading"
  | "inspect_pending"
  | "inspecting"
  | "mapping"
  | "validate_pending"
  | "validating"
  | "ready"
  | "commit_pending"
  | "committing"
  | "completed"
  | "failed"
  | "cancelled";
export interface ImportJob {
  _id: ObjectId;
  workspaceId: ObjectId;
  createdBy: string;
  kind: "links" | "qr";
  inputKey: string;
  bytes: number;
  state: ImportState;
  generation: number;
  inspected: number;
  validated: number;
  done: number;
  warmed?: number;
  total: number;
  valid: number;
  invalid: number;
  counts: Record<string, number>;
  columns?: string[];
  preview?: ImportRecord[];
  mapping?: ImportMapping;
  sourceHash?: string;
  errorKey?: string;
  error?: string;
  quota?: Record<string, unknown>;
  createdAt: Date;
  expiresAt: Date;
  nextAttemptAt: Date;
  attempts: number;
  leaseToken?: string;
  leaseUntil?: Date;
  mutationRevision?: number;
}
export interface ImportRow extends ImportRecord {
  _id: ObjectId;
  jobId: ObjectId;
  position: number;
  expiresAt: Date;
}
export interface ImportResult {
  _id: ObjectId;
  jobId: ObjectId;
  generation: number;
  position: number;
  row: number;
  input?: CreateLinkInput;
  destination?: string;
  identity?: string;
  ordinal?: number;
  error?: string;
  expiresAt: Date;
}
export const importJobs = (db: Db) =>
  db.collection<ImportJob>(physicalNames.import_jobs);
export const importRows = (db: Db) =>
  db.collection<ImportRow>(physicalNames.import_rows);
export const importResults = (db: Db) =>
  db.collection<ImportResult>(physicalNames.import_results);
export const readableImport = (ctx: ServiceContext, job: ImportJob) =>
  job.workspaceId.equals(ctx.workspace._id) &&
  (job.createdBy === ctx.actor.userId ||
    ctx.actor.role === "owner" ||
    ctx.actor.role === "admin");
export async function getImportJob(ctx: ServiceContext, id: string) {
  if (!/^[a-f\d]{24}$/i.test(id)) return null;
  const job = await importJobs(ctx.db).findOne({
    _id: new ObjectId(id),
    workspaceId: ctx.workspace._id,
    expiresAt: { $gt: nowOf(ctx) },
  });
  return job && readableImport(ctx, job) ? job : null;
}
export async function createImportJob(
  ctx: ServiceContext,
  bytes: number,
  kind: ImportJob["kind"] = "links",
) {
  if (!can(ctx.actor, "resource.create")) return fail("forbidden" as const);
  if (!Number.isInteger(bytes) || bytes < 1 || !["links", "qr"].includes(kind))
    return fail("invalid_input" as const);
  if (bytes > importLimits.bytes) return fail("file_too_large" as const);
  const now = nowOf(ctx),
    _id = new ObjectId();
  const job: ImportJob = {
    _id,
    workspaceId: ctx.workspace._id,
    createdBy: ctx.actor.userId,
    kind,
    bytes,
    inputKey: `imports/${ctx.workspace._id}/${_id}.csv`,
    state: "uploading",
    generation: 0,
    inspected: 0,
    validated: 0,
    done: 0,
    warmed: 0,
    total: 0,
    valid: 0,
    invalid: 0,
    counts: {},
    createdAt: now,
    expiresAt: new Date(now.getTime() + 86400_000),
    nextAttemptAt: now,
    attempts: 0,
  };
  await importJobs(ctx.db).insertOne(job);
  return ok(job);
}
async function editable(ctx: ServiceContext, id: string) {
  const job = await getImportJob(ctx, id);
  return job &&
    can(ctx.actor, "resource.create") &&
    job.createdBy === ctx.actor.userId
    ? job
    : null;
}
export async function inspectImport(ctx: ServiceContext, id: string) {
  const job = await editable(ctx, id);
  if (!job) return fail("not_found" as const);
  const result = await importJobs(ctx.db).updateOne(
    { _id: job._id, state: "uploading" },
    {
      $set: {
        state: "inspect_pending",
        nextAttemptAt: nowOf(ctx),
        attempts: 0,
      },
    },
  );
  return result.modifiedCount ? ok({ id }) : fail("invalid_state" as const);
}
export async function validateImport(
  ctx: ServiceContext,
  id: string,
  mapping: ImportMapping,
) {
  const job = await editable(ctx, id);
  if (!job) return fail("not_found" as const);
  if (!job.columns || !validateImportMapping(job.columns, mapping))
    return fail("invalid_mapping" as const);
  const result = await importJobs(ctx.db).updateOne(
    {
      _id: job._id,
      state: { $in: ["mapping", "ready"] },
      generation: job.generation,
    },
    {
      $set: {
        state: "validate_pending",
        mapping,
        validated: 0,
        valid: 0,
        invalid: 0,
        counts: {},
        attempts: 0,
        nextAttemptAt: nowOf(ctx),
      },
      $inc: { generation: 1 },
      $unset: { errorKey: "", error: "", quota: "" },
    },
  );
  return result.modifiedCount ? ok({ id }) : fail("invalid_state" as const);
}
export async function commitImport(ctx: ServiceContext, id: string) {
  const job = await editable(ctx, id);
  if (!job) return fail("not_found" as const);
  if (!job.valid) return fail("empty_import" as const);
  const result = await importJobs(ctx.db).updateOne(
    { _id: job._id, state: "ready", generation: job.generation },
    {
      $set: { state: "commit_pending", attempts: 0, nextAttemptAt: nowOf(ctx) },
      $unset: { error: "", quota: "" },
    },
  );
  return result.modifiedCount ? ok({ id }) : fail("invalid_state" as const);
}
export async function cancelImport(ctx: ServiceContext, id: string) {
  const job = await getImportJob(ctx, id);
  if (!job || !can(ctx.actor, "resource.delete", { createdBy: job.createdBy }))
    return false;
  return withMutation(ctx.db, async (session) => {
    await ctx.db
      .collection(physicalNames.workspaces)
      .updateOne(
        { _id: ctx.workspace._id },
        { $inc: { linkMutationRevision: 1 } },
        { session },
      );
    const changed = await importJobs(ctx.db).updateOne(
      {
        _id: job._id,
        state: { $nin: ["completed", "cancelled", "failed"] },
        $or: [{ state: { $ne: "committing" } }, { done: { $lt: job.valid } }],
      },
      {
        $set: { state: "cancelled" },
        $unset: { leaseToken: "", leaseUntil: "" },
      },
      { session },
    );
    if (changed.modifiedCount)
      await importReservations(ctx.db).updateOne(
        { _id: job._id, workspaceId: job.workspaceId, state: "active" },
        { $set: { state: "released", remaining: 0 } },
        { session },
      );
    return changed.modifiedCount === 1;
  });
}
/** Poll response intentionally excludes source keys, lease tokens and complete row data. */
export function importJobView(job: ImportJob) {
  return {
    id: job._id.toHexString(),
    kind: job.kind,
    state: job.state,
    total: job.total,
    inspected: job.inspected,
    validated: job.validated,
    done: job.done,
    valid: job.valid,
    invalid: job.invalid,
    counts: job.counts,
    expiresAt: job.expiresAt.toISOString(),
    ...(job.columns
      ? { columns: job.columns.map((column) => column.slice(0, 200)) }
      : {}),
    ...(job.preview ? { preview: job.preview } : {}),
    ...(job.mapping ? { mapping: job.mapping } : {}),
    ...(job.error ? { error: job.error } : {}),
    ...(job.quota ? { quota: job.quota } : {}),
  };
}
export async function importErrorDelivery(
  ctx: ServiceContext,
  id: string,
  sign: (key: string, seconds: number, filename: string) => Promise<string>,
) {
  const job = await getImportJob(ctx, id);
  if (!job) return null;
  const view = importJobView(job),
    seconds = Math.floor(
      (job.expiresAt.getTime() - nowOf(ctx).getTime()) / 1000,
    );
  if (
    !job.errorKey?.startsWith(
      `exports/jobs/imports/${job.workspaceId}/${job._id}/`,
    ) ||
    seconds < 1
  )
    return view;
  return {
    ...view,
    errorCsvUrl: await sign(
      job.errorKey,
      Math.min(86400, seconds),
      "import-errors.csv",
    ),
  };
}
