import { beforeAll, afterAll, describe, test, expect } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import mongoose from "mongoose";
import Redis from "ioredis";
import { keys, generationKey } from "@shortn/redis";
import {
  ensurePersonalWorkspace,
  reserveImportQuota,
  releaseImportQuota,
  importReservations,
  createMany,
  createManyQrImports,
  countUsage,
  type ServiceContext,
} from "@shortn/core";
import { loadEntitlements } from "../../packages/billing";
import { desiredIndexes, physicalNames } from "../../packages/db";
import { withLegacyCreation } from "../lib/import-quota";
import UrlV3 from "../models/url/UrlV3";
import QRCodeV2 from "../models/url/QRCodeV2";
const mongo = process.env.MONGO_TEST_URL,
  cache = process.env.REDIS_TEST_URL;
(process.env.LEGACY_QUOTA_INTEGRATION === "1" && mongo && cache
  ? describe
  : describe.skip)(
  "legacy Mongoose and native import quota coordination",
  () => {
    let client: MongoClient, db: Db, redis: Redis;
    beforeAll(async () => {
      if (
        ![mongo, cache].every((url) =>
          ["127.0.0.1", "localhost"].includes(new URL(url!).hostname),
        )
      )
        throw new Error("Loopback fixtures required");
      client = await new MongoClient(mongo!).connect();
      db = client.db(
        `shortn_legacy_quota_${crypto.randomUUID().replaceAll("-", "")}`,
      );
      redis = new Redis(cache!);
      for (const name of [
        physicalNames.links,
        physicalNames.qr_codes,
        physicalNames.tags,
        physicalNames.workspaces,
        physicalNames.workspace_members,
        physicalNames.import_reservations,
        physicalNames.import_receipts,
        physicalNames.webhook_events,
      ])
        await db.collection(name).createIndexes(desiredIndexes[name]!);
      await mongoose.connect(mongo!, {
        dbName: db.databaseName,
        autoIndex: false,
      });
      await Promise.all([UrlV3.init(), QRCodeV2.init()]);
    });
    afterAll(async () => {
      if (db && redis)
        for await (const link of db
          .collection(physicalNames.links)
          .find(
            { domain: { $exists: true } },
            { projection: { domain: 1, key: 1, urlCode: 1 } },
          )
          .batchSize(100)) {
          const key = keys.link(link.domain, link.key ?? link.urlCode);
          await redis.unlink(key, generationKey(key));
        }
      await mongoose.disconnect();
      await db?.dropDatabase();
      await client?.close();
      redis?.disconnect();
    });
    async function context(
      sub = `legacy|${crypto.randomUUID()}`,
    ): Promise<ServiceContext> {
      const userId = new ObjectId().toHexString(),
        workspace = await ensurePersonalWorkspace(db, {
          id: userId,
          sub,
          name: "Synthetic legacy owner",
        });
      return {
        db,
        cache: redis,
        workspace,
        actor: { userId, role: "owner" },
        linkDomain: `legacy-${crypto.randomUUID()}.invalid`,
      };
    }
    async function legacyLink(sub: string) {
      return withLegacyCreation(sub, "links", async (session) => {
        const [doc] = await UrlV3.create(
          [
            {
              sub,
              urlCode: crypto.randomUUID(),
              longUrl: "https://example.com/legacy",
            },
          ],
          { session },
        );
        return doc!;
      });
    }
    async function legacyQr(sub: string, fail = false) {
      return withLegacyCreation(sub, "qrCodes", async (session) => {
        const code = crypto.randomUUID(),
          publicId = crypto.randomUUID();
        await UrlV3.create(
          [
            {
              sub,
              urlCode: code,
              longUrl: "https://example.com/qr",
              isQrCode: true,
              qrCodeId: publicId,
            },
          ],
          { session },
        );
        if (fail) throw new Error("synthetic-QR-write-failure");
        const [doc] = await QRCodeV2.create(
          [
            {
              sub,
              urlId: code,
              qrCodeId: publicId,
              longUrl: "https://example.com/qr",
            },
          ],
          { session },
        );
        return doc!;
      });
    }
    test("driver-owned Mongoose sessions retain defaults and existing behavior before any accepted import", async () => {
      const ctx = await context(),
        sub = ctx.workspace.legacySub!;
      for (let index = 0; index < 6; index++)
        expect((await legacyLink(sub)).ok).toBe(true);
      const doc = await db.collection(physicalNames.links).findOne({ sub });
      expect(doc).toMatchObject({
        isQrCode: false,
        passwordProtected: false,
        safetyStatus: "pending",
        requiresInterstitial: false,
        tags: [],
        clicks: { total: 0 },
      });
      expect(doc?.date).toBeInstanceOf(Date);
      expect(
        (
          await db
            .collection(physicalNames.workspaces)
            .findOne({ _id: ctx.workspace._id })
        )?.importQuotaCoordinated,
      ).toBeUndefined();
    });
    test("an accepted whole-import hold refuses a legacy write without creating a document", async () => {
      const ctx = await context(),
        id = new ObjectId().toHexString();
      await reserveImportQuota(ctx, id, "links", 5);
      expect(await legacyLink(ctx.workspace.legacySub!)).toMatchObject({
        error: "limit_reached",
        detail: { limit: 5, used: 0, reserved: 5, requested: 1, available: 0 },
      });
      expect(await UrlV3.countDocuments({ sub: ctx.workspace.legacySub })).toBe(
        0,
      );
      await releaseImportQuota(ctx, id);
      expect((await legacyLink(ctx.workspace.legacySub!)).ok).toBe(true);
    });
    test("shared document quota remains authoritative after imported rows consume the hold", async () => {
      const ctx = await context(),
        id = new ObjectId().toHexString();
      await reserveImportQuota(ctx, id, "links", 5);
      expect(
        (
          await createMany(
            ctx,
            Array.from({ length: 5 }, (_, index) => ({
              url: `https://example.com/import-${index}`,
            })),
            { id, offset: 0 },
          )
        ).ok,
      ).toBe(true);
      expect(await legacyLink(ctx.workspace.legacySub!)).toMatchObject({
        error: "limit_reached",
        detail: { used: 5, reserved: 0 },
      });
      expect(await UrlV3.countDocuments({ sub: ctx.workspace.legacySub })).toBe(
        5,
      );
    });
    test("concurrent legacy creates, v2 creates and reservations cannot consume the same free capacity", async () => {
      const ctx = await context(),
        id = new ObjectId().toHexString();
      await reserveImportQuota(ctx, id, "links", 3);
      const results = await Promise.all([
        legacyLink(ctx.workspace.legacySub!),
        legacyLink(ctx.workspace.legacySub!),
        legacyLink(ctx.workspace.legacySub!),
        createMany(ctx, [{ url: "https://example.com/v2" }]),
      ]);
      expect(results.filter((result) => result.ok)).toHaveLength(2);
      const used = await countUsage(
        db,
        ctx.workspace,
        (await loadEntitlements(db, ctx.workspace._id)).period,
      );
      expect(used.links).toBe(2);
      expect(
        (await importReservations(db).findOne({ _id: new ObjectId(id) }))
          ?.remaining,
      ).toBe(3);
    });
    test("QR holds protect both halves and remain independent of link quota", async () => {
      const ctx = await context(),
        id = new ObjectId().toHexString();
      await reserveImportQuota(ctx, id, "qrCodes", 5);
      expect(await legacyQr(ctx.workspace.legacySub!)).toMatchObject({
        error: "limit_reached",
      });
      expect(
        await QRCodeV2.countDocuments({ sub: ctx.workspace.legacySub }),
      ).toBe(0);
      expect(await UrlV3.countDocuments({ sub: ctx.workspace.legacySub })).toBe(
        0,
      );
      expect((await legacyLink(ctx.workspace.legacySub!)).ok).toBe(true);
      expect(
        (
          await createManyQrImports(
            ctx,
            Array.from({ length: 5 }, () => ({
              url: "https://example.com/import-qr",
            })),
            { id, offset: 0 },
          )
        ).ok,
      ).toBe(true);
      expect(await legacyQr(ctx.workspace.legacySub!)).toMatchObject({
        error: "limit_reached",
        detail: { used: 5, reserved: 0 },
      });
    });
    test("a failed legacy QR second write rolls back its backing document", async () => {
      const ctx = await context();
      await expect(legacyQr(ctx.workspace.legacySub!, true)).rejects.toThrow(
        "synthetic-QR-write-failure",
      );
      expect(await UrlV3.countDocuments({ sub: ctx.workspace.legacySub })).toBe(
        0,
      );
      expect(
        await QRCodeV2.countDocuments({ sub: ctx.workspace.legacySub }),
      ).toBe(0);
      expect((await legacyQr(ctx.workspace.legacySub!)).ok).toBe(true);
    });
    test("identity locking covers a legacy create that begins before workspace provisioning", async () => {
      const sub = `legacy|${crypto.randomUUID()}`;
      let entered!: () => void, release!: () => void;
      const started = new Promise<void>((resolve) => {
          entered = resolve;
        }),
        gate = new Promise<void>((resolve) => {
          release = resolve;
        });
      const writing = withLegacyCreation(sub, "links", async (session) => {
        entered();
        await gate;
        const [doc] = await UrlV3.create(
          [
            {
              sub,
              urlCode: crypto.randomUUID(),
              longUrl: "https://example.com/first",
            },
          ],
          { session },
        );
        return doc!;
      });
      await started;
      const ctx = await context(sub),
        reservation = reserveImportQuota(
          ctx,
          new ObjectId().toHexString(),
          "links",
          5,
        );
      release();
      expect((await writing).ok).toBe(true);
      expect(await reservation).toMatchObject({
        error: "limit_reached",
        detail: { used: 1, requested: 5 },
      });
    });
  },
);
