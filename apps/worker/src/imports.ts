import { blockingQueueRedis } from "./queue-redis";
import { randomUUID, createHash } from "node:crypto";
import { ObjectId, type ClientSession, type Db } from "mongodb";
import { Queue, Worker } from "bullmq";
import type Redis from "ioredis";
import { createCache, invalidateLinks, keys } from "@shortn/redis";
import { collection } from "@shortn/db";
import { loadEntitlements } from "@shortn/billing";
import type { ObjectStore } from "@shortn/storage";
import {
  importJobs,
  importRows,
  importResults,
  importReservations,
  importReceipts,
  importLimits,
  ImportInputError,
  parseImportCsv,
  detectImportMapping,
  mapImportRecord,
  validateCreateLinks,
  createMany,
  createManyQrImports,
  reserveImportQuota,
  reservedImportUsage,
  countUsage,
  withMutation,
  recordWebhookEvent,
  can,
  workspaceAccess,
  csvCell,
  mongoLinkLoader,
  cacheTtlSeconds,
  decodeCachedLink,
  encodeCachedLink,
  type CachedLink,
  type ImportJob,
  type ImportResult,
  type ServiceContext,
} from "@shortn/core";
export interface ImportDependencies {
  db: Db;
  cache: ServiceContext["cache"];
  store: ObjectStore;
  linkDomain: string;
}
async function context(
  deps: ImportDependencies,
  job: ImportJob,
): Promise<ServiceContext> {
  const [workspace, member] = await Promise.all([
    collection(deps.db, "workspaces").findOne({ _id: job.workspaceId }),
    collection(deps.db, "workspace_members").findOne({
      workspaceId: job.workspaceId,
      userId: job.createdBy,
    }),
  ]);
  if (
    !workspace ||
    !member ||
    !can({ userId: member.userId, role: member.role }, "resource.create")
  )
    throw new Error("access_removed");
  // Imports write links, so a staff lock stops them like a dashboard edit.
  if (workspaceAccess(workspace) !== "active")
    throw new Error("workspace_suspended");
  return {
    db: deps.db,
    cache: deps.cache,
    workspace,
    actor: { userId: member.userId, role: member.role },
    linkDomain: deps.linkDomain,
  };
}
const pending = [
  "inspect_pending",
  "validate_pending",
  "commit_pending",
] as const;
const running = ["inspecting", "validating", "committing"] as const;
export async function runImport(
  deps: ImportDependencies,
  id: string,
  now = new Date(),
) {
  if (!/^[a-f\d]{24}$/i.test(id)) return false;
  const token = randomUUID(),
    jobs = importJobs(deps.db);
  const claimed = await jobs.findOneAndUpdate(
    {
      _id: new ObjectId(id),
      expiresAt: { $gt: now },
      nextAttemptAt: { $lte: now },
      $or: [
        { state: { $in: [...pending] } },
        { state: { $in: [...running] }, leaseUntil: { $lte: now } },
      ],
    },
    {
      $set: {
        leaseToken: token,
        leaseUntil: new Date(now.getTime() + 300_000),
      },
      $inc: { attempts: 1 },
    },
    { returnDocument: "after" },
  );
  if (!claimed) return false;
  const job = claimed,
    metric = job.kind === "qr" ? "qrCodes" : "links",
    fence = { _id: job._id, leaseToken: token, expiresAt: { $gt: new Date() } };
  const save = async (
    patch: Partial<ImportJob>,
    action?: (session: ClientSession) => Promise<void>,
  ) => {
    await withMutation(deps.db, async (session) => {
      const result = await jobs.updateOne(
        { ...fence, expiresAt: { $gt: new Date() } },
        { $set: { ...patch, leaseUntil: new Date(Date.now() + 300_000) } },
        { session },
      );
      if (!result.matchedCount) throw new Error("lease_lost");
      await action?.(session);
    });
    Object.assign(job, patch);
  };
  const warmCommitted = async () => {
    const cache = createCache<CachedLink>(
        deps.cache,
        decodeCachedLink,
        encodeCachedLink,
      ),
      load = mongoLinkLoader(deps.db, deps.linkDomain);
    while ((job.warmed ?? 0) < job.done) {
      await context(deps, job);
      const receipt = await importReceipts<{ domain: string; key: string }>(
        deps.db,
      ).findOne({ reservationId: job._id, offset: job.warmed ?? 0 });
      if (
        !receipt ||
        receipt.count !== receipt.values.length ||
        receipt.count > importLimits.chunk ||
        receipt.offset + receipt.count > job.done
      )
        throw new Error("snapshot_missing");
      const domains = new Map<string, string[]>();
      for (const value of receipt.values)
        domains.set(value.domain, [
          ...(domains.get(value.domain) ?? []),
          value.key,
        ]);
      // Repeating invalidation repairs failures after a chunk's transaction committed.
      for (const [domain, values] of domains)
        await invalidateLinks(deps.cache, domain, values);
      let position = 0;
      await Promise.all(
        Array.from(
          { length: Math.min(16, receipt.values.length) },
          async () => {
            while (position < receipt.values.length) {
              const value = receipt.values[position++]!;
              await cache.get(
                keys.link(value.domain, value.key),
                cacheTtlSeconds,
                () => load(value.domain, value.key),
              );
            }
          },
        ),
      );
      await save({ warmed: receipt.offset + receipt.count });
    }
  };
  const settle = async (patch: Partial<ImportJob>) => {
    await save(patch);
    await jobs.updateOne(fence, { $unset: { leaseToken: "", leaseUntil: "" } });
  };
  try {
    if (!["links", "qr"].includes(job.kind))
      throw new Error("invalid_import_kind");
    await context(deps, job);
    if (job.state === "inspect_pending" || job.state === "inspecting") {
      await save({ state: "inspecting" });
      const head = await deps.store.head(job.inputKey);
      if (!head || head.bytes !== job.bytes)
        throw new Error("upload_missing_or_changed");
      const bytes = await deps.store.get(job.inputKey, importLimits.bytes);
      if (bytes.length !== job.bytes)
        throw new Error("upload_missing_or_changed");
      const hash = createHash("sha256").update(bytes).digest("hex"),
        table = parseImportCsv(bytes);
      if (!table.records.length) throw new Error("empty_import");
      if (job.sourceHash && job.sourceHash !== hash)
        throw new Error("source_changed");
      await save({
        sourceHash: hash,
        total: table.records.length,
        columns: table.columns,
        preview: table.records.slice(0, importLimits.preview).map((row) => ({
          row: row.row,
          cells: row.cells.map((cell) => cell.slice(0, 200)),
        })),
        mapping: detectImportMapping(table.columns),
      });
      for (
        let start = job.inspected;
        start < table.records.length;
        start += importLimits.chunk
      ) {
        await context(deps, job);
        const chunk = table.records.slice(start, start + importLimits.chunk);
        await save({ inspected: start + chunk.length }, async (session) => {
          await importRows(deps.db).bulkWrite(
            chunk.map((row, offset) => ({
              updateOne: {
                filter: { jobId: job._id, position: start + offset },
                update: {
                  $setOnInsert: {
                    _id: new ObjectId(),
                    jobId: job._id,
                    position: start + offset,
                    ...row,
                    expiresAt: job.expiresAt,
                  },
                },
                upsert: true,
              },
            })),
            { session },
          );
        });
      }
      await settle({ state: "mapping" });
      return true;
    }
    if (job.state === "validate_pending" || job.state === "validating") {
      if (!job.columns || !job.mapping) throw new Error("snapshot_missing");
      await save({ state: "validating" });
      const prior = await importResults(deps.db)
        .find(
          {
            jobId: job._id,
            generation: job.generation,
            position: { $lt: job.validated },
            identity: { $exists: true },
          },
          { projection: { identity: 1 } },
        )
        .toArray();
      const identities = new Set(prior.map((row) => row.identity!));
      while (job.validated < job.total) {
        const ctx = await context(deps, job),
          start = job.validated;
        const rows = await importRows(deps.db)
          .find({ jobId: job._id, position: { $gte: start } })
          .sort({ position: 1 })
          .limit(importLimits.chunk)
          .toArray();
        if (
          !rows.length ||
          rows.some((row, index) => row.position !== start + index)
        )
          throw new Error("snapshot_missing");
        const mapped = rows.map((row) =>
          mapImportRecord({ columns: job.columns! }, job.mapping!, row),
        );
        const candidates = mapped.flatMap((row) => (row.ok ? [row.input] : []));
        const valid = candidates.length
          ? await validateCreateLinks(ctx, candidates)
          : [];
        let cursor = 0,
          count = job.valid;
        const counts = { ...job.counts };
        const results: ImportResult[] = rows.map((row, index) => {
          const mappedRow = mapped[index]!;
          const result = mappedRow.ok ? valid[cursor++]! : mappedRow;
          // Normalize the two result shapes before persistence.
          let input =
            mappedRow.ok && result.ok && "value" in result
              ? result.value
              : undefined;
          let error = result.ok ? undefined : result.error;
          const key = input?.key ? `${input.domain}/${input.key}` : undefined;
          if (key && identities.has(key)) {
            error = "key_taken";
            input = undefined;
          }
          if (key && !error) identities.add(key);
          if (error) counts[error] = (counts[error] ?? 0) + 1;
          return {
            _id: new ObjectId(),
            jobId: job._id,
            generation: job.generation,
            position: row.position,
            row: row.row,
            expiresAt: job.expiresAt,
            ...(input
              ? { input, ordinal: count++, ...(key ? { identity: key } : {}) }
              : {
                  error: error ?? "invalid_input",
                  destination: row.cells[job.mapping!.url!] ?? "",
                }),
          };
        });
        await save(
          {
            validated: start + rows.length,
            valid: count,
            invalid: start + rows.length - count,
            counts,
          },
          async (session) => {
            await importResults(deps.db).bulkWrite(
              results.map((row) => ({
                replaceOne: {
                  filter: {
                    jobId: job._id,
                    generation: job.generation,
                    position: row.position,
                  },
                  replacement: row,
                  upsert: true,
                },
              })),
              { session },
            );
          },
        );
      }
      let errorKey: string | undefined;
      if (job.invalid) {
        if (!deps.store.putStream) throw new Error("streaming_unavailable");
        errorKey = `exports/jobs/imports/${job.workspaceId}/${job._id}/${job.generation}/${token}-errors.csv`;
        const chunks = async function* () {
          yield new TextEncoder().encode("row,error,url\r\n");
          const rows = importResults(deps.db)
            .find({
              jobId: job._id,
              generation: job.generation,
              error: { $exists: true },
            })
            .sort({ position: 1 })
            .batchSize(100);
          try {
            for await (const row of rows)
              yield new TextEncoder().encode(
                [
                  String(row.row),
                  csvCell(row.error!),
                  csvCell(row.destination ?? ""),
                ].join(",") + "\r\n",
              );
          } finally {
            await rows.close();
          }
        };
        await deps.store.putStream(
          errorKey,
          chunks(),
          "text/csv; charset=utf-8",
          32 * 1024 * 1024,
        );
      }
      const ctx = await context(deps, job),
        entitlements = await loadEntitlements(deps.db, job.workspaceId);
      const usage = await countUsage(
          deps.db,
          ctx.workspace,
          entitlements.period,
        ),
        held = await reservedImportUsage(
          deps.db,
          job.workspaceId,
          entitlements.period,
          new Date(),
        );
      const limit = entitlements.limits[metric];
      await settle({
        state: "ready",
        ...(errorKey ? { errorKey } : {}),
        quota: {
          limit,
          used: usage[metric],
          reserved: held[metric],
          requested: job.valid,
          available:
            limit === null
              ? null
              : Math.max(0, limit - usage[metric] - held[metric]),
        },
      });
      return true;
    }
    await save({ state: "committing" });
    const ctx = await context(deps, job);
    let reservation = await importReservations(deps.db).findOne({
      _id: job._id,
      workspaceId: job.workspaceId,
      createdBy: job.createdBy,
    });
    if (!reservation) {
      const reserved = await reserveImportQuota(ctx, id, metric, job.valid);
      if (!reserved.ok) {
        if (reserved.error === "limit_reached") {
          await settle({
            state: "ready",
            error: "limit_reached",
            quota: reserved.detail ?? {},
          });
          return true;
        }
        throw new Error("reservation_closed");
      }
      reservation = reserved.value;
    }
    if (
      reservation.total !== job.valid ||
      reservation.metric !== metric ||
      (reservation.state !== "spent" &&
        (reservation.state !== "active" || reservation.expiresAt <= new Date()))
    )
      throw new Error("reservation_closed");
    await save({ done: reservation.consumed });
    await warmCommitted();
    while (job.done < job.valid) {
      const ctx = await context(deps, job),
        start = job.done;
      const rows = await importResults(deps.db)
        .find({
          jobId: job._id,
          generation: job.generation,
          ordinal: { $gte: start },
        })
        .sort({ ordinal: 1 })
        .limit(importLimits.chunk)
        .toArray();
      if (
        !rows.length ||
        rows.some((row, index) => !row.input || row.ordinal !== start + index)
      )
        throw new Error("snapshot_missing");
      const result = await (
        job.kind === "qr" ? createManyQrImports : createMany
      )(
        ctx,
        rows.map((row) => row.input!),
        { id, offset: start, leaseToken: token },
      );
      if (!result.ok) {
        if (!(await jobs.findOne(fence))) throw new Error("lease_lost");
        throw new Error(`commit_${result.error}`);
      }
      await save({ done: start + rows.length });
      await warmCommitted();
    }
    await context(deps, job);
    await withMutation(deps.db, async (session) => {
      const changed = await jobs.updateOne(
        fence,
        {
          $set: { state: "completed", done: job.valid },
          $unset: { leaseToken: "", leaseUntil: "", error: "" },
        },
        { session },
      );
      if (!changed.matchedCount) throw new Error("lease_lost");
      await recordWebhookEvent(
        deps.db,
        job.workspaceId,
        "import.completed",
        {
          id,
          kind: job.kind,
          total: job.total,
          created: job.valid,
          invalid: job.invalid,
        },
        session,
      );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "lease_lost") return true;
    const permanent =
      error instanceof ImportInputError ||
      [
        "invalid_import_kind",
        "access_removed",
        "workspace_suspended",
        "upload_missing_or_changed",
        "source_changed",
        "empty_import",
        "snapshot_missing",
        "reservation_closed",
      ].includes(message) ||
      message.startsWith("commit_");
    const code =
      error instanceof ImportInputError
        ? error.code
        : permanent
          ? message
          : "infrastructure_unavailable";
    const failed = permanent || job.attempts >= 5;
    await withMutation(deps.db, async (session) => {
      await collection(deps.db, "workspaces").updateOne(
        { _id: job.workspaceId },
        { $inc: { linkMutationRevision: 1 } },
        { session },
      );
      const changed = await jobs.updateOne(
        fence,
        {
          $set: {
            state: failed
              ? "failed"
              : job.state === "inspecting"
                ? "inspect_pending"
                : job.state === "validating"
                  ? "validate_pending"
                  : "commit_pending",
            error: code,
            nextAttemptAt: new Date(
              Date.now() + Math.min(300_000, 5000 * 2 ** (job.attempts - 1)),
            ),
          },
          $unset: { leaseToken: "", leaseUntil: "" },
        },
        { session },
      );
      if (changed.matchedCount && failed)
        await importReservations(deps.db).updateOne(
          { _id: job._id, workspaceId: job.workspaceId, state: "active" },
          { $set: { state: "released", remaining: 0 } },
          { session },
        );
    });
  }
  return true;
}
export function createImportWorker(
  deps: ImportDependencies & {
    durable: Redis;
    queueName?: string;
    log: (message: string, error?: unknown) => void;
  },
) {
  const name = deps.queueName ?? "shortn-imports",
    producer = deps.durable.duplicate({ maxRetriesPerRequest: 1 }),
    consumer = blockingQueueRedis(deps.durable);
  const queue = new Queue(name, { connection: producer }),
    worker = new Worker<{ id: string }>(
      name,
      (job) => runImport(deps, job.data.id),
      { connection: consumer, concurrency: 2 },
    );
  queue.on("error", (error) => deps.log("Import producer error", error));
  worker.on("error", (error) => deps.log("Import queue error", error));
  let pumping: Promise<void> | undefined,
    closing = false;
  const pump = () => {
    if (closing) return Promise.resolve();
    if (pumping) return pumping;
    pumping = (async () => {
      const now = new Date(),
        due = await importJobs(deps.db)
          .find(
            {
              expiresAt: { $gt: now },
              nextAttemptAt: { $lte: now },
              $or: [
                { state: { $in: [...pending] } },
                { state: { $in: [...running] }, leaseUntil: { $lte: now } },
              ],
            },
            { projection: { _id: 1, attempts: 1 } },
          )
          .sort({ nextAttemptAt: 1, _id: 1 })
          .limit(50)
          .toArray();
      for (const job of due)
        await queue.add(
          "import",
          { id: job._id.toHexString() },
          {
            jobId: `${job._id}-${job.attempts}`,
            removeOnComplete: true,
            removeOnFail: true,
          },
        );
    })().finally(() => {
      pumping = undefined;
    });
    return pumping;
  };
  return {
    queue,
    worker,
    pump,
    async close() {
      closing = true;
      await pumping?.catch((error) => deps.log("Import pump stopped", error));
      await worker.close();
      await queue.close();
      producer.disconnect();
      consumer.disconnect();
    },
  };
}
