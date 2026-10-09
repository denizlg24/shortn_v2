import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId } from "mongodb";
import type { Db } from "mongodb";
import { desiredIndexes, syncIndexes } from "./indexes";
import { exampleMigration } from "./migrations/example.fixture";
import { runMigrations } from "./migrations/runner";
import type { Migration, MigrationState } from "./migrations/runner";
const url = process.env.MONGO_TEST_URL;
if (!url)
  console.log(
    "SKIP Mongo integration: set MONGO_TEST_URL to a local MongoDB replica set (docker-compose.test.yml)",
  );
const quiet = () => {};
(url ? describe : describe.skip)("MongoDB replica-set integration", () => {
  let client: MongoClient;
  let db: Db;
  beforeAll(async () => {
    if (!url) throw new Error("MONGO_TEST_URL missing");
    const host = new URL(url).hostname;
    if (!["localhost", "127.0.0.1", "mongo"].includes(host))
      throw new Error(
        "Integration tests only connect to local fixture services",
      );
    client = await new MongoClient(url, {
      serverSelectionTimeoutMS: 10_000,
    }).connect();
    const hello = await client.db("admin").command({ hello: 1 });
    if (!hello.setName)
      throw new Error("Integration tests require a real replica set");
  }, 15_000);
  afterAll(async () => {
    await client?.close();
  });
  async function fixture() {
    db = client.db(
      `shortn_foundation_test_${crypto.randomUUID().replaceAll("-", "")}`,
    );
    await db
      .collection("migration_examples")
      .insertMany(Array.from({ length: 7 }, () => ({ _id: new ObjectId() })));
    return db;
  }
  test("up → verify → down → up, and applied up is idempotent", async () => {
    await fixture();
    try {
      await runMigrations(client, db, [exampleMigration], {
        batchSize: 2,
        log: quiet,
      });
      await runMigrations(client, db, [exampleMigration], {
        verifyOnly: true,
        log: quiet,
      });
      expect(
        await db
          .collection("migration_examples")
          .countDocuments({ expanded: true }),
      ).toBe(7);
      const applied = await db
        .collection<MigrationState>("_migrations")
        .findOne({ id: exampleMigration.id });
      await runMigrations(client, db, [exampleMigration], { log: quiet });
      expect(
        await db
          .collection<MigrationState>("_migrations")
          .findOne({ id: exampleMigration.id }),
      ).toEqual(applied);
      await runMigrations(client, db, [exampleMigration], {
        direction: "down",
        batchSize: 2,
        log: quiet,
      });
      expect(
        await db
          .collection("migration_examples")
          .countDocuments({ expanded: true }),
      ).toBe(0);
      await runMigrations(client, db, [exampleMigration], { log: quiet });
      expect(
        await db
          .collection("migration_examples")
          .countDocuments({ expanded: true }),
      ).toBe(7);
    } finally {
      await db.dropDatabase();
    }
  });
  test("dry-run writes neither documents nor migration state; verify-only is read-only", async () => {
    await fixture();
    try {
      const before = await db.collection("migration_examples").find().toArray();
      await runMigrations(client, db, [exampleMigration], {
        dryRun: true,
        log: quiet,
      });
      expect(
        await db.collection("migration_examples").find().toArray(),
      ).toEqual(before);
      expect(await db.listCollections({ name: "_migrations" }).hasNext()).toBe(
        false,
      );
      await expect(
        runMigrations(client, db, [exampleMigration], {
          verifyOnly: true,
          log: quiet,
        }),
      ).rejects.toThrow("Verification failed");
      expect(await db.listCollections({ name: "_migrations" }).hasNext()).toBe(
        false,
      );
    } finally {
      await db.dropDatabase();
    }
  });
  test("contention fails while a runner holds the lease; an expired lease is reclaimable", async () => {
    await fixture();
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered: (() => void) | undefined;
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const blocking = {
      ...exampleMigration,
      async up() {
        entered?.();
        await gate;
      },
      async verify() {
        return { ok: true, counts: {}, samples: [], discrepancies: [] };
      },
    };
    const first = runMigrations(client, db, [blocking], { log: quiet });
    try {
      await ready;
      await expect(
        runMigrations(client, db, [exampleMigration], { log: quiet }),
      ).rejects.toThrow("lock held");
      release?.();
      await first;
      await db
        .collection<MigrationState>("_migrations")
        .updateOne(
          { _id: "lock" },
          { $set: { holder: "crashed-runner", expiresAt: new Date(0) } },
        );
      await runMigrations(
        client,
        db,
        [{ ...exampleMigration, continuous: true }],
        { log: quiet },
      );
      expect(
        await db
          .collection("migration_examples")
          .countDocuments({ expanded: true }),
      ).toBe(7);
    } finally {
      release?.();
      await first;
      await db.dropDatabase();
    }
  });
  test("resume after crash mid-batch uses committed checkpoint and retries incomplete batch", async () => {
    await fixture();
    let batches = 0;
    const crashing: Migration = {
      ...exampleMigration,
      async up(ctx) {
        await ctx.batch({
          name: "migration_examples",
          filter: { expanded: { $exists: false } },
          operations: (docs) => {
            if (++batches === 2) throw new Error("simulated crash mid-batch");
            return docs.map((doc) => ({
              updateOne: {
                filter: { _id: doc._id },
                update: { $set: { expanded: true } },
              },
            }));
          },
        });
      },
    };
    try {
      await expect(
        runMigrations(client, db, [crashing], { batchSize: 2, log: quiet }),
      ).rejects.toThrow("simulated crash");
      expect(
        await db
          .collection("migration_examples")
          .countDocuments({ expanded: true }),
      ).toBe(2);
      const state = await db
        .collection<MigrationState>("_migrations")
        .findOne({ id: exampleMigration.id });
      expect(state?.checkpoint?.data_migration_examples).toBeInstanceOf(
        ObjectId,
      );
      await runMigrations(client, db, [exampleMigration], {
        batchSize: 2,
        log: quiet,
      });
      expect(
        await db
          .collection("migration_examples")
          .countDocuments({ expanded: true }),
      ).toBe(7);
    } finally {
      await db.dropDatabase();
    }
  });
  test("a database failure mid-batch rolls back data and checkpoint together", async () => {
    await fixture();
    const failing: Migration = {
      ...exampleMigration,
      async up(ctx) {
        await ctx.batch({
          name: "migration_examples",
          operations: (docs) => {
            const first = docs[0];
            if (!first) throw new Error("Missing fixture");
            return [
              {
                updateOne: {
                  filter: { _id: first._id },
                  update: { $set: { expanded: true } },
                },
              },
              { insertOne: { document: { _id: first._id } } },
            ];
          },
        });
      },
    };
    try {
      await expect(
        runMigrations(client, db, [failing], { log: quiet }),
      ).rejects.toThrow();
      expect(
        await db
          .collection("migration_examples")
          .countDocuments({ expanded: true }),
      ).toBe(0);
      expect(
        (
          await db
            .collection<MigrationState>("_migrations")
            .findOne({ id: exampleMigration.id })
        )?.checkpoint,
      ).toEqual({});
      await runMigrations(client, db, [exampleMigration], { log: quiet });
      expect(
        await db
          .collection("migration_examples")
          .countDocuments({ expanded: true }),
      ).toBe(7);
    } finally {
      await db.dropDatabase();
    }
  });

  test("a stolen lease fences writes from the old runner", async () => {
    await fixture();
    const stolen: Migration = {
      ...exampleMigration,
      async up(ctx) {
        await ctx.batch({
          name: "migration_examples",
          operations: async (docs) => {
            await db.collection<MigrationState>("_migrations").updateOne(
              { _id: "lock" },
              {
                $set: {
                  holder: "new-owner",
                  expiresAt: new Date(Date.now() + 60_000),
                },
              },
            );
            return docs.map((doc) => ({
              updateOne: {
                filter: { _id: doc._id },
                update: { $set: { expanded: true } },
              },
            }));
          },
        });
      },
    };
    try {
      await expect(
        runMigrations(client, db, [stolen], { log: quiet }),
      ).rejects.toThrow("lease lost");
      expect(
        await db
          .collection("migration_examples")
          .countDocuments({ expanded: true }),
      ).toBe(0);
      expect(
        (
          await db
            .collection<MigrationState>("_migrations")
            .findOne({ _id: "lock" })
        )?.holder,
      ).toBe("new-owner");
    } finally {
      await db.dropDatabase();
    }
  });

  test("verification cannot mutate data through batch or aggregation", async () => {
    await fixture();
    try {
      const badVerify: Migration = {
        ...exampleMigration,
        async verify(ctx) {
          await ctx.batch({ name: "migration_examples", operations: () => [] });
          return { ok: true, counts: {}, samples: [], discrepancies: [] };
        },
      };
      await expect(
        runMigrations(client, db, [badVerify], { log: quiet }),
      ).rejects.toThrow("Verify is read-only");
      const badAggregate: Migration = {
        ...exampleMigration,
        async up(ctx) {
          await ctx
            .read("migration_examples")
            .aggregate([{ $out: "bad" }])
            .toArray();
        },
      };
      await expect(
        runMigrations(client, db, [badAggregate], { dryRun: true, log: quiet }),
      ).rejects.toThrow("cannot use");
      expect(await db.listCollections({ name: "bad" }).hasNext()).toBe(false);
    } finally {
      await db.dropDatabase();
    }
  });

  test("contract is refused before writes and requires archive even with confirmation", async () => {
    await fixture();
    const contract: Migration = { ...exampleMigration, phase: "contract" };
    try {
      await expect(
        runMigrations(client, db, [contract], { log: quiet }),
      ).rejects.toThrow("--confirm-contract");
      expect(await db.listCollections({ name: "_migrations" }).hasNext()).toBe(
        false,
      );
      await expect(
        runMigrations(client, db, [contract], {
          confirmContract: true,
          log: quiet,
        }),
      ).rejects.toThrow("verified archive");
      const archived: Migration = {
        ...contract,
        async up(ctx) {
          await ctx.archive("migration_examples");
          await exampleMigration.up(ctx);
        },
      };
      await runMigrations(client, db, [archived], {
        confirmContract: true,
        log: quiet,
      });
      expect(
        await db
          .collection(`archive_migration_examples_${contract.id}`)
          .countDocuments(),
      ).toBe(7);
    } finally {
      await db.dropDatabase();
    }
  });
  test("continuous catches newly written documents and until bounds execution", async () => {
    await fixture();
    try {
      const next = { ...exampleMigration, id: "0002-next" };
      await runMigrations(client, db, [exampleMigration, next], {
        until: exampleMigration.id,
        log: quiet,
      });
      expect(
        await db
          .collection<MigrationState>("_migrations")
          .findOne({ id: next.id }),
      ).toBeNull();
      await db
        .collection("migration_examples")
        .insertOne({ _id: new ObjectId() });
      await runMigrations(
        client,
        db,
        [{ ...exampleMigration, continuous: true }],
        { log: quiet },
      );
      expect(
        await db
          .collection("migration_examples")
          .countDocuments({ expanded: true }),
      ).toBe(8);
    } finally {
      await db.dropDatabase();
    }
  });
  test("index sync is create-only, idempotent and compatible with multiple legacy inserts", async () => {
    await fixture();
    try {
      await db
        .collection("urlv3s")
        .createIndex({ legacyOnly: 1 }, { name: "keep_me" });
      const before = await db.listCollections().toArray();
      const messages: string[] = [];
      await syncIndexes(db, {
        dryRun: true,
        log: (message) => messages.push(message),
      });
      expect(await db.listCollections().toArray()).toEqual(before);
      expect(
        await db.collection("urlv3s").listIndexes().toArray(),
      ).toHaveLength(2);
      await syncIndexes(db, { log: (message) => messages.push(message) });
      await syncIndexes(db, { log: quiet });
      expect(
        messages.some(
          (message) =>
            message.includes("drop suggestion") && message.includes("keep_me"),
        ),
      ).toBe(true);
      for (const name of ["urlv3s", "biopages", "tags", "qrcodesv2"])
        await db
          .collection(name)
          .insertMany([{ _id: new ObjectId() }, { _id: new ObjectId() }]);
      await db
        .collection("urlv3s")
        .insertOne({ domain: "shortn.at", key: "AbC" });
      await db
        .collection("urlv3s")
        .insertOne({ domain: "shortn.at", key: "abc" });
      await expect(
        db.collection("urlv3s").insertOne({ domain: "shortn.at", key: "abc" }),
      ).rejects.toThrow("E11000");
      expect(
        (await db.collection("urlv3s").listIndexes().toArray()).some(
          (index) => index.name === "keep_me",
        ),
      ).toBe(true);
      expect(
        (await db.collection("biopages").listIndexes().toArray()).find(
          (index) => index.name === "v2_bio_handle",
        )?.partialFilterExpression,
      ).toEqual(desiredIndexes.biopages?.[0]?.partialFilterExpression);
      const images = await db
        .listCollections({ name: "urlv3s" }, { nameOnly: false })
        .next();
      expect(images?.options?.changeStreamPreAndPostImages?.enabled).toBe(true);
      const timeseries = await db
        .listCollections({ name: "click_events" }, { nameOnly: false })
        .next();
      expect(timeseries?.options?.timeseries?.bucketMaxSpanSeconds).toBe(86400);
      expect(timeseries?.options?.expireAfterSeconds).toBeUndefined();
    } finally {
      await db.dropDatabase();
    }
  }, 30_000);
});
