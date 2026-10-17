import { createHash, randomUUID } from "node:crypto";
import { ObjectId, type Db } from "mongodb";
import { collection, physicalNames } from "@shortn/db";
import type { ServiceContext } from "../workspaces/context";
import { nowOf } from "../workspaces/context";
import { ok, fail } from "../result";
import {
  authorizeLinkExport,
  countFilteredLinkExport,
  linkExportFilterSchema,
  type LinkExportFilter,
} from "./links";
import type { LinkExportFormat } from "./link-format";
import { linkListFilter } from "../links/service";

export interface LinkExportJob {
  _id: ObjectId;
  requestKey: string;
  signature: string;
  workspaceId: ObjectId;
  createdBy: string;
  kind: "links";
  format: LinkExportFormat;
  filter: LinkExportFilter;
  total: number;
  done: number;
  state: "pending" | "running" | "completed" | "failed" | "cancelled";
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
export const linkExportJobs = (db: Db) =>
  db.collection<LinkExportJob>(physicalNames.export_jobs);
export const linkExportView = (job: LinkExportJob) => ({
  id: job._id.toHexString(),
  kind: job.kind,
  format: job.format,
  state: job.state,
  total: job.total,
  done: job.done,
  createdAt: job.createdAt.toISOString(),
  expiresAt: job.expiresAt.toISOString(),
  ...(job.error ? { error: job.error } : {}),
});

/** The threshold is strictly below 5k for direct streaming; larger views are durable jobs. */
export async function prepareLinkExport(
  ctx: ServiceContext,
  input: unknown,
  format: LinkExportFormat,
  requestId: string = randomUUID(),
) {
  const parsed = linkExportFilterSchema.safeParse(input);
  if (
    !parsed.success ||
    !["csv", "json"].includes(format) ||
    !/^[a-f\d-]{36}$/i.test(requestId)
  )
    return fail("invalid_export" as const);
  await authorizeLinkExport(ctx, Boolean(parsed.data.campaign));
  const filter = {
    ...parsed.data,
    ...(parsed.data.tags
      ? { tags: [...new Set(parsed.data.tags)].sort() }
      : {}),
  };
  for (const key of Object.keys(filter) as (keyof LinkExportFilter)[])
    if (filter[key] === undefined) delete filter[key];
  const signature = createHash("sha256")
    .update(
      JSON.stringify({
        format,
        filter: Object.fromEntries(
          Object.entries(filter).sort(([a], [b]) => a.localeCompare(b)),
        ),
      }),
    )
    .digest("hex");
  const requestKey = createHash("sha256")
    .update(`${ctx.workspace._id}:${ctx.actor.userId}:${requestId}`)
    .digest("hex");
  const existing = await linkExportJobs(ctx.db).findOne({ requestKey });
  if (existing) {
    if (existing.signature !== signature)
      return fail("idempotency_conflict" as const);
    if (existing.expiresAt <= nowOf(ctx)) return fail("expired" as const);
    return ok({ mode: "job" as const, job: linkExportView(existing) });
  }
  let total = await countFilteredLinkExport(ctx, filter);
  if (total < 5000) {
    // Keep these IDs on the server. Freeze a bounded selection so concurrent
    // inserts/filter changes cannot grow an instant response beyond 4,999 rows.
    const scope = await linkListFilter(ctx, filter);
    const ids = await collection(ctx.db, "links")
      .find(scope, { projection: { _id: 1 } })
      .sort({ _id: 1 })
      .limit(5000)
      .toArray();
    if (ids.length < 5000)
      return ok({
        mode: "stream" as const,
        format,
        filter,
        total: ids.length,
        selection: ids.map((row) => row._id.toHexString()),
      });
    total = await countFilteredLinkExport(ctx, filter);
  }
  const now = nowOf(ctx),
    job: LinkExportJob = {
      _id: new ObjectId(),
      requestKey,
      signature,
      workspaceId: ctx.workspace._id,
      createdBy: ctx.actor.userId,
      kind: "links",
      format,
      filter,
      total,
      done: 0,
      state: "pending",
      attempts: 0,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 86400_000),
      nextAttemptAt: now,
    };
  try {
    await linkExportJobs(ctx.db).insertOne(job);
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const concurrent = await linkExportJobs(ctx.db).findOne({ requestKey });
    return concurrent?.signature === signature
      ? ok({ mode: "job" as const, job: linkExportView(concurrent) })
      : fail("idempotency_conflict" as const);
  }
  return ok({ mode: "job" as const, job: linkExportView(job) });
}
export async function getLinkExport(ctx: ServiceContext, id: string) {
  if (!/^[a-f\d]{24}$/i.test(id)) return null;
  const job = await linkExportJobs(ctx.db).findOne({
    _id: new ObjectId(id),
    kind: "links",
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
  await authorizeLinkExport(ctx, Boolean(job.filter.campaign));
  return job;
}
export async function listLinkExports(
  ctx: ServiceContext,
  input: { page?: number; state?: string; format?: string } = {},
) {
  await authorizeLinkExport(ctx);
  const member = await collection(ctx.db, "workspace_members").findOne({
    workspaceId: ctx.workspace._id,
    userId: ctx.actor.userId,
  });
  if (!member) return null;
  const filter: import("mongodb").Filter<LinkExportJob> = {
    workspaceId: ctx.workspace._id,
    kind: "links",
    expiresAt: { $gt: nowOf(ctx) },
  };
  if (!["owner", "admin"].includes(member.role))
    filter.createdBy = ctx.actor.userId;
  if (
    ["pending", "running", "completed", "failed", "cancelled"].includes(
      input.state ?? "",
    )
  )
    filter.state = input.state as LinkExportJob["state"];
  if (input.format === "csv" || input.format === "json")
    filter.format = input.format;
  const total = await linkExportJobs(ctx.db).countDocuments(filter),
    pages = Math.max(1, Math.ceil(total / 25));
  const page =
    Number.isSafeInteger(input.page) && input.page! > 0
      ? Math.min(input.page!, pages)
      : 1;
  const rows = await linkExportJobs(ctx.db)
    .find(filter, {
      projection: {
        filter: 0,
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
  return { items: rows.map(linkExportView), total, page, pages };
}
export async function cancelLinkExport(ctx: ServiceContext, id: string) {
  const job = await getLinkExport(ctx, id);
  if (!job) return false;
  const result = await linkExportJobs(ctx.db).updateOne(
    { _id: job._id, state: { $in: ["pending", "running"] } },
    {
      $set: { state: "cancelled" },
      $unset: { leaseToken: "", leaseUntil: "" },
    },
  );
  return result.modifiedCount === 1;
}
export async function linkExportDelivery(
  ctx: ServiceContext,
  id: string,
  sign: (key: string, seconds: number, filename: string) => Promise<string>,
) {
  const job = await getLinkExport(ctx, id);
  if (!job) return null;
  const view = linkExportView(job),
    prefix = `exports/jobs/links/${job.workspaceId}/${job._id}/`;
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
      `links.${job.format}`,
    ),
  };
}
