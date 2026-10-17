import { beforeAll, afterAll, describe, test, expect } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import Redis from "ioredis";
import { desiredIndexes, physicalNames } from "@shortn/db";
import {
  reserveImportQuota,
  releaseImportQuota,
  importReservations,
  importReceipts,
} from "./quota";
import { createMany, createLink } from "../links/service";
import { createQr } from "../qr/service";
import { ensurePersonalWorkspace } from "../workspaces/service";
import type { ServiceContext } from "../workspaces/context";
const mongo = process.env.MONGO_TEST_URL,
  cache = process.env.REDIS_TEST_URL;
(mongo && cache ? describe : describe.skip)(
  "whole-import quota and atomic row receipts",
  () => {
    let client: MongoClient, db: Db, redis: Redis;
    beforeAll(async () => {
      if (
        ![mongo, cache].every((url) =>
          ["127.0.0.1", "localhost"].includes(new URL(url!).hostname),
        )
      )
        throw new Error("Loopback only");
      client = await new MongoClient(mongo!).connect();
      db = client.db(
        `shortn_import_${crypto.randomUUID().replaceAll("-", "")}`,
      );
      redis = new Redis(cache!);
      for (const name of [
        physicalNames.links,
        physicalNames.tags,
        physicalNames.qr_codes,
        physicalNames.webhook_events,
        physicalNames.import_reservations,
        physicalNames.import_receipts,
      ])
        await db.collection(name).createIndexes(desiredIndexes[name]!);
    });
    afterAll(async () => {
      await db?.dropDatabase();
      await client?.close();
      redis?.disconnect();
    });
    async function context(): Promise<ServiceContext> {
      const userId = new ObjectId().toHexString(),
        workspace = await ensurePersonalWorkspace(db, {
          id: userId,
          sub: `import|${userId}`,
          name: "Synthetic import",
        });
      return {
        db,
        cache: redis,
        workspace,
        actor: { userId, role: "owner" },
        linkDomain: "shortn.invalid",
      };
    }
    const id = () => new ObjectId().toHexString();
    test("refuses a whole import with exact capacity before writes and holds capacity against ordinary creates", async () => {
      const ctx = await context();
      const denied = await reserveImportQuota(ctx, id(), "links", 6);
      expect(denied).toMatchObject({
        ok: false,
        error: "limit_reached",
        detail: { limit: 5, used: 0, reserved: 0, requested: 6, available: 5 },
      });
      expect(
        await db
          .collection(physicalNames.links)
          .countDocuments({ workspaceId: ctx.workspace._id }),
      ).toBe(0);
      const importId = id();
      expect((await reserveImportQuota(ctx, importId, "links", 5)).ok).toBe(
        true,
      );
      expect(
        await createLink(ctx, { url: "https://example.com" }),
      ).toMatchObject({
        ok: false,
        error: "limit_reached",
        detail: { reserved: 5 },
      });
      expect((await reserveImportQuota(ctx, importId, "links", 5)).ok).toBe(
        true,
      );
      expect(
        await importReservations(db).countDocuments({
          workspaceId: ctx.workspace._id,
        }),
      ).toBe(1);
      expect(await reserveImportQuota(ctx, importId, "links", 4)).toMatchObject(
        { error: "invalid_input" },
      );
      expect(await releaseImportQuota(ctx, importId)).toBe(true);
      expect((await createLink(ctx, { url: "https://example.com" })).ok).toBe(
        true,
      );
      expect(await reserveImportQuota(ctx, importId, "links", 5)).toMatchObject(
        { error: "reservation_closed" },
      );
    });
    test("concurrent reservations and single creation cannot overspend", async () => {
      const ctx = await context();
      const results = await Promise.all([
        reserveImportQuota(ctx, id(), "links", 3),
        reserveImportQuota(ctx, id(), "links", 3),
        createMany(ctx, [
          { url: "https://example.com/1" },
          { url: "https://example.com/2" },
          { url: "https://example.com/3" },
        ]),
      ]);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      const held = await importReservations(db)
        .find({ workspaceId: ctx.workspace._id })
        .toArray();
      const actual = await db
        .collection(physicalNames.links)
        .countDocuments({ workspaceId: ctx.workspace._id });
      expect(
        actual + held.reduce((count, row) => count + row.remaining, 0),
      ).toBe(3);
    });
    test("chunk creation, checkpoint and row idempotency replay together after worker replacement", async () => {
      const ctx = await context(),
        importId = id(),
        first = [
          { url: "https://example.com/1", tags: ["Team"] },
          { url: "https://example.com/2" },
        ];
      expect((await reserveImportQuota(ctx, importId, "links", 5)).ok).toBe(
        true,
      );
      await db
        .collection(physicalNames.webhook_endpoints)
        .insertOne({
          workspaceId: ctx.workspace._id,
          enabled: true,
          events: ["link.created"],
        });
      const created = await createMany(ctx, first, { id: importId, offset: 0 });
      expect(created.ok).toBe(true);
      const replacement = { ...ctx };
      const retry = await createMany(replacement, first, {
        id: importId,
        offset: 0,
      });
      expect(retry).toEqual(created);
      expect(
        await importReservations(db).findOne({ _id: new ObjectId(importId) }),
      ).toMatchObject({ consumed: 2, remaining: 3, state: "active" });
      expect(
        await createMany(ctx, [{ url: "https://changed.example" }], {
          id: importId,
          offset: 0,
        }),
      ).toMatchObject({ error: "invalid_input" });
      expect(
        await createMany(ctx, [{ url: "https://example.com/4" }], {
          id: importId,
          offset: 3,
        }),
      ).toMatchObject({ error: "invalid_input" });
      expect(
        await createLink(ctx, { url: "https://example.com/unreserved" }),
      ).toMatchObject({ error: "limit_reached" });
      expect(
        (
          await createMany(
            ctx,
            Array.from({ length: 3 }, (_, index) => ({
              url: `https://example.com/rest-${index}`,
            })),
            { id: importId, offset: 2 },
          )
        ).ok,
      ).toBe(true);
      expect(
        await importReservations(db).findOne({ _id: new ObjectId(importId) }),
      ).toMatchObject({ consumed: 5, remaining: 0, state: "spent" });
      expect(
        await importReceipts(db).countDocuments({
          reservationId: new ObjectId(importId),
        }),
      ).toBe(2);
      expect(
        await db
          .collection(physicalNames.links)
          .countDocuments({ importId: new ObjectId(importId) }),
      ).toBe(5);
      expect(
        await db
          .collection(physicalNames.webhook_events)
          .countDocuments({
            workspaceId: ctx.workspace._id,
            "event.type": "link.created",
          }),
      ).toBe(5);
      expect(await createMany(ctx, first, { id: importId, offset: 0 })).toEqual(
        created,
      );
    });
    test("validation failure does not consume capacity or write partial rows/tags/events", async () => {
      const ctx = await context(),
        importId = id();
      await reserveImportQuota(ctx, importId, "links", 5);
      expect(
        await createMany(
          ctx,
          [
            { url: "https://example.com", tags: ["No partial"] },
            { url: "javascript:alert(1)" },
          ],
          { id: importId, offset: 0 },
        ),
      ).toMatchObject({ ok: false });
      for (const name of [
        physicalNames.links,
        physicalNames.tags,
        physicalNames.webhook_events,
        physicalNames.import_receipts,
      ])
        expect(
          await db
            .collection(name)
            .countDocuments({ workspaceId: ctx.workspace._id }),
        ).toBe(0);
      expect(
        await importReservations(db).findOne({ _id: new ObjectId(importId) }),
      ).toMatchObject({ consumed: 0, remaining: 5 });
    });
    test("actor/workspace isolation, permission changes and expiration fail closed", async () => {
      const ctx = await context(),
        other = await context(),
        importId = id(),
        inputs = [{ url: "https://example.com" }];
      await reserveImportQuota(ctx, importId, "links", 5);
      expect(
        await reserveImportQuota(other, importId, "links", 5),
      ).toMatchObject({ error: "not_found" });
      expect(
        await createMany(other, inputs, { id: importId, offset: 0 }),
      ).toMatchObject({ error: "invalid_input" });
      expect(await releaseImportQuota(other, importId)).toBe(false);
      const viewer = {
        ...ctx,
        actor: { ...ctx.actor, role: "viewer" as const },
      };
      expect(
        await createMany(viewer, inputs, { id: importId, offset: 0 }),
      ).toMatchObject({ error: "forbidden" });
      expect(await reserveImportQuota(viewer, id(), "links", 1)).toMatchObject({
        error: "forbidden",
      });
      await importReservations(db).updateOne(
        { _id: new ObjectId(importId) },
        { $set: { expiresAt: new Date(0) } },
      );
      expect(
        await createMany(ctx, inputs, { id: importId, offset: 0 }),
      ).toMatchObject({ error: "invalid_input" });
      expect((await createLink(ctx, inputs[0]!)).ok).toBe(true);
    });
    test("QR capacity is independent of ordinary links and blocks unreserved QR creation", async () => {
      const ctx = await context(),
        importId = id();
      expect((await reserveImportQuota(ctx, importId, "qrCodes", 5)).ok).toBe(
        true,
      );
      expect(await createQr(ctx, { url: "https://example.com" })).toMatchObject(
        { error: "limit_reached", detail: { reserved: 5 } },
      );
      expect((await createLink(ctx, { url: "https://example.com" })).ok).toBe(
        true,
      );
      await releaseImportQuota(ctx, importId);
      expect((await createQr(ctx, { url: "https://example.com" })).ok).toBe(
        true,
      );
    });
    test("receipt persistence failure rolls back created rows and the quota checkpoint", async () => {
      const ctx = await context(),
        importId = id(),
        inputs = [{ url: "https://example.com", tags: ["Rollback"] }];
      await reserveImportQuota(ctx, importId, "links", 1);
      await db.command({
        collMod: physicalNames.import_receipts,
        validator: { hash: { $eq: "force-test-rejection" } },
      });
      try {
        await expect(
          createMany(ctx, inputs, { id: importId, offset: 0 }),
        ).rejects.toThrow();
      } finally {
        await db.command({
          collMod: physicalNames.import_receipts,
          validator: {},
        });
      }
      expect(
        await db
          .collection(physicalNames.links)
          .countDocuments({ workspaceId: ctx.workspace._id }),
      ).toBe(0);
      expect(
        await db
          .collection(physicalNames.tags)
          .countDocuments({ workspaceId: ctx.workspace._id }),
      ).toBe(0);
      expect(
        await importReservations(db).findOne({ _id: new ObjectId(importId) }),
      ).toMatchObject({ consumed: 0, remaining: 1, state: "active" });
      expect(
        (await createMany(ctx, inputs, { id: importId, offset: 0 })).ok,
      ).toBe(true);
    });
    test("retry repairs invalidation after a post-commit cache failure without duplicate rows", async () => {
      const ctx = await context(),
        importId = id(),
        inputs = [{ url: "https://example.com" }];
      await reserveImportQuota(ctx, importId, "links", 1);
      const failed = {
        ...ctx,
        cache: new Proxy(redis, {
          get(target, prop) {
            if (prop === "publish")
              return async () => {
                throw new Error("synthetic-cache-failure");
              };
            const value = Reflect.get(target, prop);
            return typeof value === "function" ? value.bind(target) : value;
          },
        }),
      };
      await expect(
        createMany(failed, inputs, { id: importId, offset: 0 }),
      ).rejects.toThrow("synthetic-cache-failure");
      const observed: string[] = [];
      const repaired = {
        ...ctx,
        cache: new Proxy(redis, {
          get(target, prop) {
            if (prop === "publish")
              return async (_channel: string, message: string) => {
                observed.push(message);
                return 0;
              };
            const value = Reflect.get(target, prop);
            return typeof value === "function" ? value.bind(target) : value;
          },
        }),
      };
      const replay = await createMany(repaired, inputs, {
        id: importId,
        offset: 0,
      });
      expect(replay.ok).toBe(true);
      expect(observed).toHaveLength(1);
      if (replay.ok)
        expect(JSON.parse(observed[0]!).keys).toEqual([replay.value[0]!.key]);
      expect(
        await db
          .collection(physicalNames.links)
          .countDocuments({ workspaceId: ctx.workspace._id }),
      ).toBe(1);
    });
    test("1000 reserved rows commit in two 500-row chunks with stable row identities", async () => {
      const ctx = await context(),
        importId = id();
      await db
        .collection(physicalNames.subscriptions)
        .insertOne({
          workspaceId: ctx.workspace._id,
          polarSubscriptionId: crypto.randomUUID(),
          status: "active",
          plan: "pro",
          currentPeriodStart: new Date(Date.now() - 86400000),
          currentPeriodEnd: new Date(Date.now() + 29 * 86400000),
          cancelAtPeriodEnd: false,
        });
      expect((await reserveImportQuota(ctx, importId, "links", 1000)).ok).toBe(
        true,
      );
      const inputs = Array.from({ length: 1000 }, (_, index) => ({
        url: `https://example.com/large-${index}`,
        title: `Synthetic row ${index}`,
        tags: ["Large"],
      }));
      expect(
        await createMany(ctx, inputs.slice(0, 501), {
          id: importId,
          offset: 0,
        }),
      ).toMatchObject({ error: "invalid_input" });
      const first = await createMany(ctx, inputs.slice(0, 500), {
        id: importId,
        offset: 0,
      });
      expect(first.ok).toBe(true);
      expect(
        await createMany({ ...ctx }, inputs.slice(0, 500), {
          id: importId,
          offset: 0,
        }),
      ).toEqual(first);
      expect(
        (
          await createMany({ ...ctx }, inputs.slice(500), {
            id: importId,
            offset: 500,
          })
        ).ok,
      ).toBe(true);
      const rows = await db
        .collection(physicalNames.links)
        .find({ importId: new ObjectId(importId) })
        .sort({ importRow: 1 })
        .project({ importRow: 1, safetyScan: 1 })
        .toArray();
      expect(rows.map((row) => row.importRow)).toEqual(
        Array.from({ length: 1000 }, (_, index) => index),
      );
      expect(
        rows.every(
          (row) =>
            typeof row.safetyScan.generation === "string" &&
            row.safetyScan.attempts === 0 &&
            row.safetyScan.dueAt instanceof Date,
        ),
      ).toBe(true);
      expect(
        await importReservations(db).findOne({ _id: new ObjectId(importId) }),
      ).toMatchObject({ consumed: 1000, remaining: 0, state: "spent" });
    }, 30_000);
    test("concurrent identical chunks have one receipt and one set of rows", async () => {
      const ctx = await context(),
        importId = id(),
        inputs = [
          { url: "https://example.com/one" },
          { url: "https://example.com/two" },
        ];
      await reserveImportQuota(ctx, importId, "links", 2);
      const results = await Promise.all([
        createMany(ctx, inputs, { id: importId, offset: 0 }),
        createMany(ctx, inputs, { id: importId, offset: 0 }),
      ]);
      expect(results[0]).toEqual(results[1]);
      expect(results[0]?.ok).toBe(true);
      expect(
        await importReceipts(db).countDocuments({
          reservationId: new ObjectId(importId),
        }),
      ).toBe(1);
      expect(
        await db
          .collection(physicalNames.links)
          .countDocuments({ importId: new ObjectId(importId) }),
      ).toBe(2);
    });
  },
);
