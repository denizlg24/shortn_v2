import { randomUUID } from "node:crypto";
import { ObjectId, type Db } from "mongodb";
import type Redis from "ioredis";
import { collection, physicalNames } from "@shortn/db";
import { isLocale, type Mailer } from "@shortn/emails";
import {
  authorizeWorkspaceExport,
  workspaceExportJobs,
  LinkExportError,
  type ServiceContext,
} from "@shortn/core";

export interface WorkspaceExportNoticeDependencies {
  db: Db;
  cache: Redis;
  linkDomain: string;
  appUrl: string;
  mailer?: Pick<Mailer, "workspaceExportReady">;
}
/** Separate leased outbox: mail failures never regenerate a completed archive. */
export async function sendWorkspaceExportNotice(
  deps: WorkspaceExportNoticeDependencies,
  id: string,
  now = new Date(),
) {
  if (!/^[a-f\d]{24}$/i.test(id)) return false;
  const jobs = workspaceExportJobs(deps.db),
    lease = randomUUID();
  const job = await jobs.findOneAndUpdate(
    {
      _id: new ObjectId(id),
      kind: "workspace",
      state: "completed",
      emailState: "pending",
      expiresAt: { $gt: now },
      mailNextAt: { $lte: now },
      $or: [
        { mailLeaseUntil: { $exists: false } },
        { mailLeaseUntil: { $lte: now } },
      ],
    },
    {
      $set: {
        mailLease: lease,
        mailLeaseUntil: new Date(now.getTime() + 60000),
      },
      $inc: { mailAttempts: 1 },
    },
    { returnDocument: "after" },
  );
  if (!job) return false;
  try {
    const workspace = await collection(deps.db, "workspaces").findOne({
      _id: job.workspaceId,
    });
    if (
      !workspace ||
      !job.objectKey?.startsWith(
        `exports/jobs/workspace/${job.workspaceId}/${job._id}/`,
      )
    )
      throw new LinkExportError("forbidden");
    const ctx: ServiceContext = {
      db: deps.db,
      cache: deps.cache,
      linkDomain: deps.linkDomain,
      workspace,
      actor: { userId: job.createdBy, role: "owner" },
    };
    await authorizeWorkspaceExport(ctx);
    const user = ObjectId.isValid(job.createdBy)
      ? await deps.db
          .collection(physicalNames.user)
          .findOne({ _id: new ObjectId(job.createdBy) })
      : null;
    if (
      !user?.emailVerified ||
      typeof user.email !== "string" ||
      user.deletedAt ||
      user.banned
    )
      throw new Error("recipient_unavailable");
    if (!deps.mailer) throw new Error("mail_unavailable");
    const origin = new URL(deps.appUrl);
    if (!["http:", "https:"].includes(origin.protocol))
      throw new Error("invalid_app_url");
    await authorizeWorkspaceExport(ctx);
    const active = await jobs.findOne({
      _id: job._id,
      mailLease: lease,
      mailLeaseUntil: { $gt: new Date() },
      expiresAt: { $gt: new Date() },
      state: "completed",
    });
    if (!active) return true;
    await deps.mailer.workspaceExportReady({
      to: user.email,
      locale: isLocale(user.locale) ? user.locale : "en",
      workspace: workspace.name,
      url: `${origin.origin}/${encodeURIComponent(workspace.slug)}/settings/workspace/exports/${job._id}`,
      idempotencyKey: `workspace-export-ready-${job._id}`,
    });
    await jobs.updateOne(
      { _id: job._id, mailLease: lease },
      {
        $set: { emailState: "sent", mailSentAt: new Date() },
        $unset: { mailLease: "", mailLeaseUntil: "" },
      },
    );
  } catch (error) {
    await jobs.updateOne(
      { _id: job._id, mailLease: lease },
      {
        $set: {
          emailState: error instanceof LinkExportError ? "failed" : "pending",
          mailNextAt: new Date(
            Date.now() +
              Math.min(300000, 5000 * 2 ** Math.min(job.mailAttempts - 1, 10)),
          ),
        },
        $unset: { mailLease: "", mailLeaseUntil: "" },
      },
    );
  }
  return true;
}
