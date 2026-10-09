import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { MongoClient, ObjectId } from "mongodb";
import type { Db } from "mongodb";
import { legacyCollections, syncIndexes } from "./indexes";
import { resolvePhysicalNames } from "./collections";
import { compareAndSet, runMigrations } from "./migrations/runner";
import type {
  Migration,
  MigrationState,
  VerifyReport,
} from "./migrations/runner";
const url = process.env.MONGO_TEST_URL;
if (!url && process.env.REQUIRE_INTEGRATION === "1")
  throw new Error("MONGO_TEST_URL required");
const quiet = () => {};
const ok = (): VerifyReport => ({
  ok: true,
  counts: {},
  samples: [],
  discrepancies: [],
});
const base: Migration = {
  id: "0001-safety",
  phase: "expand",
  up: async () => {},
  verify: async () => ok(),
};
(url ? describe : describe.skip)("Migration safety integration", () => {
  let client: MongoClient;
  beforeAll(async () => {
    if (
      !url ||
      !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)
    )
      throw new Error("Local replica set required");
    client = await new MongoClient(url, {
      serverSelectionTimeoutMS: 10000,
    }).connect();
    if (!(await client.db("admin").command({ hello: 1 })).setName)
      throw new Error("Replica set required");
  }, 15000);
  afterAll(async () => {
    await client?.close();
  });
  async function fixture(work: (db: Db) => Promise<void>) {
    const db = client.db(
      `shortn_safety_test_${crypto.randomUUID().replaceAll("-", "")}`,
    );
    try {
      await work(db);
    } finally {
      await db.dropDatabase();
    }
  }
  test("missing legacy index collection fails before any collection is created, including dry-run", async () =>
    fixture(async (db) => {
      for (const dryRun of [false, true])
        await expect(syncIndexes(db, { dryRun, log: quiet })).rejects.toThrow(
          "Missing legacy collection: urlv3",
        );
      expect(await db.listCollections().toArray()).toHaveLength(0);
      for (const name of legacyCollections)
        if (name !== "user") await db.createCollection(name);
      await expect(syncIndexes(db, { log: quiet })).rejects.toThrow("user");
      expect(await db.listCollections({ name: "click_events" }).hasNext()).toBe(
        false,
      );
    }));
  test(
    "index sync honors audited name overrides",
    async () =>
      fixture(async (db) => {
        const names = resolvePhysicalNames(
          '{"links":"audited_links","tags":"audited_tags","click_events":"audited_events","workspaces":"audited_workspaces"}',
        );
        for (const name of legacyCollections)
          await db.createCollection(
            name === "urlv3"
              ? names.links
              : name === "tags"
                ? names.tags
                : name,
          );
        await syncIndexes(db, { physicalNames: names, log: quiet });
        expect(
          (await db.collection(names.links).listIndexes().toArray()).some(
            (i) => i.name === "v2_domain_key",
          ),
        ).toBe(true);
        expect(await db.listCollections({ name: "urlv3" }).hasNext()).toBe(
          false,
        );
        expect(await db.listCollections({ name: "tags" }).hasNext()).toBe(
          false,
        );
        expect(
          await db.listCollections({ name: "click_events" }).hasNext(),
        ).toBe(false);
        expect(await db.listCollections({ name: "workspaces" }).hasNext()).toBe(
          false,
        );
        expect(
          (
            await db
              .listCollections(
                { name: names.click_events },
                { nameOnly: false },
              )
              .next()
          )?.options?.timeseries?.bucketRoundingSeconds,
        ).toBe(86400);
        expect(
          (await db.collection(names.tags).listIndexes().toArray()).some(
            (i) => i.name === "v2_tag_name",
          ),
        ).toBe(true);
        expect(
          (await db.collection(names.workspaces).listIndexes().toArray()).some(
            (i) => i.name === "v2_workspace_slug",
          ),
        ).toBe(true);
      }),
    30000,
  );
  test("batch and archive reject a missing source; an existing empty archive succeeds", async () =>
    fixture(async (db) => {
      for (const archive of [false, true]) {
        const migration: Migration = {
          ...base,
          async up(ctx) {
            if (archive) await ctx.archive("missing");
            else await ctx.batch({ name: "missing", operations: () => [] });
          },
        };
        await expect(
          runMigrations(client, db, [migration], { log: quiet }),
        ).rejects.toThrow("Missing source collection");
      }
      expect(await db.listCollections({ name: "missing" }).hasNext()).toBe(
        false,
      );
      await db.createCollection("empty");
      await runMigrations(
        client,
        db,
        [
          {
            ...base,
            async up(ctx) {
              await ctx.archive("empty");
            },
          },
        ],
        { log: quiet },
      );
    }));
  test("concurrent legacy write causes WriteConflict retry and re-derives from fresh source", async () =>
    fixture(async (db) => {
      const _id = new ObjectId();
      await db
        .collection("urlv3")
        .insertOne({ _id, longUrl: "https://old.example" });
      let attempts = 0;
      const migration: Migration = {
        ...base,
        async up(ctx) {
          await ctx.batch({
            name: "urlv3",
            operations: async (docs) => {
              attempts++;
              if (attempts === 1)
                await db
                  .collection("urlv3")
                  .updateOne(
                    { _id },
                    { $set: { longUrl: "https://new.example" } },
                  );
              return docs.map((doc) =>
                compareAndSet(doc, ["longUrl"], {
                  $set: { destination: doc.longUrl },
                }),
              );
            },
          });
        },
        async verify(ctx) {
          const doc = await ctx.read("urlv3").findOne({ _id });
          return { ...ok(), ok: doc?.destination === doc?.longUrl };
        },
      };
      await runMigrations(client, db, [migration], { log: quiet });
      expect(attempts).toBe(2);
      expect((await db.collection("urlv3").findOne({ _id }))?.destination).toBe(
        "https://new.example",
      );
    }));
  test("compare-and-set checks source fields, missing fields and legacyHash", async () =>
    fixture(async (db) => {
      const source = {
        _id: new ObjectId(),
        longUrl: "https://old.example",
        _sync: { legacyHash: "old" },
      };
      await db.collection("cas").insertOne({
        ...source,
        longUrl: "https://new.example",
        _sync: { legacyHash: "new" },
      });
      await db.collection("cas").bulkWrite([
        compareAndSet(source, ["longUrl", "_sync.legacyHash", "missing"], {
          $set: { destination: "stale" },
        }),
      ]);
      expect(
        (await db.collection("cas").findOne({ _id: source._id }))?.destination,
      ).toBeUndefined();
      expect(() => compareAndSet(source, [], { $set: { x: 1 } })).toThrow(
        "source fields",
      );
      const nullable = { _id: new ObjectId(), value: null };
      await db.collection("cas").insertOne({ _id: nullable._id });
      await db
        .collection("cas")
        .bulkWrite([
          compareAndSet(nullable, ["value"], {
            $set: { destination: "stale" },
          }),
        ]);
      expect(
        (await db.collection("cas").findOne({ _id: nullable._id }))
          ?.destination,
      ).toBeUndefined();
      await db
        .collection("cas")
        .updateOne({ _id: nullable._id }, { $set: { value: null } });
      await db
        .collection("cas")
        .bulkWrite([
          compareAndSet(nullable, ["value"], {
            $set: { destination: "fresh" },
          }),
        ]);
      expect(
        (await db.collection("cas").findOne({ _id: nullable._id }))
          ?.destination,
      ).toBe("fresh");
    }));
  test("rollback retains target, reverses multiple applied migrations newest first, and continuous skips reverted/paused", async () =>
    fixture(async (db) => {
      const rolled: string[] = [];
      const ran: string[] = [];
      const migrations = [1, 2, 3, 4].map((number) => ({
        ...base,
        id: `000${number}-step`,
        continuous: true,
        async up() {
          ran.push(`000${number}-step`);
        },
        async down() {
          rolled.push(`000${number}-step`);
        },
      }));
      await runMigrations(client, db, migrations, { log: quiet });
      await db
        .collection<MigrationState>("_migrations")
        .updateOne({ _id: "0004-step" }, { $set: { status: "failed" } });
      await runMigrations(client, db, migrations, {
        direction: "down",
        until: "0001-step",
        confirmDown: true,
        log: quiet,
      });
      expect(rolled).toEqual(["0003-step", "0002-step"]);
      await db
        .collection<MigrationState>("_migrations")
        .updateOne({ _id: "0004-step" }, { $set: { status: "paused" } });
      ran.length = 0;
      await runMigrations(client, db, migrations, { log: quiet });
      expect(ran).toEqual(["0001-step"]);
      expect(
        (
          await db
            .collection<MigrationState>("_migrations")
            .findOne({ _id: "0002-step" })
        )?.status,
      ).toBe("reverted");
    }));
  test("duplicate checkpoint keys throw, and default keys separate targets", async () =>
    fixture(async (db) => {
      await db.collection("source").insertOne({ _id: new ObjectId() });
      await expect(
        runMigrations(
          client,
          db,
          [
            {
              ...base,
              async up(ctx) {
                await ctx.batch({
                  name: "source",
                  checkpointId: "same",
                  operations: () => [],
                });
                await ctx.batch({
                  name: "source",
                  checkpointId: "same",
                  operations: () => [],
                });
              },
            },
          ],
          { log: quiet },
        ),
      ).rejects.toThrow("Reused checkpoint key");
      const counts: number[] = [];
      await runMigrations(
        client,
        db,
        [
          {
            ...base,
            async up(ctx) {
              for (const target of ["target_a", "target_b"])
                counts.push(
                  await ctx.batch({
                    name: "source",
                    target,
                    operations: (docs) =>
                      docs.map((document) => ({ insertOne: { document } })),
                  }),
                );
            },
          },
        ],
        { log: quiet },
      );
      expect(counts).toEqual([1, 1]);
    }));
  test("verify false or exception clears checkpoints and rerun visits lower ids", async () =>
    fixture(async (db) => {
      await db
        .collection("source")
        .insertOne({ _id: new ObjectId("ffffffffffffffffffffffff") });
      let fail = true;
      let throwVerify = false;
      const migration: Migration = {
        ...base,
        continuous: true,
        async up(ctx) {
          await ctx.batch({
            name: "source",
            operations: (docs) =>
              docs.map((doc) => ({
                updateOne: {
                  filter: { _id: doc._id },
                  update: { $set: { expanded: true } },
                },
              })),
          });
        },
        async verify() {
          if (fail && throwVerify) throw new Error("bad verifier");
          return { ...ok(), ok: !fail };
        },
      };
      for (const throws of [false, true]) {
        throwVerify = throws;
        await expect(
          runMigrations(client, db, [migration], { log: quiet }),
        ).rejects.toThrow(throws ? "bad verifier" : "Verification failed");
        const state = await db
          .collection<MigrationState>("_migrations")
          .findOne({ _id: base.id });
        expect(state?.stage).toBe("verifying");
        expect(state?.checkpoint).toEqual({});
      }
      await db
        .collection("source")
        .insertOne({ _id: new ObjectId("000000000000000000000001") });
      fail = false;
      await runMigrations(client, db, [migration], { log: quiet });
      expect(
        await db.collection("source").countDocuments({ expanded: true }),
      ).toBe(2);
    }));
  test("batch failures resume matching source hash; changed source discards old checkpoint", async () =>
    fixture(async (db) => {
      const ids = [new ObjectId(), new ObjectId(), new ObjectId()];
      await db.collection("source").insertMany(ids.map((_id) => ({ _id })));
      let crash = true;
      let visits = 0;
      const migration: Migration = {
        ...base,
        source: "version1",
        async up(ctx) {
          await ctx.batch({
            name: "source",
            operations: (docs) => {
              if (crash && ++visits === 2) throw new Error("crash");
              return docs.map((doc) => ({
                updateOne: {
                  filter: { _id: doc._id },
                  update: { $inc: { visits: 1 } },
                },
              }));
            },
          });
        },
      };
      await expect(
        runMigrations(client, db, [migration], { batchSize: 1, log: quiet }),
      ).rejects.toThrow("crash");
      crash = false;
      await runMigrations(client, db, [migration], {
        batchSize: 1,
        log: quiet,
      });
      expect(
        (await db.collection("source").find().toArray()).map(
          (doc) => doc.visits,
        ),
      ).toEqual([1, 1, 1]);
      await db.collection<MigrationState>("_migrations").updateOne(
        { _id: base.id },
        {
          $set: {
            status: "failed",
            stage: "batching",
            checkpoint: { data_source__source: ids.at(-1) ?? new ObjectId() },
          },
        },
      );
      await runMigrations(client, db, [{ ...migration, source: "version2" }], {
        log: quiet,
      });
      expect(
        (await db.collection("source").find().toArray()).map(
          (doc) => doc.visits,
        ),
      ).toEqual([2, 2, 2]);
    }));
  test("status writes are fenced after takeover and never hide the original error", async () =>
    fixture(async (db) => {
      const steal = async () => {
        await db.collection<MigrationState>("_migrations").updateOne(
          { _id: "lock" },
          {
            $set: {
              holder: "replacement",
              expiresAt: new Date(Date.now() + 60000),
            },
          },
        );
        await db
          .collection<MigrationState>("_migrations")
          .updateOne({ _id: base.id }, { $set: { status: "paused" } });
      };
      await expect(
        runMigrations(
          client,
          db,
          [
            {
              ...base,
              async verify() {
                await steal();
                return ok();
              },
            },
          ],
          { log: quiet },
        ),
      ).rejects.toThrow("lease lost");
      expect(
        (
          await db
            .collection<MigrationState>("_migrations")
            .findOne({ _id: base.id })
        )?.status,
      ).toBe("paused");
      await db
        .collection<MigrationState>("_migrations")
        .updateOne(
          { _id: "lock" },
          { $set: { holder: null, expiresAt: new Date(0) } },
        );
      await db
        .collection<MigrationState>("_migrations")
        .deleteOne({ _id: base.id });
      const original = new Error("original migration failure");
      let caught: unknown;
      try {
        await runMigrations(
          client,
          db,
          [
            {
              ...base,
              async up() {
                await steal();
                throw original;
              },
            },
          ],
          { log: quiet },
        );
      } catch (error) {
        caught = error;
      }
      expect(caught).toBe(original);
      expect(
        (
          await db
            .collection<MigrationState>("_migrations")
            .findOne({ _id: base.id })
        )?.status,
      ).toBe("paused");
      expect(
        (
          await db
            .collection<MigrationState>("_migrations")
            .findOne({ _id: "lock" })
        )?.holder,
      ).toBe("replacement");
    }));
  test("lease acquisition, heartbeat and fencing use server time despite client clock skew", async () =>
    fixture(async (db) => {
      const now = spyOn(Date, "now").mockReturnValue(0);
      try {
        await runMigrations(
          client,
          db,
          [
            {
              ...base,
              async up() {
                const states = db.collection<MigrationState>("_migrations");
                const first = await states.findOne({ _id: "lock" });
                const server = await db.admin().command({ hello: 1 });
                expect(first?.expiresAt).toBeInstanceOf(Date);
                expect(first?.expiresAt?.getTime()).toBeGreaterThan(
                  server.localTime.getTime(),
                );
                await Bun.sleep(150);
                const renewed = await states.findOne({ _id: "lock" });
                expect(renewed?.expiresAt?.getTime()).toBeGreaterThan(
                  first?.expiresAt?.getTime() ?? 0,
                );
                now.mockReturnValue(8640000000000000);
                await expect(
                  runMigrations(client, db, [base], { log: quiet }),
                ).rejects.toThrow("lock held");
              },
            },
          ],
          { leaseMs: 300, log: quiet },
        );
        expect(
          (
            await db
              .collection<MigrationState>("_migrations")
              .findOne({ _id: base.id })
          )?.status,
        ).toBe("applied");
      } finally {
        now.mockRestore();
      }
    }));
  test("time-series batch retries after insert-before-checkpoint crash without duplicate legacyIds", async () =>
    fixture(async (db) => {
      const ids = [new ObjectId(), new ObjectId(), new ObjectId()];
      await db.collection("clicks").insertMany(ids.map((_id) => ({ _id })));
      await db.createCollection("click_events", {
        timeseries: {
          timeField: "ts",
          metaField: "m",
          bucketMaxSpanSeconds: 86400,
          bucketRoundingSeconds: 86400,
        },
      });
      // Simulate a crashed insert window: events committed, checkpoint not written.
      await db.collection("click_events").insertMany(
        ids.slice(0, 2).map((legacyId) => ({
          legacyId,
          ts: new Date(),
          m: { kind: "click" },
        })),
      );
      const migration: Migration = {
        ...base,
        continuous: true,
        async up(ctx) {
          await ctx.batch({
            name: "clicks",
            target: "click_events",
            mode: "time-series",
            operations: (docs) =>
              docs.flatMap((doc) =>
                [0, 1].map(() => ({
                  insertOne: {
                    document: {
                      legacyId: doc._id,
                      ts: new Date(),
                      m: { kind: "click" },
                    },
                  },
                })),
              ),
          });
        },
      };
      await runMigrations(client, db, [migration], {
        batchSize: 2,
        log: quiet,
      });
      await runMigrations(client, db, [migration], {
        batchSize: 1,
        log: quiet,
      });
      expect(await db.collection("click_events").countDocuments()).toBe(3);
      for (const legacyId of ids)
        expect(
          await db.collection("click_events").countDocuments({ legacyId }),
        ).toBe(1);
      await expect(
        runMigrations(
          client,
          db,
          [
            {
              ...base,
              id: "0002-wrong-mode",
              async up(ctx) {
                await ctx.batch({
                  name: "clicks",
                  target: "click_events",
                  operations: () => [],
                });
              },
            },
          ],
          { log: quiet },
        ),
      ).rejects.toThrow("mode: time-series");
    }));
  test("archive retries preserve original copies; contract dry-run writes nothing and redacts document values", async () =>
    fixture(async (db) => {
      const _id = new ObjectId();
      await db.collection("source").insertOne({
        _id,
        passwordHash: "sensitive-password",
        ip: "sensitive-ip",
      });
      let fail = true;
      const migration: Migration = {
        ...base,
        phase: "contract",
        async up(ctx) {
          await ctx.archive("source");
          await ctx.batch({
            name: "source",
            operations: (docs) =>
              docs.map((doc) => ({
                updateOne: {
                  filter: { _id: doc._id },
                  update: { $set: { passwordHash: "modified-password" } },
                },
              })),
          });
        },
        async verify() {
          return {
            ...ok(),
            ok: !fail,
            samples: [{ passwordHash: "sensitive-report" }],
          };
        },
      };
      const before = await db.listCollections().toArray();
      const logs: string[] = [];
      await runMigrations(client, db, [migration], {
        dryRun: true,
        confirmContract: true,
        log: (message) => logs.push(message),
      });
      expect(await db.listCollections().toArray()).toEqual(before);
      expect(logs.join()).not.toMatch(
        /sensitive-password|sensitive-ip|modified-password|sensitive-report/,
      );
      expect(logs.join()).toContain("passwordHash");
      await expect(
        runMigrations(client, db, [migration], {
          confirmContract: true,
          log: quiet,
        }),
      ).rejects.toThrow("Verification failed");
      fail = false;
      await runMigrations(client, db, [migration], {
        confirmContract: true,
        log: quiet,
      });
      expect(
        (await db.collection(`archive_source_${base.id}`).findOne({ _id }))
          ?.passwordHash,
      ).toBe("sensitive-password");
      expect(
        (await db.collection("source").findOne({ _id }))?.passwordHash,
      ).toBe("modified-password");
    }));
});
