import { type Filter } from "mongodb";
import { can } from "../workspaces/authz";
import { nowOf, type ServiceContext } from "../workspaces/context";
import { fail, ok } from "../result";
import {
  createImportJob,
  getImportJob,
  importJobs,
  importJobView,
  importResults,
  inspectImport,
  type ImportJob,
  type ImportResult,
  type ImportState,
} from "./jobs";

export const importPageSize = 25;
const states: ImportState[] = [
  "uploading",
  "inspect_pending",
  "inspecting",
  "mapping",
  "validate_pending",
  "validating",
  "ready",
  "commit_pending",
  "committing",
  "completed",
  "failed",
  "cancelled",
];
const literal = (value: string) =>
  new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
const text = (value: unknown, length = 200) =>
  typeof value === "string" ? value.trim().slice(0, length) : "";
const pageNumber = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : 1;
const pageOf = (requested: unknown, total: number) =>
  Math.min(
    pageNumber(requested),
    Math.max(1, Math.ceil(total / importPageSize)),
  );

/** History is actor-scoped for members/viewers; admins can inspect workspace jobs. */
export async function listImportJobs(
  ctx: ServiceContext,
  options: { page?: number | undefined; kind?: unknown; state?: unknown } = {},
) {
  const filter: Filter<ImportJob> = {
    workspaceId: ctx.workspace._id,
    expiresAt: { $gt: nowOf(ctx) },
  };
  if (ctx.actor.role !== "owner" && ctx.actor.role !== "admin")
    filter.createdBy = ctx.actor.userId;
  if (options.kind === "links" || options.kind === "qr")
    filter.kind = options.kind;
  if (states.includes(options.state as ImportState))
    filter.state = options.state as ImportState;
  const total = await importJobs(ctx.db).countDocuments(filter),
    page = pageOf(options.page, total);
  const rows = await importJobs(ctx.db)
    .find(filter, {
      projection: {
        inputKey: 0,
        columns: 0,
        preview: 0,
        mapping: 0,
        sourceHash: 0,
        errorKey: 0,
        leaseToken: 0,
        leaseUntil: 0,
      },
    })
    .sort({ _id: -1 })
    .skip((page - 1) * importPageSize)
    .limit(importPageSize)
    .toArray();
  return {
    items: rows.map((job) => ({
      ...importJobView(job),
      createdAt: job.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize: importPageSize,
  };
}

export interface ImportResultOptions {
  page?: number | undefined;
  search?: unknown;
  tag?: unknown;
  status?: unknown;
  error?: unknown;
  group?: unknown;
}
function resultFilter(
  job: ImportJob,
  options: ImportResultOptions,
): Filter<ImportResult> {
  const filter: Filter<ImportResult> = {
    jobId: job._id,
    generation: job.generation,
  };
  const search = text(options.search),
    tag = text(options.tag, 64),
    error = text(options.error, 64);
  if (search) {
    const pattern = literal(search);
    filter.$or = [
      { "input.url": pattern },
      { "input.key": pattern },
      { "input.title": pattern },
      { destination: pattern },
    ];
  }
  if (tag) filter["input.tags"] = tag;
  if (options.status === "valid") filter.error = { $exists: false };
  else if (options.status === "invalid") filter.error = { $exists: true };
  if (error) filter.error = error;
  return filter;
}

/** Fetch a single bounded page, never source cells or a complete result generation. */
export async function listImportResults(
  ctx: ServiceContext,
  id: string,
  options: ImportResultOptions = {},
) {
  const job = await getImportJob(ctx, id);
  if (!job) return null;
  const filter = resultFilter(job, options);
  filter.expiresAt = { $gt: nowOf(ctx) };
  const total = await importResults(ctx.db).countDocuments(filter),
    page = pageOf(options.page, total);
  const rows = await importResults(ctx.db)
    .find(filter, {
      projection: {
        row: 1,
        position: 1,
        "input.url": 1,
        "input.title": 1,
        "input.key": 1,
        "input.tags": 1,
        destination: 1,
        error: 1,
      },
    })
    .sort(
      options.group === "error" ? { error: 1, position: 1 } : { position: 1 },
    )
    .skip((page - 1) * importPageSize)
    .limit(importPageSize)
    .toArray();
  return {
    items: rows.map((row) => ({
      row: row.row,
      position: row.position,
      url: (row.input?.url ?? row.destination ?? "").slice(0, 200),
      title: (row.input?.title ?? "").slice(0, 200),
      key: (row.input?.key ?? "").slice(0, 200),
      tags: row.input?.tags ?? [],
      ...(row.error ? { error: row.error } : {}),
    })),
    total,
    page,
    pageSize: importPageSize,
    generation: job.generation,
  };
}

/** Search tags on the server, bounded independently of the 50,000-row library. */
export async function searchImportTags(
  ctx: ServiceContext,
  id: string,
  search: unknown = "",
) {
  const job = await getImportJob(ctx, id);
  if (!job) return null;
  const query = text(search, 64);
  const rows = await importResults(ctx.db)
    .aggregate<{ _id: string; count: number }>([
      {
        $match: {
          jobId: job._id,
          generation: job.generation,
          expiresAt: { $gt: nowOf(ctx) },
        },
      },
      { $unwind: "$input.tags" },
      {
        $match: {
          "input.tags": {
            $type: "string",
            ...(query ? { $regex: literal(query) } : {}),
          },
        },
      },
      { $group: { _id: "$input.tags", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $limit: 51 },
    ])
    .toArray();
  return {
    items: rows.slice(0, 50).map((row) => ({ tag: row._id, count: row.count })),
    hasMore: rows.length > 50,
  };
}

export const importUploadHeaders = {
  "Content-Type": "text/csv; charset=utf-8",
  "Cache-Control": "private, no-store",
  "If-None-Match": "*",
} as const;
type UploadSigner = (
  key: string,
  bytes: number,
  seconds: number,
) => Promise<string>;
/** Accepts metadata only. Browser bytes go directly to the private object store. */
export async function prepareImportUpload(
  ctx: ServiceContext,
  sign: UploadSigner,
  bytes: number,
  kind: ImportJob["kind"],
) {
  const created = await createImportJob(ctx, bytes, kind);
  if (!created.ok) return created;
  const job = created.value;
  try {
    const uploadUrl = await sign(job.inputKey, bytes, 900);
    return ok({
      id: job._id.toHexString(),
      uploadUrl,
      headers: importUploadHeaders,
      uploadExpiresAt: new Date(nowOf(ctx).getTime() + 900_000).toISOString(),
    });
  } catch {
    await importJobs(ctx.db).deleteOne({
      _id: job._id,
      workspaceId: ctx.workspace._id,
      createdBy: ctx.actor.userId,
      state: "uploading",
    });
    return fail("storage_unavailable" as const);
  }
}

/** A lost completion response can be retried without enqueueing a second job. */
export async function completeImportUpload(ctx: ServiceContext, id: string) {
  const job = await getImportJob(ctx, id);
  if (
    !job ||
    job.createdBy !== ctx.actor.userId ||
    !can(ctx.actor, "resource.create")
  )
    return fail("not_found" as const);
  if (job.state !== "uploading") return ok({ id });
  const result = await inspectImport(ctx, id);
  if (result.ok) return result;
  const current = await getImportJob(ctx, id);
  return current && current.state !== "uploading" ? ok({ id }) : result;
}
