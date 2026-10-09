import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";
import type {
  AggregateOptions,
  AnyBulkWriteOperation,
  ClientSession,
  UpdateFilter,
  Collection,
  Db,
  Document,
  Filter,
  MongoClient,
} from "mongodb";

export interface VerifyReport {
  ok: boolean;
  counts: Record<string, number>;
  samples: Document[];
  discrepancies: string[];
}
export interface BatchOptions {
  name: string;
  filter?: Filter<Document>;
  target?: string;
  checkpointId?: string;
  mode?: "transactional" | "time-series";
  operations: (
    documents: Document[],
  ) =>
    | AnyBulkWriteOperation<Document>[]
    | Promise<AnyBulkWriteOperation<Document>[]>;
}
export interface MigrationContext {
  dryRun: boolean;
  direction: "up" | "down";
  read(
    name: string,
  ): Pick<
    Collection<Document>,
    "find" | "findOne" | "countDocuments" | "aggregate"
  >;
  batch(options: BatchOptions): Promise<number>;
  archive(name: string): Promise<void>;
  log(message: string): void;
}
export interface Migration {
  id: string;
  phase: "expand" | "backfill" | "contract";
  continuous?: boolean;
  // Supply the complete module source when imported helpers affect the migration.
  source?: string;
  up(ctx: MigrationContext): Promise<void>;
  verify(ctx: MigrationContext): Promise<VerifyReport>;
  down?: (ctx: MigrationContext) => Promise<void>;
}
export interface MigrationState {
  _id: string;
  id?: string;
  status?: "running" | "applied" | "failed" | "reverted" | "paused";
  stage?: "batching" | "verifying";
  sourceHash?: string;
  startedAt?: Date;
  finishedAt?: Date;
  checkpoint?: Record<string, ObjectId>;
  verifyReport?: VerifyReport;
  holder?: string | null;
  expiresAt?: Date;
  error?: string;
  direction?: "up" | "down";
}
export interface RunnerOptions {
  dryRun?: boolean;
  verifyOnly?: boolean;
  until?: string;
  confirmContract?: boolean;
  confirmDown?: boolean;
  direction?: "up" | "down";
  batchSize?: number;
  batchDelayMs?: number;
  leaseMs?: number;
  log?: (message: string) => void;
}
export function validateOptions(
  migrations: Migration[],
  options: RunnerOptions,
): Migration[] {
  if (options.dryRun && options.verifyOnly)
    throw new Error("--dry-run and --verify-only are mutually exclusive");
  if (
    options.batchSize !== undefined &&
    (!Number.isInteger(options.batchSize) ||
      options.batchSize < 1 ||
      options.batchSize > 5000)
  )
    throw new Error("batchSize must be 1–5000");
  if (
    options.batchDelayMs !== undefined &&
    (!Number.isInteger(options.batchDelayMs) || options.batchDelayMs < 0)
  )
    throw new Error("batchDelayMs must be a nonnegative integer");
  if (options.leaseMs !== undefined && options.leaseMs < 100)
    throw new Error("leaseMs must be at least 100");
  const ordered = [...migrations].sort((a, b) => a.id.localeCompare(b.id));
  const ids = new Set<string>();
  for (const migration of ordered) {
    if (!/^[0-9]{4}-[a-z0-9-]+$/.test(migration.id) || ids.has(migration.id))
      throw new Error(`Invalid or duplicate migration id: ${migration.id}`);
    ids.add(migration.id);
  }
  if (options.direction === "down" && (!options.until || !options.confirmDown))
    throw new Error(
      "Rollback requires an explicit --until target and --confirm-down",
    );
  if (options.until && options.until !== "0000" && !ids.has(options.until))
    throw new Error(`Unknown --until migration: ${options.until}`);
  const selected = ordered.filter((migration) =>
    options.direction === "down"
      ? migration.id > (options.until ?? "")
      : !options.until || migration.id <= options.until,
  );
  if (
    selected.some((migration) => migration.phase === "contract") &&
    !options.confirmContract &&
    !options.verifyOnly
  )
    throw new Error("Contract migrations require --confirm-contract (P7 only)");
  return options.direction === "down" ? selected.reverse() : selected;
}

export function assertReadPipeline(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) assertReadPipeline(item);
  } else if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      if (key === "$out" || key === "$merge")
        throw new Error("Migration reads cannot use $out or $merge");
      assertReadPipeline(item);
    }
  }
}

export function compareAndSet(
  source: Document,
  fields: string[],
  update: UpdateFilter<Document>,
): AnyBulkWriteOperation<Document> {
  if (!fields.length)
    throw new Error("Compare-and-set requires source fields or legacyHash");
  const conditions: Filter<Document>[] = [{ _id: source._id }];
  for (const field of fields) {
    const value = field
      .split(".")
      .reduce<unknown>(
        (current, key) =>
          typeof current === "object" && current !== null
            ? Reflect.get(current, key)
            : undefined,
        source,
      );
    conditions.push(
      value === undefined
        ? { [field]: { $exists: false } }
        : { [field]: { $eq: value } },
    );
  }
  return { updateOne: { filter: { $and: conditions }, update } };
}

function operationSummary(operation: AnyBulkWriteOperation<Document>) {
  if ("insertOne" in operation)
    return {
      type: "insertOne",
      _id: operation.insertOne.document._id,
      fields: Object.keys(operation.insertOne.document),
    };
  if ("replaceOne" in operation)
    return {
      type: "replaceOne",
      _id: operation.replaceOne.filter._id,
      fields: Object.keys(operation.replaceOne.replacement),
    };
  if ("updateOne" in operation || "updateMany" in operation) {
    const item =
      "updateOne" in operation ? operation.updateOne : operation.updateMany;
    return {
      type: "updateOne" in operation ? "updateOne" : "updateMany",
      _id: item.filter._id,
      fields: Object.entries(item.update).flatMap(([, value]) =>
        typeof value === "object" && value !== null ? Object.keys(value) : [],
      ),
    };
  }
  const item =
    "deleteOne" in operation ? operation.deleteOne : operation.deleteMany;
  return {
    type: "deleteOne" in operation ? "deleteOne" : "deleteMany",
    _id: item.filter._id,
    fields: [],
  };
}

export async function runMigrations(
  client: MongoClient,
  db: Db,
  migrations: Migration[],
  options: RunnerOptions = {},
): Promise<Record<string, VerifyReport>> {
  const selected = validateOptions(migrations, options);
  const states = db.collection<MigrationState>("_migrations");
  const holder = crypto.randomUUID();
  const leaseMs = options.leaseMs ?? 30_000;
  const direction = options.direction ?? "up";
  const log = options.log ?? console.log;
  const reports: Record<string, VerifyReport> = {};
  const readonly = Boolean(options.dryRun || options.verifyOnly);
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let leaseFailure: Error | undefined;
  const liveLease = {
    _id: "lock",
    holder,
    $expr: { $gt: ["$expiresAt", "$$NOW"] },
  };
  const renewal = [{ $set: { expiresAt: { $add: ["$$NOW", leaseMs] } } }];
  const assertLease = async () => {
    if (leaseFailure) throw leaseFailure;
    if (!(await states.findOne(liveLease)))
      throw new Error("Migration lease lost; refusing writes");
  };
  const fence = async (session: ClientSession) => {
    if (leaseFailure) throw leaseFailure;
    const result = await states.updateOne(liveLease, renewal, { session });
    if (!result.matchedCount)
      throw new Error("Migration lease lost; refusing writes");
  };
  const transaction = async <T>(
    work: (session: ClientSession) => Promise<T>,
  ): Promise<T> => {
    const session = client.startSession();
    try {
      return await session.withTransaction(() => work(session), {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      });
    } finally {
      await session.endSession();
    }
  };
  const writeState = async (
    id: string,
    update: UpdateFilter<MigrationState>,
    upsert = false,
  ) =>
    transaction(async (session) => {
      await fence(session);
      await states.updateOne({ _id: id }, update, { session, upsert });
    });
  if (!readonly) {
    await transaction(async (session) => {
      await states.updateOne(
        { _id: "lock" },
        { $setOnInsert: { holder: null, expiresAt: new Date(0) } },
        { upsert: true, session },
      );
      const lock = await states.findOneAndUpdate(
        {
          _id: "lock",
          $or: [{ holder: null }, { $expr: { $lte: ["$expiresAt", "$$NOW"] } }],
        },
        [{ $set: { holder, expiresAt: { $add: ["$$NOW", leaseMs] } } }],
        { returnDocument: "after", session },
      );
      if (!lock) throw new Error("Migration lock held by another runner");
    });
    let renewing = false;
    heartbeat = setInterval(
      () => {
        if (renewing) return;
        renewing = true;
        void transaction(fence)
          .catch((error: Error) => {
            leaseFailure = error;
          })
          .finally(() => {
            renewing = false;
          });
      },
      Math.max(25, Math.floor(leaseMs / 3)),
    );
  }
  try {
    for (const migration of selected) {
      const prior = await states.findOne({ _id: migration.id });
      if (
        !options.verifyOnly &&
        direction === "up" &&
        ((prior?.status === "reverted" && migration.continuous) ||
          prior?.status === "paused" ||
          (prior?.status === "applied" && !migration.continuous))
      )
        continue;
      if (
        !options.verifyOnly &&
        direction === "down" &&
        prior?.status !== "applied"
      )
        continue;
      if (direction === "down" && !options.verifyOnly && !migration.down)
        throw new Error(
          `No rollback for ${migration.id}; restore verified archive`,
        );
      const sourceHash = createHash("sha256")
        .update(
          migration.source ??
            [
              migration.id,
              migration.phase,
              migration.up.toString(),
              migration.verify.toString(),
              migration.down?.toString() ?? "",
            ].join("\n"),
        )
        .digest("hex");
      const checkpoints =
        prior?.sourceHash === sourceHash &&
        prior.stage === "batching" &&
        prior.direction === direction &&
        prior.status !== "applied" &&
        prior.status !== "reverted"
          ? { ...prior.checkpoint }
          : {};
      const archived = new Set<string>();
      const usedCheckpointKeys = new Set<string>();
      if (!readonly) {
        await writeState(
          migration.id,
          {
            $set: {
              id: migration.id,
              stage: "batching",
              sourceHash,
              status: "running",
              direction,
              startedAt: new Date(),
              checkpoint: checkpoints,
            },
            $unset: { finishedAt: "", error: "" },
          },
          true,
        );
      }
      let verifying = false;
      const processBatch = async (
        batch: BatchOptions,
        archiveTarget?: string,
      ): Promise<number> => {
        if (options.verifyOnly || verifying)
          throw new Error("Verify is read-only");
        if (
          migration.phase === "contract" &&
          !archiveTarget &&
          !archived.has(batch.target ?? batch.name)
        )
          throw new Error(
            `Contract writes require a verified archive of ${batch.name}`,
          );
        if (!(await db.listCollections({ name: batch.name }).hasNext()))
          throw new Error(`Missing source collection: ${batch.name}`);
        const target = archiveTarget ?? batch.target ?? batch.name;
        const checkpointId = batch.checkpointId ?? `${batch.name}__${target}`;
        if (!/^[a-zA-Z0-9_-]+$/.test(checkpointId))
          throw new Error(
            "checkpointId must contain only letters, digits, underscores and hyphens",
          );
        const checkpointKey = `${archiveTarget ? "archive_" : "data_"}${checkpointId}`;
        if (usedCheckpointKeys.has(checkpointKey))
          throw new Error(`Reused checkpoint key: ${checkpointKey}`);
        usedCheckpointKeys.add(checkpointKey);
        const targetInfo = await db
          .listCollections({ name: target }, { nameOnly: false })
          .next();
        if (targetInfo?.options?.timeseries && batch.mode !== "time-series")
          throw new Error("Time-series targets require mode: time-series");
        if (batch.mode === "time-series" && !targetInfo?.options?.timeseries)
          throw new Error(
            "Time-series batch requires an existing time-series target",
          );
        let lastId = checkpoints[checkpointKey];
        let processed = 0;
        while (true) {
          const readBatch = async (session?: ClientSession) => {
            const filter: Filter<Document> = {
              $and: [
                batch.filter ?? {},
                ...(lastId ? [{ _id: { $gt: lastId } }] : []),
              ],
            };
            const documents = await db
              .collection(batch.name)
              .find(filter, session ? { session } : {})
              .sort({ _id: 1 })
              .limit(options.batchSize ?? 1000)
              .toArray();
            if (!documents.length) return undefined;
            const last = documents.at(-1);
            if (
              !(last?._id instanceof ObjectId) ||
              documents.some((doc) => !(doc._id instanceof ObjectId))
            )
              throw new Error(
                `Batched collection ${batch.name} must have ObjectId _ids`,
              );
            return {
              documents,
              nextId: last._id,
              operations: await batch.operations(documents),
            };
          };
          const checkpoint = async (
            nextId: ObjectId,
            session: ClientSession,
          ) => {
            await states.updateOne(
              { _id: migration.id },
              { $set: { [`checkpoint.${checkpointKey}`]: nextId } },
              { session },
            );
          };
          let result: Awaited<ReturnType<typeof readBatch>>;
          if (options.dryRun) {
            result = await readBatch();
            if (result)
              log(
                `dry-run ${migration.id} ${batch.name}: ${result.documents.length} docs, ${result.operations.length} writes; sample ${JSON.stringify(result.operations.slice(0, 3).map(operationSummary))}`,
              );
          } else if (batch.mode === "time-series") {
            await assertLease();
            result = await readBatch();
            if (result) {
              const ids = new Set(
                result.documents.map((doc) => doc._id.toHexString()),
              );
              const first = result.documents[0];
              const present = await db
                .collection(target)
                .find(
                  { legacyId: { $gte: first?._id, $lte: result.nextId } },
                  { projection: { legacyId: 1 } },
                )
                .toArray();
              const seen = new Set(
                present.map((doc) => doc.legacyId.toHexString()),
              );
              const inserts: AnyBulkWriteOperation<Document>[] = [];
              for (const op of result.operations) {
                if (
                  !("insertOne" in op) ||
                  !(op.insertOne.document.legacyId instanceof ObjectId) ||
                  !ids.has(op.insertOne.document.legacyId.toHexString())
                )
                  throw new Error(
                    "Time-series batches require insertOne with a source legacyId",
                  );
                const id = op.insertOne.document.legacyId.toHexString();
                if (!seen.has(id)) {
                  seen.add(id);
                  inserts.push(op);
                }
              }
              await assertLease();
              if (inserts.length)
                await db
                  .collection(target)
                  .bulkWrite(inserts, { ordered: true });
              const nextId = result.nextId;
              await transaction(async (session) => {
                await fence(session);
                await checkpoint(nextId, session);
              });
            }
          } else {
            result = await transaction(async (session) => {
              // The driver re-runs this read and derivation after a WriteConflict.
              const batchResult = await readBatch(session);
              await fence(session);
              if (batchResult) {
                if (batchResult.operations.length)
                  await db
                    .collection(target)
                    .bulkWrite(batchResult.operations, {
                      ordered: true,
                      session,
                    });
                await checkpoint(batchResult.nextId, session);
              }
              return batchResult;
            });
          }
          if (!result) break;
          checkpoints[checkpointKey] = result.nextId;
          lastId = result.nextId;
          processed += result.documents.length;
          if (options.batchDelayMs) await Bun.sleep(options.batchDelayMs);
        }
        return processed;
      };
      const context: MigrationContext = {
        dryRun: Boolean(options.dryRun),
        direction,
        read: (name) => {
          const collection = db.collection(name);
          return {
            find: collection.find.bind(collection),
            findOne: collection.findOne.bind(collection),
            countDocuments: collection.countDocuments.bind(collection),
            aggregate: <T extends Document = Document>(
              pipeline: Document[] = [],
              options?: AggregateOptions,
            ) => {
              assertReadPipeline(pipeline);
              return collection.aggregate<T>(pipeline, options);
            },
          };
        },
        log,
        batch: (batch) => processBatch(batch),
        archive: async (name) => {
          const filter: Filter<Document> = {};
          const target = `archive_${name}_${migration.id}`;
          await processBatch(
            {
              name,
              filter,
              operations: (documents) =>
                documents.map((document) => ({
                  updateOne: {
                    filter: { _id: document._id },
                    update: { $setOnInsert: document },
                    upsert: true,
                  },
                })),
            },
            target,
          );
          if (!options.dryRun) {
            const sourceCount = await db.collection(name).countDocuments();
            const archiveCount = await db.collection(target).countDocuments();
            if (archiveCount < sourceCount)
              throw new Error(`Archive count verification failed: ${target}`);
            const missing = await db
              .collection(name)
              .aggregate([
                { $match: filter },
                {
                  $lookup: {
                    from: target,
                    localField: "_id",
                    foreignField: "_id",
                    as: "archive",
                  },
                },
                { $match: { archive: { $size: 0 } } },
                { $limit: 1 },
              ])
              .hasNext();
            if (missing)
              throw new Error(`Archive verification failed: ${target}`);
          }
          log(
            `${options.dryRun ? "would verify" : "verified"} archive ${target}`,
          );
          archived.add(name);
        },
      };
      try {
        if (!options.verifyOnly) {
          if (direction === "up") await migration.up(context);
          else await migration.down?.(context);
        }
        verifying = true;
        if (!readonly)
          await writeState(migration.id, { $set: { stage: "verifying" } });
        const report = await migration.verify(context);
        reports[migration.id] = report;
        log(
          options.dryRun
            ? `dry-run verification ${migration.id}: ok=${report.ok}`
            : `${migration.id}: ${JSON.stringify(report)}`,
        );
        // Dry-run verifies the unchanged database; unmet postconditions are expected.
        if (!readonly) {
          await writeState(migration.id, {
            $set: {
              status: report.ok
                ? direction === "up"
                  ? "applied"
                  : "reverted"
                : "failed",
              finishedAt: new Date(),
              verifyReport: report,
              checkpoint: {},
            },
          });
        }
        if (!report.ok && !options.dryRun)
          throw new Error(`Verification failed: ${migration.id}`);
      } catch (error) {
        if (!readonly) {
          try {
            await writeState(migration.id, {
              $set: {
                status: "failed",
                error: error instanceof Error ? error.message : String(error),
                ...(verifying ? { checkpoint: {} } : {}),
              },
            });
          } catch {
            /* A lost lease must not hide the original failure. */
          }
        }
        throw error;
      }
    }
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    if (!readonly) {
      try {
        await transaction(async (session) => {
          await fence(session);
          await states.updateOne(
            liveLease,
            { $set: { holder: null, expiresAt: new Date(0) } },
            { session },
          );
        });
      } catch {
        /* A replacement holder owns cleanup; preserve the original error. */
      }
    }
  }
  return reports;
}
