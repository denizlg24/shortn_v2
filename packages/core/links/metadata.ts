import { createHash } from "node:crypto";
import { ObjectId, type Db } from "mongodb";
import type { Redis } from "ioredis";
import { collection } from "@shortn/db";
import { can } from "../workspaces/authz";
import type { ServiceContext } from "../workspaces/context";
import { validateDestination } from "../safety/structural";
import { suggestAvailableLinkKey } from "./service";
import { fail, ok } from "../result";

export const linkMetadataLifetimeMs = 15 * 60_000;
export interface LinkMetadataJob {
  _id: ObjectId;
  workspaceId: ObjectId;
  actorUserId: string;
  url: string;
  state: "pending" | "running" | "ready" | "unavailable";
  createdAt: Date;
  expiresAt: Date;
  leaseUntil?: Date;
  leaseToken?: string;
  title?: string;
}
export const linkMetadataJobs = (db: Db) =>
  db.collection<LinkMetadataJob>("link_metadata_jobs");
export async function ensureLinkMetadataIndexes(db: Db) {
  await linkMetadataJobs(db).createIndexes([
    { key: { expiresAt: 1 }, expireAfterSeconds: 0, name: "metadata_expiry" },
    { key: { state: 1, createdAt: 1 }, name: "metadata_pending" },
  ]);
}
export async function metadataActorAllowed(
  db: Db,
  workspaceId: ObjectId,
  actorUserId: string,
) {
  const [workspace, member] = await Promise.all([
    collection(db, "workspaces").findOne(
      { _id: workspaceId },
      { projection: { _id: 1 } },
    ),
    collection(db, "workspace_members").findOne({
      workspaceId,
      userId: actorUserId,
    }),
  ]);
  return Boolean(
    workspace &&
    member &&
    can({ userId: member.userId, role: member.role }, "resource.create"),
  );
}
export async function requestLinkMetadata(
  ctx: ServiceContext,
  durable: Pick<Redis, "eval">,
  input: unknown,
  now = new Date(),
) {
  if (
    !can(ctx.actor, "resource.create") ||
    !(await metadataActorAllowed(ctx.db, ctx.workspace._id, ctx.actor.userId))
  )
    return fail("forbidden" as const);
  if (
    typeof input !== "string" ||
    input.length > 2048 ||
    !validateDestination(input.trim()).ok
  )
    return fail("invalid_url" as const);
  const url = new URL(input.trim());
  if (url.username || url.password) return fail("invalid_url" as const);
  url.hash = "";
  const id = new ObjectId(
    createHash("sha256")
      .update(
        JSON.stringify([
          String(ctx.workspace._id),
          ctx.actor.userId,
          url.href,
          Math.floor(now.getTime() / linkMetadataLifetimeMs),
        ]),
      )
      .digest("hex")
      .slice(0, 24),
  );
  const existing = await linkMetadataJobs(ctx.db).findOne({
    _id: id,
    expiresAt: { $gt: now },
  });
  if (existing && existing.state !== "unavailable")
    return ok({ id: String(id) });
  const rateKey = `links:metadata-rate:${ctx.workspace._id}:${ctx.actor.userId}`;
  let count: number;
  try {
    count = Number(
      await durable.eval(
        "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
        1,
        rateKey,
      ),
    );
  } catch {
    return fail("unavailable" as const);
  }
  if (!Number.isFinite(count) || count > 10)
    return fail("rate_limited" as const);
  if (existing) {
    await linkMetadataJobs(ctx.db).updateOne(
      { _id: id, state: "unavailable", expiresAt: { $gt: now } },
      {
        $set: { state: "pending" },
        $unset: { title: "", leaseUntil: "", leaseToken: "" },
      },
    );
    return ok({ id: String(id) });
  }
  try {
    await linkMetadataJobs(ctx.db).insertOne({
      _id: id,
      workspaceId: ctx.workspace._id,
      actorUserId: ctx.actor.userId,
      url: url.href,
      state: "pending",
      createdAt: now,
      expiresAt: new Date(now.getTime() + linkMetadataLifetimeMs),
    });
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === 11000))
      throw error;
  }
  return ok({ id: String(id) });
}
export async function readLinkMetadata(
  ctx: ServiceContext,
  id: unknown,
  now = new Date(),
) {
  if (
    !can(ctx.actor, "resource.create") ||
    !(await metadataActorAllowed(ctx.db, ctx.workspace._id, ctx.actor.userId))
  )
    return fail("forbidden" as const);
  if (typeof id !== "string" || !/^[a-f\d]{24}$/.test(id))
    return fail("not_found" as const);
  const job = await linkMetadataJobs(ctx.db).findOne({
    _id: new ObjectId(id),
    workspaceId: ctx.workspace._id,
    actorUserId: ctx.actor.userId,
    expiresAt: { $gt: now },
  });
  if (!job) return fail("not_found" as const);
  if (job.state === "pending" || job.state === "running")
    return ok({ state: "pending" as const });
  return ok({
    state: job.state,
    title: job.title ?? null,
    key: await suggestAvailableLinkKey(ctx, job.url, job.title),
  });
}
