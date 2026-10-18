import { createHash, randomUUID } from "node:crypto";
import { collection, physicalNames } from "@shortn/db";
import { ObjectId, type Db, type Filter } from "mongodb";
import { nowOf, type ServiceContext } from "../workspaces/context";
import { fail, ok } from "../result";
import { LinkExportError } from "./links";

export const WORKSPACE_EXPORT_MAX_BYTES = 1024 * 1024 * 1024;

export async function authorizeWorkspaceExport(ctx: ServiceContext) {
  const [workspace, member] = await Promise.all([
    collection(ctx.db, "workspaces").findOne({ _id: ctx.workspace._id }),
    collection(ctx.db, "workspace_members").findOne({
      workspaceId: ctx.workspace._id,
      userId: ctx.actor.userId,
    }),
  ]);
  if (
    !workspace ||
    workspace.ownerUserId !== ctx.actor.userId ||
    member?.role !== "owner"
  )
    throw new LinkExportError("forbidden");
  return workspace;
}
export interface WorkspaceExportJob {
  _id: ObjectId;
  requestKey: string;
  workspaceId: ObjectId;
  createdBy: string;
  kind: "workspace";
  format: "zip";
  state: "pending" | "running" | "completed" | "failed" | "cancelled";
  done: number;
  phase: string;
  attempts: number;
  createdAt: Date;
  expiresAt: Date;
  nextAttemptAt: Date;
  leaseToken?: string;
  leaseUntil?: Date;
  objectKey?: string;
  bytes?: number;
  error?: string;
  emailState: "pending" | "sent" | "failed";
  mailAttempts: number;
  mailNextAt: Date;
  mailLease?: string;
  mailLeaseUntil?: Date;
  mailSentAt?: Date;
}
export const workspaceExportJobs = (db: Db) =>
  db.collection<WorkspaceExportJob>(physicalNames.export_jobs);
export const workspaceExportView = (job: WorkspaceExportJob) => ({
  id: job._id.toHexString(),
  kind: job.kind,
  format: job.format,
  state: job.state,
  done: job.done,
  phase: job.phase,
  emailState: job.emailState,
  createdAt: job.createdAt.toISOString(),
  expiresAt: job.expiresAt.toISOString(),
  ...(job.error ? { error: job.error } : {}),
});
export async function prepareWorkspaceExport(
  ctx: ServiceContext,
  requestId: string = randomUUID(),
) {
  if (
    !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(
      requestId,
    )
  )
    return fail("invalid_export" as const);
  await authorizeWorkspaceExport(ctx);
  const now = nowOf(ctx);
  const requestKey = createHash("sha256")
    .update(`workspace:${ctx.workspace._id}:${ctx.actor.userId}:${requestId}`)
    .digest("hex");
  const previous = await workspaceExportJobs(ctx.db).findOne({
    requestKey,
    kind: "workspace",
  });
  if (previous)
    return previous.expiresAt <= now
      ? fail("expired" as const)
      : ok(workspaceExportView(previous));
  await workspaceExportJobs(ctx.db).updateMany(
    {
      workspaceId: ctx.workspace._id,
      kind: "workspace",
      state: { $in: ["pending", "running"] },
      expiresAt: { $lte: now },
    },
    {
      $set: { state: "failed", error: "expired" },
      $unset: { leaseToken: "", leaseUntil: "" },
    },
  );
  if (
    await workspaceExportJobs(ctx.db).findOne({
      workspaceId: ctx.workspace._id,
      kind: "workspace",
      state: { $in: ["pending", "running"] },
      expiresAt: { $gt: now },
    })
  )
    return fail("export_in_progress" as const);
  const job: WorkspaceExportJob = {
    _id: new ObjectId(),
    requestKey,
    workspaceId: ctx.workspace._id,
    createdBy: ctx.actor.userId,
    kind: "workspace",
    format: "zip",
    state: "pending",
    done: 0,
    phase: "workspace",
    attempts: 0,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 86400_000),
    nextAttemptAt: now,
    emailState: "pending",
    mailAttempts: 0,
    mailNextAt: now,
  };
  try {
    await workspaceExportJobs(ctx.db).insertOne(job);
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const raced = await workspaceExportJobs(ctx.db).findOne({
      requestKey,
      kind: "workspace",
    });
    if (raced) return ok(workspaceExportView(raced));
    return fail("export_in_progress" as const);
  }
  return ok(workspaceExportView(job));
}
export async function getWorkspaceExport(ctx: ServiceContext, id: string) {
  if (!/^[a-f\d]{24}$/i.test(id)) return null;
  await authorizeWorkspaceExport(ctx);
  return workspaceExportJobs(ctx.db).findOne({
    _id: new ObjectId(id),
    kind: "workspace",
    workspaceId: ctx.workspace._id,
    expiresAt: { $gt: nowOf(ctx) },
  });
}
export async function cancelWorkspaceExport(ctx: ServiceContext, id: string) {
  const job = await getWorkspaceExport(ctx, id);
  if (!job) return false;
  return (
    (
      await workspaceExportJobs(ctx.db).updateOne(
        {
          _id: job._id,
          kind: "workspace",
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
export async function workspaceExportDelivery(
  ctx: ServiceContext,
  id: string,
  sign: (key: string, seconds: number, filename: string) => Promise<string>,
) {
  const job = await getWorkspaceExport(ctx, id);
  if (!job) return null;
  const view = workspaceExportView(job),
    prefix = `exports/jobs/workspace/${job.workspaceId}/${job._id}/`;
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
      "workspace.zip",
    ),
  };
}
export async function listWorkspaceExports(
  ctx: ServiceContext,
  input: { page?: number; state?: string } = {},
) {
  await authorizeWorkspaceExport(ctx);
  const filter: Filter<WorkspaceExportJob> = {
    kind: "workspace",
    workspaceId: ctx.workspace._id,
    expiresAt: { $gt: nowOf(ctx) },
  };
  if (
    ["pending", "running", "completed", "failed", "cancelled"].includes(
      input.state ?? "",
    )
  )
    filter.state = input.state as WorkspaceExportJob["state"];
  const total = await workspaceExportJobs(ctx.db).countDocuments(filter),
    pages = Math.max(1, Math.ceil(total / 25));
  const page =
    Number.isSafeInteger(input.page) && input.page! > 0
      ? Math.min(input.page!, pages)
      : 1;
  const rows = await workspaceExportJobs(ctx.db)
    .find(filter, {
      projection: { objectKey: 0, leaseToken: 0, mailLease: 0, requestKey: 0 },
    })
    .sort({ _id: -1 })
    .skip((page - 1) * 25)
    .limit(25)
    .toArray();
  return { items: rows.map(workspaceExportView), total, page, pages };
}
