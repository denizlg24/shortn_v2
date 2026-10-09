import { ObjectId } from "mongodb";
import type {
  AggregateOptions,
  AnyBulkWriteOperation,
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
  up(ctx: MigrationContext): Promise<void>;
  verify(ctx: MigrationContext): Promise<VerifyReport>;
  down?: (ctx: MigrationContext) => Promise<void>;
}
export interface MigrationState {
  _id: string;
  id?: string;
  status?: "running" | "applied" | "failed" | "reverted";
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
  if (options.until && !ids.has(options.until))
    throw new Error(`Unknown --until migration: ${options.until}`);
  const selected = ordered.filter(
    (migration) => !options.until || migration.id <= options.until,
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
  const assertLease = async () => {
    if (leaseFailure) throw leaseFailure;
    const owned = await states.findOne({
      _id: "lock",
      holder,
      expiresAt: { $gt: new Date() },
    });
    if (!owned) throw new Error("Migration lease lost; refusing writes");
  };
  if (!readonly) {
    await states.updateOne(
      { _id: "lock" },
      { $setOnInsert: { holder: null, expiresAt: new Date(0) } },
      { upsert: true },
    );
    const now = new Date();
    const lock = await states.findOneAndUpdate(
      { _id: "lock", $or: [{ holder: null }, { expiresAt: { $lte: now } }] },
      { $set: { holder, expiresAt: new Date(now.getTime() + leaseMs) } },
      { returnDocument: "after" },
    );
    if (!lock) throw new Error("Migration lock held by another runner");
    heartbeat = setInterval(
      () => {
        void states
          .updateOne(
            { _id: "lock", holder, expiresAt: { $gt: new Date() } },
            { $set: { expiresAt: new Date(Date.now() + leaseMs) } },
          )
          .then((result) => {
            if (!result.matchedCount)
              leaseFailure = new Error("Migration lease lost");
          })
          .catch((error: Error) => {
            leaseFailure = error;
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
        prior?.status === "applied" &&
        !migration.continuous
      )
        continue;
      if (
        !options.verifyOnly &&
        direction === "down" &&
        (!prior || prior.status === "reverted")
      )
        continue;
      if (direction === "down" && !options.verifyOnly && !migration.down)
        throw new Error(
          `No rollback for ${migration.id}; restore verified archive`,
        );
      const checkpoints =
        prior?.direction === direction &&
        prior.status !== "applied" &&
        prior.status !== "reverted"
          ? { ...prior.checkpoint }
          : {};
      const archived = new Set<string>();
      if (!readonly) {
        await assertLease();
        await states.updateOne(
          { _id: migration.id },
          {
            $set: {
              id: migration.id,
              status: "running",
              direction,
              startedAt: new Date(),
              checkpoint: checkpoints,
            },
            $unset: { finishedAt: "", error: "" },
          },
          { upsert: true },
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
        const checkpointId = batch.checkpointId ?? batch.name;
        if (!/^[a-zA-Z0-9_-]+$/.test(checkpointId))
          throw new Error(
            "checkpointId must contain only letters, digits, underscores and hyphens",
          );
        const checkpointKey = `${archiveTarget ? "archive_" : "data_"}${checkpointId}`;
        let lastId = checkpoints[checkpointKey];
        let processed = 0;
        while (true) {
          if (!readonly) await assertLease();
          const filter: Filter<Document> = {
            $and: [
              batch.filter ?? {},
              ...(lastId ? [{ _id: { $gt: lastId } }] : []),
            ],
          };
          const documents = await db
            .collection(batch.name)
            .find(filter)
            .sort({ _id: 1 })
            .limit(options.batchSize ?? 1000)
            .toArray();
          if (documents.length === 0) break;
          const last = documents.at(-1);
          if (
            !(last?._id instanceof ObjectId) ||
            documents.some((doc) => !(doc._id instanceof ObjectId))
          )
            throw new Error(
              `Batched collection ${batch.name} must have ObjectId _ids`,
            );
          const nextId = last._id;
          const operations = await batch.operations(documents);
          if (options.dryRun)
            log(
              `dry-run ${migration.id} ${batch.name}: ${documents.length} docs, ${operations.length} writes; sample ${JSON.stringify(operations.slice(0, 3))}`,
            );
          else {
            const session = client.startSession();
            try {
              await session.withTransaction(async () => {
                // Updating the lock in the transaction fences expired owners against a new holder.
                const fence = await states.updateOne(
                  { _id: "lock", holder, expiresAt: { $gt: new Date() } },
                  { $set: { expiresAt: new Date(Date.now() + leaseMs) } },
                  { session },
                );
                if (!fence.matchedCount)
                  throw new Error("Migration lease lost; refusing batch");
                if (operations.length) {
                  try {
                    await db
                      .collection(archiveTarget ?? batch.target ?? batch.name)
                      .bulkWrite(operations, { ordered: false, session });
                  } catch (error) {
                    // An unordered bulk can mask a permanent write failure with
                    // a transient NoSuchTransaction from its remaining operations.
                    // Surface rejected batches for checkpoint-based resume instead
                    // of letting withTransaction retry the same rejected writes.
                    throw new Error(
                      `Migration batch rejected: ${error instanceof Error ? error.message : String(error)}`,
                      { cause: error },
                    );
                  }
                }
                await states.updateOne(
                  { _id: migration.id },
                  { $set: { [`checkpoint.${checkpointKey}`]: nextId } },
                  { session },
                );
              });
            } finally {
              await session.endSession();
            }
          }
          checkpoints[checkpointKey] = nextId;
          lastId = nextId;
          processed += documents.length;
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
                  replaceOne: {
                    filter: { _id: document._id },
                    replacement: document,
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
        const report = await migration.verify(context);
        reports[migration.id] = report;
        log(`${migration.id}: ${JSON.stringify(report)}`);
        // Dry-run verifies the unchanged database; unmet postconditions are expected.
        if (!readonly) {
          await assertLease();
          await states.updateOne(
            { _id: migration.id },
            {
              $set: {
                status: report.ok
                  ? direction === "up"
                    ? "applied"
                    : "reverted"
                  : "failed",
                finishedAt: new Date(),
                verifyReport: report,
              },
            },
          );
        }
        if (!report.ok && !options.dryRun)
          throw new Error(`Verification failed: ${migration.id}`);
      } catch (error) {
        if (!readonly) {
          await assertLease();
          await states.updateOne(
            { _id: migration.id },
            {
              $set: {
                status: "failed",
                error: error instanceof Error ? error.message : String(error),
              },
            },
          );
        }
        throw error;
      }
    }
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    if (!readonly)
      await states.updateOne(
        { _id: "lock", holder },
        { $set: { holder: null, expiresAt: new Date(0) } },
      );
  }
  return reports;
}
