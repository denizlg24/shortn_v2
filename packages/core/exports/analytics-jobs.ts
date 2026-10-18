import { createHash, randomUUID } from "node:crypto";
import { collection, physicalNames } from "@shortn/db";
import { ObjectId, type Db, type Filter } from "mongodb";
import { nowOf, type ServiceContext } from "../workspaces/context";
import { fail, ok } from "../result";
import { authorizeLinkExport, LinkExportError } from "./links";
import {
  analyticsExportInput,
  resolveAnalyticsExport,
  type AnalyticsExportInput,
} from "./analytics";

export interface AnalyticsExportJob {
  _id: ObjectId;
  requestKey: string;
  signature: string;
  workspaceId: ObjectId;
  createdBy: string;
  kind: "analytics";
  query: AnalyticsExportInput;
  range: { from: string; to: string };
  format: "csv" | "ndjson";
  state: "pending" | "running" | "completed" | "failed" | "cancelled";
  done: number;
  attempts: number;
  createdAt: Date;
  expiresAt: Date;
  nextAttemptAt: Date;
  leaseToken?: string;
  leaseUntil?: Date;
  objectKey?: string;
  bytes?: number;
  error?: string;
}
export const analyticsExportJobs = (db: Db) =>
  db.collection<AnalyticsExportJob>(physicalNames.export_jobs);
export const analyticsExportView = (job: AnalyticsExportJob) => ({
  id: job._id.toHexString(),
  kind: job.kind,
  mode: job.query.mode,
  timezone: job.query.timezone,
  format: job.format,
  state: job.state,
  done: job.done,
  range: job.range,
  createdAt: job.createdAt.toISOString(),
  expiresAt: job.expiresAt.toISOString(),
  ...(job.error ? { error: job.error } : {}),
});
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
export async function prepareAnalyticsExport(
  ctx: ServiceContext,
  input: unknown,
  requestId: string = randomUUID(),
) {
  const parsed = analyticsExportInput.safeParse(input);
  if (
    !parsed.success ||
    !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(
      requestId,
    )
  )
    return fail("invalid_export" as const);
  const now = nowOf(ctx),
    query = {
      ...parsed.data,
      dimensions: [...new Set(parsed.data.dimensions)].sort(),
    };
  const resolved = await resolveAnalyticsExport(ctx, query, now);
  const signature = createHash("sha256")
    .update(JSON.stringify(canonical(query)))
    .digest("hex");
  const requestKey = createHash("sha256")
    .update(`analytics:${ctx.workspace._id}:${ctx.actor.userId}:${requestId}`)
    .digest("hex");
  const prior = await analyticsExportJobs(ctx.db).findOne({
    requestKey,
    kind: "analytics",
  });
  if (prior) {
    if (prior.signature !== signature)
      return fail("idempotency_conflict" as const);
    if (prior.expiresAt <= now) return fail("expired" as const);
    return ok(analyticsExportView(prior));
  }
  const job: AnalyticsExportJob = {
    _id: new ObjectId(),
    requestKey,
    signature,
    workspaceId: ctx.workspace._id,
    createdBy: ctx.actor.userId,
    kind: "analytics",
    query,
    range: {
      from: resolved.range.from.toISOString(),
      to: resolved.range.to.toISOString(),
    },
    format: query.format,
    state: "pending",
    done: 0,
    attempts: 0,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 86400_000),
    nextAttemptAt: now,
  };
  try {
    await analyticsExportJobs(ctx.db).insertOne(job);
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const concurrent = await analyticsExportJobs(ctx.db).findOne({
      requestKey,
      kind: "analytics",
    });
    return concurrent?.signature === signature
      ? ok(analyticsExportView(concurrent))
      : fail("idempotency_conflict" as const);
  }
  return ok(analyticsExportView(job));
}
export async function getAnalyticsExport(ctx: ServiceContext, id: string) {
  if (!/^[a-f\d]{24}$/i.test(id)) return null;
  const job = await analyticsExportJobs(ctx.db).findOne({
    _id: new ObjectId(id),
    kind: "analytics",
    workspaceId: ctx.workspace._id,
    expiresAt: { $gt: nowOf(ctx) },
  });
  if (!job) return null;
  const member = await collection(ctx.db, "workspace_members").findOne({
    workspaceId: ctx.workspace._id,
    userId: ctx.actor.userId,
  });
  if (
    !member ||
    (job.createdBy !== ctx.actor.userId &&
      !["owner", "admin"].includes(member.role))
  )
    return null;
  const current = await resolveAnalyticsExport(ctx, job.query, job.createdAt);
  if (current.range.from > new Date(job.range.from))
    throw new LinkExportError("feature_required");
  return job;
}
export async function cancelAnalyticsExport(ctx: ServiceContext, id: string) {
  const job = await getAnalyticsExport(ctx, id);
  if (!job) return false;
  return (
    (
      await analyticsExportJobs(ctx.db).updateOne(
        {
          _id: job._id,
          kind: "analytics",
          state: { $in: ["pending", "running"] },
        },
        {
          $set: { state: "cancelled" },
          $unset: { leaseToken: "", leaseUntil: "" },
        },
      )
    ).modifiedCount === 1
  );
}
export async function analyticsExportDelivery(
  ctx: ServiceContext,
  id: string,
  sign: (key: string, seconds: number, filename: string) => Promise<string>,
) {
  const job = await getAnalyticsExport(ctx, id);
  if (!job) return null;
  const view = analyticsExportView(job),
    prefix = `exports/jobs/analytics/${job.workspaceId}/${job._id}/`;
  if (job.state !== "completed" || !job.objectKey?.startsWith(prefix))
    return view;
  const seconds = Math.floor(
    (job.expiresAt.getTime() - nowOf(ctx).getTime()) / 1000,
  );
  if (seconds < 1) return null;
  return {
    ...view,
    downloadUrl: await sign(
      job.objectKey,
      Math.min(86400, seconds),
      `analytics-${job.query.mode}.${job.format}`,
    ),
  };
}
export async function listAnalyticsExports(
  ctx: ServiceContext,
  input: { page?: number; state?: string; format?: string; mode?: string } = {},
) {
  await authorizeLinkExport(ctx);
  const member = await collection(ctx.db, "workspace_members").findOne({
    workspaceId: ctx.workspace._id,
    userId: ctx.actor.userId,
  });
  if (!member) return null;
  const filter: Filter<AnalyticsExportJob> = {
    kind: "analytics",
    workspaceId: ctx.workspace._id,
    expiresAt: { $gt: nowOf(ctx) },
  };
  if (!["owner", "admin"].includes(member.role))
    filter.createdBy = ctx.actor.userId;
  if (
    ["pending", "running", "completed", "failed", "cancelled"].includes(
      input.state ?? "",
    )
  )
    filter.state = input.state as AnalyticsExportJob["state"];
  if (input.format === "csv" || input.format === "ndjson")
    filter.format = input.format;
  if (input.mode === "raw" || input.mode === "aggregate")
    filter["query.mode"] = input.mode;
  const total = await analyticsExportJobs(ctx.db).countDocuments(filter),
    pages = Math.max(1, Math.ceil(total / 25));
  const page =
    Number.isSafeInteger(input.page) && input.page! > 0
      ? Math.min(input.page!, pages)
      : 1;
  const rows = await analyticsExportJobs(ctx.db)
    .find(filter, {
      projection: {
        "query.filters": 0,
        "query.scope": 0,
        objectKey: 0,
        leaseToken: 0,
        signature: 0,
        requestKey: 0,
      },
    })
    .sort({ _id: -1 })
    .skip((page - 1) * 25)
    .limit(25)
    .toArray();
  return { items: rows.map(analyticsExportView), total, page, pages };
}
