import { expect, test } from "bun:test";
import { MongoClient } from "mongodb";
import { physicalNames } from "./collections";
import { productionMigrations, runMigrations } from "./migrations";
const mongo = process.env.MONGO_TEST_URL;
(mongo ? test : test.skip)(
  "destination-host migration backfills legacy documents and can run again",
  async () => {
    const client = await new MongoClient(mongo!).connect();
    const db = client.db(
      `shortn_host_migration_${crypto.randomUUID().replaceAll("-", "")}`,
    );
    try {
      const links = db.collection(physicalNames.links);
      await links.insertMany([
        { longUrl: "https://Login.Example.COM./path" },
        { longUrl: "https://example.org" },
        { longUrl: "javascript:alert(1)", destHostRev: "stale" },
      ]);
      const migration = productionMigrations.find(
        (m) => m.id === "0013-link-dest-host",
      );
      if (!migration) throw new Error("Missing host migration");
      await runMigrations(client, db, [migration], {
        batchSize: 2,
        batchDelayMs: 0,
      });
      const first = await links.find({}).sort({ _id: 1 }).toArray();
      expect(first[0]?.destHostRev).toBe("com.example.login");
      expect(first[1]?.destHostRev).toBe("org.example");
      expect(first[2]?.destHostRev).toBeUndefined();
      expect(first[0]?.longUrl).toBe("https://Login.Example.COM./path");
      await runMigrations(client, db, [migration], {
        batchSize: 2,
        batchDelayMs: 0,
      });
      expect(await links.find({}).sort({ _id: 1 }).toArray()).toEqual(first);
      await runMigrations(client, db, [migration], {
        direction: "down",
        until: "0000",
        confirmDown: true,
        batchSize: 2,
        batchDelayMs: 0,
      });
      expect(
        await links.countDocuments({ destHostRev: { $exists: true } }),
      ).toBe(0);
      await runMigrations(client, db, [migration], {
        direction: "down",
        verifyOnly: true,
      });
    } finally {
      await db.dropDatabase();
      await client.close();
    }
  },
);
