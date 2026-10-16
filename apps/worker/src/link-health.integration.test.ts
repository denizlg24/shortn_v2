import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { Redis } from "ioredis";
import { collection, desiredIndexes, physicalNames } from "@shortn/db";
import {
  createLink,
  createQr,
  updateLink,
  getLink,
  ensurePersonalWorkspace,
  healthTargets,
  toCachedLink,
  decide,
  type ServiceContext,
} from "@shortn/core";
import { createHealthWorker, runHealthCheck } from "./link-health";
import {
  healthHostKey,
  reserveHealthHost,
  type HealthProbeResult,
} from "./health-probe";
const mongo = process.env.MONGO_TEST_URL,
  redisUrl = process.env.REDIS_DURABLE_TEST_URL;
(mongo && redisUrl ? describe : describe.skip)(
  "durable destination health",
  () => {
    let client: MongoClient, db: Db, durable: Redis;
    beforeAll(async () => {
      if (
        ![mongo, redisUrl].every((url) =>
          ["localhost", "127.0.0.1"].includes(new URL(url!).hostname),
        )
      )
        throw new Error("Loopback fixtures required");
      client = await new MongoClient(mongo!).connect();
      db = client.db(
        `shortn_health_${crypto.randomUUID().replaceAll("-", "")}`,
      );
      durable = new Redis(redisUrl!);
      await db
        .collection(physicalNames.links)
        .createIndexes(desiredIndexes[physicalNames.links]!);
    });
    afterAll(async () => {
      await db?.dropDatabase();
      await client?.close();
      durable?.disconnect();
    });
    async function context(): Promise<ServiceContext> {
      const userId = new ObjectId().toHexString();
      return {
        db,
        cache: durable,
        workspace: await ensurePersonalWorkspace(db, {
          id: userId,
          name: "Health",
        }),
        actor: { userId, role: "owner" },
        linkDomain: "shortn.at",
      };
    }
    async function fixture(rules?: Parameters<typeof createLink>[1]["rules"]) {
      const ctx = await context(),
        created = await createLink(ctx, {
          url: "https://example.com/main",
          ...(rules ? { rules } : {}),
        });
      if (!created.ok) throw new Error(created.error);
      return {
        ctx,
        id: new ObjectId(created.value.id),
        key: created.value.key,
      };
    }
    async function check(id: ObjectId, result: HealthProbeResult) {
      const row = (await collection(db, "links").findOne({ _id: id }))!;
      await collection(db, "links").updateOne(
        { _id: id },
        { $set: { "health.nextAt": new Date(0) } },
      );
      await runHealthCheck(
        { db, durable, probe: async () => result },
        String(id),
        row.health!.generation,
        row.health!.iteration,
      );
    }
    test("checks every configured HTTP target in bounded steps, persists a weekly schedule and seeds QR backing links", async () => {
      const rules = {
        expiredUrl: "https://example.com/closed",
        device: [{ os: "ios" as const, url: "https://example.com/device" }],
        rotation: [{ url: "https://example.com/a", weight: 1 }],
        deepLink: {
          ios: "youtube://watch",
          android: "https://example.com/android",
          fallback: "store" as const,
          store: {
            ios: "https://apps.apple.com/app/id123",
            android: "https://play.google.com/store/apps/details?id=example",
          },
        },
      };
      const { ctx, id } = await fixture(rules);
      let row = (await collection(db, "links").findOne({ _id: id }))!;
      const targets = healthTargets(row.longUrl!, row.rules);
      expect(targets).toHaveLength(7);
      expect(targets.every((url) => url.startsWith("https:"))).toBe(true);
      for (let n = 0; n < targets.length; n++) {
        await check(id, { status: "ok", httpStatus: 200 });
        row = (await collection(db, "links").findOne({ _id: id }))!;
        expect(row.health!.checks).toHaveLength(n + 1);
      }
      expect(row.health!.nextAt.getTime()).toBeGreaterThan(
        Date.now() + 6 * 86400000,
      );
      expect(row.health!.remaining).toEqual(targets);
      const qr = await createQr(ctx, { url: "https://example.com/qr" });
      if (!qr.ok) throw new Error(qr.error);
      expect(
        (await collection(db, "links").findOne({
          qrCodeId: qr.value.publicId,
        }))!.health!.targets,
      ).toEqual(["https://example.com/qr"]);
    });
    test("HTTP failures build a streak, recovery clears it, and health never changes safety or redirects", async () => {
      const { ctx, id, key } = await fixture();
      await collection(db, "links").updateOne(
        { _id: id },
        { $set: { safetyStatus: "safe", requiresInterstitial: false } },
      );
      await check(id, { status: "http_error", httpStatus: 404 });
      expect((await getLink(ctx, String(id)))!.health!.flagged).toBe(false);
      const first = (await getLink(ctx, String(id)))!.health!.checks[0]!
        .failingSince;
      await check(id, { status: "http_error", httpStatus: 503 });
      const view = (await getLink(ctx, String(id)))!;
      expect(view.health!.flagged).toBe(true);
      expect(view.health!.checks[0]!.failingSince).toBe(first);
      expect(view.safety.disabled).toBe(false);
      expect(view.safety.status).toBe("safe");
      const row = (await collection(db, "links").findOne({ _id: id }))!;
      const cached = toCachedLink(row, key, null);
      expect(cached).not.toHaveProperty("health");
      expect(
        await decide({
          link: cached,
          key,
          origin: "https://shortn.at",
          locale: "en",
          secrets: { legacy: new Uint8Array(32) },
        }),
      ).toMatchObject({
        type: "redirect",
        status: 302,
        location: "https://example.com/main",
      });
      await check(id, { status: "ok", httpStatus: 200 });
      const recovered = (await getLink(ctx, String(id)))!.health!;
      expect(recovered.flagged).toBe(false);
      expect(recovered.checks[0]!.streak).toBe(0);
      expect(recovered.checks[0]!.failingSince).toBeNull();
    });
    test("edits supersede in-flight checks while metadata edits preserve the health generation", async () => {
      const { ctx, id } = await fixture();
      let row = (await collection(db, "links").findOne({ _id: id }))!;
      const generation = row.health!.generation;
      expect(
        (await updateLink(ctx, String(id), { title: "New title" })).ok,
      ).toBe(true);
      expect(
        (await collection(db, "links").findOne({ _id: id }))!.health!
          .generation,
      ).toBe(generation);
      let release!: (result: HealthProbeResult) => void, entered!: () => void;
      const waiting = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const pending = runHealthCheck(
        {
          db,
          durable,
          probe: async () => {
            entered();
            return new Promise((resolve) => {
              release = resolve;
            });
          },
        },
        String(id),
        generation,
        0,
      );
      await waiting;
      expect(
        (await updateLink(ctx, String(id), { url: "https://example.com/new" }))
          .ok,
      ).toBe(true);
      release({ status: "http_error", httpStatus: 404 });
      await pending;
      row = (await collection(db, "links").findOne({ _id: id }))!;
      expect(row.health!.generation).not.toBe(generation);
      expect(row.health!.checks).toEqual([]);
      let called = false;
      await runHealthCheck(
        {
          db,
          durable,
          probe: async () => {
            called = true;
            return { status: "ok" };
          },
        },
        String(id),
        generation,
        0,
      );
      expect(called).toBe(false);
    });
    test("rate and infrastructure deferrals preserve the cursor; expired lease replacement fences old writes", async () => {
      const { id } = await fixture();
      await check(id, { retryAfter: 3000 });
      let row = (await collection(db, "links").findOne({ _id: id }))!;
      expect(row.health!.checks).toEqual([]);
      expect(row.health!.iteration).toBe(0);
      await collection(db, "links").updateOne(
        { _id: id },
        { $set: { "health.nextAt": new Date(0) } },
      );
      await runHealthCheck(
        {
          db,
          durable,
          probe: async () => {
            throw new Error("secret must never persist");
          },
        },
        String(id),
        row.health!.generation,
        0,
      );
      row = (await collection(db, "links").findOne({ _id: id }))!;
      expect(row.health!.lastError).toBe("probe_failed");
      expect(row.health!.remaining).toHaveLength(1);
      expect(JSON.stringify(row.health)).not.toContain("secret");
      await collection(db, "links").updateOne(
        { _id: id },
        { $set: { "health.nextAt": new Date(0) } },
      );
      let release!: (result: HealthProbeResult) => void, entered!: () => void;
      const waiting = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const pending = runHealthCheck(
        {
          db,
          durable,
          probe: async () => {
            entered();
            return new Promise((resolve) => {
              release = resolve;
            });
          },
        },
        String(id),
        row.health!.generation,
        0,
      );
      await waiting;
      await collection(db, "links").updateOne(
        { _id: id },
        {
          $set: {
            "health.token": "replacement",
            "health.leaseUntil": new Date(Date.now() + 60000),
          },
        },
      );
      release({ status: "http_error", httpStatus: 404 });
      await pending;
      expect(
        (await collection(db, "links").findOne({ _id: id }))!.health!.checks,
      ).toEqual([]);
    });
    test("legacy destination edits hide old results and reseed before any network request", async () => {
      const { ctx, id } = await fixture();
      await check(id, { status: "http_error", httpStatus: 404 });
      const row = (await collection(db, "links").findOne({ _id: id }))!;
      await collection(db, "links").updateOne(
        { _id: id },
        {
          $set: {
            longUrl: "https://example.com/legacy",
            "health.nextAt": new Date(0),
          },
        },
      );
      expect((await getLink(ctx, String(id)))!.health).toBeUndefined();
      let called = false;
      await runHealthCheck(
        {
          db,
          durable,
          probe: async () => {
            called = true;
            return { status: "ok" };
          },
        },
        String(id),
        row.health!.generation,
        row.health!.iteration,
      );
      expect(called).toBe(false);
      const reset = (await collection(db, "links").findOne({ _id: id }))!
        .health!;
      expect(reset.generation).not.toBe(row.health!.generation);
      expect(reset.targets).toEqual(["https://example.com/legacy"]);
      expect(reset.checks).toEqual([]);
    });
    test("host reservations are shared, bounded and normalize trailing dots", async () => {
      const hostname = `${crypto.randomUUID()}.example.com`,
        key = healthHostKey(hostname);
      try {
        expect(healthHostKey(hostname.toUpperCase() + ".")).toBe(key);
        const results = await Promise.all(
          Array.from({ length: 8 }, () => reserveHealthHost(durable, hostname)),
        );
        const waits = results.flatMap((result) =>
          "wait" in result ? [result.wait] : [],
        );
        expect(waits.length).toBeGreaterThanOrEqual(2);
        expect(waits.length).toBeLessThanOrEqual(3);
        expect(results.some((result) => "retryAfter" in result)).toBe(true);
        expect(await durable.pttl(key)).toBeGreaterThan(0);
      } finally {
        await durable.del(key);
      }
    });
    test("bounded backfill and queue loss/restart recover a large library without loading it all", async () => {
      const rows = Array.from({ length: 1001 }, (_, n) => ({
        _id: new ObjectId(),
        urlCode: `backfill${n}`,
        longUrl: `https://example.com/backfill/${n}`,
      }));
      await db.collection(physicalNames.links).insertMany(rows);
      const name = `health-test-${crypto.randomUUID()}`;
      let service = createHealthWorker({
        db,
        durable,
        queueName: name,
        probe: async () => ({ status: "ok", httpStatus: 200 }),
        log: () => {},
      });
      await service.worker.pause();
      await service.pump();
      expect(
        await collection(db, "links").countDocuments({
          urlCode: /^backfill/,
          "health.generation": { $exists: true },
        }),
      ).toBe(50);
      expect(await service.queue.getWaitingCount()).toBeLessThanOrEqual(50);
      await service.queue.drain(true);
      await service.close();
      service = createHealthWorker({
        db,
        durable,
        queueName: name,
        probe: async () => ({ status: "ok", httpStatus: 200 }),
        log: () => {},
      });
      try {
        for (let n = 0; n < 80; n++) {
          await service.pump();
          if (
            (await collection(db, "links").countDocuments({
              urlCode: /^backfill/,
              "health.checks.0": { $exists: true },
            })) === 1001
          )
            break;
          await Bun.sleep(50);
        }
        expect(
          await collection(db, "links").countDocuments({
            urlCode: /^backfill/,
            "health.checks.0": { $exists: true },
          }),
        ).toBe(1001);
      } finally {
        await service.worker.pause();
        await service.queue.obliterate({ force: true });
        await service.close();
      }
    }, 15000);
  },
);
