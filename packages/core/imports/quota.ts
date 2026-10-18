import { collection, physicalNames } from "@shortn/db";
import { loadEntitlements, type Period } from "@shortn/billing";
import { ObjectId, type ClientSession, type Db } from "mongodb";
import { createHash } from "node:crypto";
import { can } from "../workspaces/authz";
import { nowOf, type ServiceContext } from "../workspaces/context";
import { countUsage } from "../usage/service";
import { withQuotaMutation } from "../usage/quota-lock";
import { fail, ok } from "../result";

export interface ImportReservation {
  _id: ObjectId;
  workspaceId: ObjectId;
  createdBy: string;
  metric: "links" | "qrCodes";
  total: number;
  remaining: number;
  consumed: number;
  state: "active" | "spent" | "released";
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
  expiresAt: Date;
  purgeAt: Date;
}
export interface ImportBatch {
  id: string;
  offset: number;
  leaseToken?: string;
}
export interface ImportReceipt<T = unknown> {
  _id: ObjectId;
  reservationId: ObjectId;
  workspaceId: ObjectId;
  createdBy: string;
  offset: number;
  count: number;
  hash: string;
  values: T[];
  purgeAt: Date;
}
export const importReservations = (db: Db) =>
  db.collection<ImportReservation>(physicalNames.import_reservations);
export const importReceipts = <T = unknown>(db: Db) =>
  db.collection<ImportReceipt<T>>(physicalNames.import_receipts);
export const importBatchHash = (inputs: readonly unknown[]) =>
  createHash("sha256").update(JSON.stringify(inputs)).digest("hex");
export const validImportBatch = (batch: ImportBatch) =>
  /^[a-f\d]{24}$/i.test(batch.id) &&
  Number.isInteger(batch.offset) &&
  batch.offset >= 0 &&
  batch.offset < 50_000;

/** Call under the workspace mutation lock for a quota decision. Counts remain document-derived. */
export async function reservedImportUsage(
  db: Db,
  workspaceId: ObjectId,
  period: Period,
  now: Date,
  session?: ClientSession,
) {
  const rows = await importReservations(db)
    .aggregate<{ _id: "links" | "qrCodes"; count: number }>(
      [
        {
          $match: {
            workspaceId,
            state: "active",
            expiresAt: { $gt: now },
            periodStart: period.start,
            periodEnd: period.end,
          },
        },
        { $group: { _id: "$metric", count: { $sum: "$remaining" } } },
      ],
      { ...(session ? { session } : {}) },
    )
    .toArray();
  return {
    links: rows.find((row) => row._id === "links")?.count ?? 0,
    qrCodes: rows.find((row) => row._id === "qrCodes")?.count ?? 0,
  };
}

/** The import ID is stable across retries; a reservation may never be resized or rebound. */
export async function reserveImportQuota(
  ctx: ServiceContext,
  id: string,
  metric: "links" | "qrCodes",
  amount: number,
) {
  if (!can(ctx.actor, "resource.create")) return fail("forbidden" as const);
  if (
    !/^[a-f\d]{24}$/i.test(id) ||
    !["links", "qrCodes"].includes(metric) ||
    !Number.isInteger(amount) ||
    amount < 1 ||
    amount > 50_000
  )
    return fail("invalid_input" as const);
  const entitlements = await loadEntitlements(ctx.db, ctx.workspace._id),
    now = nowOf(ctx);
  return withQuotaMutation(ctx, async (session) => {
    const prior = await importReservations(ctx.db).findOne(
      { _id: new ObjectId(id) },
      { session },
    );
    if (prior) {
      if (
        !prior.workspaceId.equals(ctx.workspace._id) ||
        prior.createdBy !== ctx.actor.userId
      )
        return fail("not_found" as const);
      if (prior.metric !== metric || prior.total !== amount)
        return fail("invalid_input" as const);
      if (prior.state !== "active" || prior.expiresAt <= now)
        return fail("reservation_closed" as const);
      await collection(ctx.db, "workspaces").updateOne(
        { _id: ctx.workspace._id },
        { $set: { importQuotaCoordinated: true } },
        { session },
      );
      return ok(prior);
    }
    const usage = await countUsage(
      ctx.db,
      ctx.workspace,
      entitlements.period,
      session,
    );
    const held = await reservedImportUsage(
      ctx.db,
      ctx.workspace._id,
      entitlements.period,
      now,
      session,
    );
    const limit = entitlements.limits[metric];
    if (limit !== null && usage[metric] + held[metric] + amount > limit)
      return fail("limit_reached" as const, {
        limit,
        used: usage[metric],
        reserved: held[metric],
        requested: amount,
        available: Math.max(0, limit - usage[metric] - held[metric]),
      });
    const expiresAt = new Date(
      Math.min(now.getTime() + 86400_000, entitlements.period.end.getTime()),
    );
    const reservation: ImportReservation = {
      _id: new ObjectId(id),
      workspaceId: ctx.workspace._id,
      createdBy: ctx.actor.userId,
      metric,
      total: amount,
      remaining: amount,
      consumed: 0,
      state: "active",
      periodStart: entitlements.period.start,
      periodEnd: entitlements.period.end,
      createdAt: now,
      expiresAt,
      purgeAt: new Date(expiresAt.getTime() + 30 * 86400_000),
    };
    await importReservations(ctx.db).insertOne(reservation, { session });
    await collection(ctx.db, "workspaces").updateOne(
      { _id: ctx.workspace._id },
      { $set: { importQuotaCoordinated: true } },
      { session },
    );
    return ok(reservation);
  });
}

/** Writer-only: must share the transaction that creates rows and advances the checkpoint. */
export async function heldImportBatch(
  ctx: ServiceContext,
  batch: ImportBatch,
  metric: "links" | "qrCodes",
  count: number,
  session: ClientSession,
) {
  if (!validImportBatch(batch) || count < 1 || count > 500) return null;
  if (batch.leaseToken) {
    const fence = await ctx.db
      .collection(physicalNames.import_jobs)
      .updateOne(
        {
          _id: new ObjectId(batch.id),
          workspaceId: ctx.workspace._id,
          createdBy: ctx.actor.userId,
          kind: metric === "qrCodes" ? "qr" : "links",
          state: "committing",
          leaseToken: batch.leaseToken,
          leaseUntil: { $gt: nowOf(ctx) },
          expiresAt: { $gt: nowOf(ctx) },
        },
        { $inc: { mutationRevision: 1 } },
        { session },
      );
    if (fence.matchedCount !== 1) return null;
  }
  return importReservations(ctx.db).findOne(
    {
      _id: new ObjectId(batch.id),
      workspaceId: ctx.workspace._id,
      createdBy: ctx.actor.userId,
      metric,
      state: "active",
      consumed: batch.offset,
      remaining: { $gte: count },
      expiresAt: { $gt: nowOf(ctx) },
    },
    { session },
  );
}
export async function finishImportBatch<T>(
  ctx: ServiceContext,
  reservation: ImportReservation,
  batch: ImportBatch,
  hash: string,
  values: T[],
  session: ClientSession,
) {
  const result = await importReservations(ctx.db).updateOne(
    {
      _id: reservation._id,
      state: "active",
      consumed: batch.offset,
      remaining: reservation.remaining,
    },
    {
      $inc: { remaining: -values.length, consumed: values.length },
      ...(reservation.remaining === values.length
        ? { $set: { state: "spent" as const } }
        : {}),
    },
    { session },
  );
  if (result.modifiedCount !== 1)
    throw new Error("Import reservation checkpoint changed");
  if (batch.leaseToken)
    await ctx.db
      .collection(physicalNames.import_jobs)
      .updateOne(
        {
          _id: reservation._id,
          leaseToken: batch.leaseToken,
          state: "committing",
        },
        { $max: { done: batch.offset + values.length } },
        { session },
      );
  await importReceipts<T>(ctx.db).insertOne(
    {
      _id: new ObjectId(),
      reservationId: reservation._id,
      workspaceId: ctx.workspace._id,
      createdBy: ctx.actor.userId,
      offset: batch.offset,
      count: values.length,
      hash,
      values,
      purgeAt: reservation.purgeAt,
    },
    { session },
  );
}
export async function readImportReceipt<T>(
  ctx: ServiceContext,
  batch: ImportBatch,
  session?: ClientSession,
) {
  if (!validImportBatch(batch)) return null;
  return importReceipts<T>(ctx.db).findOne(
    {
      reservationId: new ObjectId(batch.id),
      offset: batch.offset,
      workspaceId: ctx.workspace._id,
      createdBy: ctx.actor.userId,
    },
    { ...(session ? { session } : {}) },
  );
}
export async function releaseImportQuota(ctx: ServiceContext, id: string) {
  if (!/^[a-f\d]{24}$/i.test(id)) return false;
  return withQuotaMutation(ctx, async (session) => {
    const reservation = await importReservations(ctx.db).findOne(
      { _id: new ObjectId(id), workspaceId: ctx.workspace._id },
      { session },
    );
    if (
      !reservation ||
      !can(ctx.actor, "resource.delete", { createdBy: reservation.createdBy })
    )
      return false;
    const result = await importReservations(ctx.db).updateOne(
      { _id: reservation._id, state: "active" },
      { $set: { state: "released", remaining: 0 } },
      { session },
    );
    return result.modifiedCount === 1;
  });
}
