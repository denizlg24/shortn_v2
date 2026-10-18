import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import Redis from "ioredis";
import { desiredIndexes, physicalNames } from "@shortn/db";
import {
  ensurePersonalWorkspace,
  analyticsExportInput,
  streamAnalyticsExport,
  prepareAnalyticsExport,
  analyticsExportJobs,
  analyticsExportDelivery,
  getAnalyticsExport,
  cancelAnalyticsExport,
  listAnalyticsExports,
  prepareLinkExport,
  getLinkExport,
  type ServiceContext,
} from "@shortn/core";
import type { ObjectStore } from "@shortn/storage";
import {
  runAnalyticsExport,
  createAnalyticsExportWorker,
} from "./analytics-exports";
import { runLinkExport, createLinkExportWorker } from "./link-exports";

const mongoUrl = process.env.MONGO_TEST_URL,
  cacheUrl = process.env.REDIS_TEST_URL,
  durableUrl = process.env.REDIS_DURABLE_TEST_URL;
(mongoUrl && cacheUrl && durableUrl ? describe : describe.skip)(
  "durable analytics exports",
  () => {
    let client: MongoClient, db: Db, cache: Redis, durable: Redis;
    const objects = new Map<string, Uint8Array>();
    const queueNames: string[] = [];
    const store: ObjectStore = {
      async head(key) {
        const bytes = objects.get(key);
        return bytes ? { bytes: bytes.length, contentType: "text/csv" } : null;
      },
      async get(key) {
        return objects.get(key)!;
      },
      async put(key, bytes) {
        objects.set(key, bytes);
      },
      async putStream(key, chunks, _contentType, maximum) {
        const rows: Uint8Array[] = [];
        let size = 0;
        for await (const chunk of chunks) {
          rows.push(chunk);
          size += chunk.length;
          if (size > maximum) throw new Error("archive_too_large");
        }
        objects.set(key, Buffer.concat(rows));
        return size;
      },
      async sign(key, seconds, filename) {
        return `https://synthetic.invalid/${key}?ttl=${seconds}&filename=${filename}`;
      },
    };
    beforeAll(async () => {
      if (
        ![mongoUrl, cacheUrl, durableUrl].every((url) =>
          ["127.0.0.1", "localhost"].includes(new URL(url!).hostname),
        )
      )
        throw new Error("Loopback only");
      client = await new MongoClient(mongoUrl!).connect();
      db = client.db(
        `shortn_analytics_export_${crypto.randomUUID().replaceAll("-", "")}`,
      );
      cache = new Redis(cacheUrl!);
      durable = new Redis(durableUrl!);
      await db.createCollection(physicalNames.click_events, {
        timeseries: { timeField: "ts", metaField: "m", granularity: "hours" },
      });
      await db
        .collection(physicalNames.export_jobs)
        .createIndexes(desiredIndexes[physicalNames.export_jobs]!);
    });
    afterAll(async () => {
      if (durable)
        for (const name of queueNames) {
          let cursor = "0";
          do {
            const [next, keys] = await durable.scan(
              cursor,
              "MATCH",
              `bull:${name}:*`,
              "COUNT",
              1000,
            );
            cursor = next;
            if (keys.length) await durable.unlink(...keys);
          } while (cursor !== "0");
        }
      await db?.dropDatabase();
      await client?.close();
      cache?.disconnect();
      durable?.disconnect();
    });
    async function context(plan = "pro"): Promise<ServiceContext> {
      const userId = new ObjectId().toHexString(),
        workspace = await ensurePersonalWorkspace(db, {
          id: userId,
          sub: `analytics-test|${userId}`,
          name: "Synthetic",
        });
      await db
        .collection(physicalNames.subscriptions)
        .insertOne({
          workspaceId: workspace._id,
          polarSubscriptionId: crypto.randomUUID(),
          status: "active",
          plan,
          currentPeriodStart: new Date(Date.now() - 86400_000),
          currentPeriodEnd: new Date(Date.now() + 29 * 86400_000),
          cancelAtPeriodEnd: false,
        });
      return {
        db,
        cache,
        workspace,
        actor: { userId, role: "owner" },
        linkDomain: "analytics-export.invalid",
      };
    }
    const deps = () => ({
      db,
      cache,
      store,
      linkDomain: "analytics-export.invalid",
    });
    const input = (
      from = new Date(Date.now() - 86400_000).toISOString(),
      to = new Date().toISOString(),
    ) =>
      analyticsExportInput.parse({ mode: "raw", format: "ndjson", from, to });
    async function bytes(
      ctx: ServiceContext,
      value = input(),
      onRows?: (done: number) => Promise<void>,
    ) {
      const chunks = [];
      for await (const chunk of streamAnalyticsExport(
        ctx,
        value,
        new Date(),
        undefined,
        onRows,
      ))
        chunks.push(chunk);
      return Buffer.concat(chunks).toString();
    }
    const event = (ctx: ServiceContext, i: number, extra = {}) => ({
      ts: new Date(Date.now() - 10000),
      m: {
        workspaceId: ctx.workspace._id,
        linkId: new ObjectId(),
        key: "=SUM(1)",
        kind: i % 2 ? "scan" : "click",
        branch: "branch-a",
      },
      ipHash: `visitor-${i % 3}`,
      country: `country-${i}`,
      refDomain: "@evil",
      rawIp: "private",
      ua: "private",
      ...extra,
    });

    test("strict formats, bounded raw cursors, retention and safe DTOs", async () => {
      const ctx = await context("plus"),
        other = await context();
      const query = input(
        new Date(Date.now() - 1000 * 86400_000).toISOString(),
        new Date(Date.now() + 86400_000).toISOString(),
      );
      await db
        .collection(physicalNames.click_events)
        .insertMany([
          ...Array.from({ length: 1205 }, (_, i) => event(ctx, i)),
          event(other, 1),
          event(ctx, 1, { ts: new Date(Date.now() - 800 * 86400_000) }),
          event(ctx, 1, { ts: new Date(Date.now() + 3600_000) }),
        ]);
      const raw = (await bytes(ctx, query))
        .trim()
        .split("\n")
        .map((row) => JSON.parse(row));
      expect(raw).toHaveLength(1205);
      expect(Object.keys(raw[0])).toHaveLength(17);
      expect(raw[0].key).toBe("=SUM(1)");
      expect(raw[0].branch).toBe("branch-a");
      expect(raw[0]).not.toHaveProperty("ipHash");
      expect(raw[0]).not.toHaveProperty("rawIp");
      const csv = await bytes(ctx, { ...query, format: "csv" });
      expect(csv).toContain('"\'=SUM(1)"');
      expect(csv).toContain('"\'@evil"');
      expect(csv).not.toContain("visitor-");
      expect(
        analyticsExportInput.safeParse({ ...query, mode: "aggregate" }).success,
      ).toBe(false);
      expect(
        analyticsExportInput.safeParse({ ...query, timezone: "Wrong/Zone" })
          .success,
      ).toBe(false);
      expect(
        analyticsExportInput.safeParse({ ...query, from: query.to }).success,
      ).toBe(false);
      expect(
        analyticsExportInput.safeParse({
          ...query,
          filters: { link: "$where" },
        }).success,
      ).toBe(false);
      expect(
        analyticsExportInput.safeParse({ ...query, cursor: "injected" })
          .success,
      ).toBe(false);
      const oldRange = input(
        new Date(Date.now() - 900 * 86400_000).toISOString(),
        new Date(Date.now() - 800 * 86400_000).toISOString(),
      );
      expect(
        await bytes(ctx, { ...oldRange, mode: "aggregate", format: "csv" }),
      ).toContain('"total","","","","0","0","0"');
      const frozen = await prepareAnalyticsExport(ctx, query);
      if (!frozen.ok) throw new Error("prepare");
      await db
        .collection(physicalNames.subscriptions)
        .updateOne(
          { workspaceId: ctx.workspace._id },
          { $set: { plan: "pro" } },
        );
      await runAnalyticsExport(deps(), frozen.value.id);
      const frozenJob = await getAnalyticsExport(ctx, frozen.value.id);
      expect(frozenJob?.done).toBe(1205);
      const free = await context("basic");
      await expect(bytes(free)).rejects.toThrow("feature_required");
    });

    test("aggregate CSV exports all groups beyond dashboard limits and shares a snapshot", async () => {
      const ctx = await context();
      await db
        .collection(physicalNames.click_events)
        .insertMany(Array.from({ length: 1505 }, (_, i) => event(ctx, i)));
      let inserted = false;
      const csv = await bytes(
        ctx,
        {
          ...input(),
          mode: "aggregate",
          format: "csv",
          dimensions: ["country"],
        },
        async (count) => {
          if (!inserted && count > 0) {
            inserted = true;
            await db
              .collection(physicalNames.click_events)
              .insertOne(event(ctx, 2000));
          }
        },
      );
      const rows = csv.trim().split("\r\n");
      expect(rows.filter((row) => row.startsWith('"breakdown"'))).toHaveLength(
        1505,
      );
      expect(rows.find((row) => row.startsWith('"total"'))).toContain(
        '"753","752","3"',
      );
      expect(rows.find((row) => row.startsWith('"series"'))).toContain(
        '"753","752","3"',
      );
      expect(csv).not.toContain("country-2000");
    });

    test("every request is a durable job; retries, roles, kinds, expiry and delivery are isolated", async () => {
      const ctx = await context(),
        other = await context(),
        request = crypto.randomUUID();
      await db.collection(physicalNames.click_events).insertOne(event(ctx, 1));
      const query = input(),
        result = await prepareAnalyticsExport(ctx, query, request);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const id = result.value.id;
      expect((await prepareAnalyticsExport(ctx, query, request)).ok).toBe(true);
      expect(
        await prepareAnalyticsExport(ctx, { ...query, format: "csv" }, request),
      ).toEqual({ ok: false, error: "idempotency_conflict" });
      expect(await getAnalyticsExport(other, id)).toBeNull();
      expect(await getLinkExport(ctx, id)).toBeNull();
      expect(await runLinkExport(deps(), id)).toBe(false);
      await runAnalyticsExport(deps(), id);
      const job = await getAnalyticsExport(ctx, id);
      expect(job?.state).toBe("completed");
      expect(job?.done).toBe(1);
      const delivery = await analyticsExportDelivery(ctx, id, store.sign);
      expect(delivery).toHaveProperty("downloadUrl");
      expect(JSON.stringify(delivery)).not.toContain("leaseToken");
      expect(JSON.stringify(delivery)).not.toContain("signature");
      expect(
        JSON.parse(Buffer.from(objects.get(job!.objectKey!)!).toString()).kind,
      ).toBe("scan");
      const viewerId = new ObjectId().toHexString();
      await db
        .collection(physicalNames.workspace_members)
        .insertOne({
          workspaceId: ctx.workspace._id,
          userId: viewerId,
          role: "viewer",
        });
      const viewer = {
        ...ctx,
        actor: { userId: viewerId, role: "owner" as const },
      };
      expect(await getAnalyticsExport(viewer, id)).toBeNull();
      await db
        .collection(physicalNames.workspace_members)
        .updateOne({ userId: viewerId }, { $set: { role: "admin" } });
      expect(await getAnalyticsExport(viewer, id)).not.toBeNull();
      await analyticsExportJobs(db).updateOne(
        { _id: new ObjectId(id) },
        { $set: { objectKey: "exports/jobs/links/foreign" } },
      );
      expect(
        await analyticsExportDelivery(ctx, id, store.sign),
      ).not.toHaveProperty("downloadUrl");
      await analyticsExportJobs(db).updateOne(
        { _id: new ObjectId(id) },
        { $set: { expiresAt: new Date(0) } },
      );
      expect(await getAnalyticsExport(ctx, id)).toBeNull();
      expect(await prepareAnalyticsExport(ctx, query, request)).toEqual({
        ok: false,
        error: "expired",
      });
      const links = await prepareLinkExport(ctx, {}, "csv");
      expect(links.ok).toBe(true);
    });

    test("cancellation, retry and retention loss never publish a private result", async () => {
      const ctx = await context(),
        query = input();
      const cancelled = await prepareAnalyticsExport(ctx, query);
      if (!cancelled.ok) throw new Error("prepare");
      expect(await cancelAnalyticsExport(ctx, cancelled.value.id)).toBe(true);
      expect(await runAnalyticsExport(deps(), cancelled.value.id)).toBe(false);
      const retry = await prepareAnalyticsExport(ctx, query);
      if (!retry.ok) throw new Error("prepare");
      await runAnalyticsExport(
        {
          ...deps(),
          store: {
            ...store,
            async putStream() {
              throw new Error("synthetic transient");
            },
          },
        },
        retry.value.id,
      );
      expect((await getAnalyticsExport(ctx, retry.value.id))?.state).toBe(
        "pending",
      );
      await analyticsExportJobs(db).updateOne(
        { _id: new ObjectId(retry.value.id) },
        { $set: { nextAttemptAt: new Date(0) } },
      );
      await runAnalyticsExport(deps(), retry.value.id);
      expect((await getAnalyticsExport(ctx, retry.value.id))?.state).toBe(
        "completed",
      );
      const old = await prepareAnalyticsExport(
        ctx,
        input(new Date(Date.now() - 900 * 86400_000).toISOString()),
      );
      if (!old.ok) throw new Error("prepare");
      await db
        .collection(physicalNames.subscriptions)
        .updateOne(
          { workspaceId: ctx.workspace._id },
          { $set: { plan: "plus" } },
        );
      await expect(
        analyticsExportDelivery(ctx, old.value.id, store.sign),
      ).rejects.toThrow("feature_required");
      await runAnalyticsExport(deps(), old.value.id);
      const stored = await analyticsExportJobs(db).findOne({
        _id: new ObjectId(old.value.id),
      });
      expect(stored?.state).toBe("failed");
      expect(stored?.objectKey).toBeUndefined();
      const access = await context();
      await db
        .collection(physicalNames.click_events)
        .insertMany(Array.from({ length: 1001 }, (_, i) => event(access, i)));
      await expect(
        bytes(access, query, async (count) => {
          if (count === 500)
            await db
              .collection(physicalNames.workspace_members)
              .deleteOne({
                workspaceId: access.workspace._id,
                userId: access.actor.userId,
              });
        }),
      ).rejects.toThrow("forbidden");
      const abort = new AbortController();
      abort.abort();
      await expect(
        (async () => {
          for await (const chunk of streamAnalyticsExport(
            ctx,
            query,
            new Date(),
            abort.signal,
          )) {
            expect(chunk).toBeDefined();
          }
        })(),
      ).rejects.toThrow("export_cancelled");
    });

    test("history stays paginated and real queue pumps claim only their own kind", async () => {
      const ctx = await context(),
        query = input();
      for (let i = 0; i < 30; i++)
        await prepareAnalyticsExport(ctx, {
          ...query,
          format: i % 2 ? "csv" : "ndjson",
        });
      expect((await listAnalyticsExports(ctx))?.items).toHaveLength(25);
      expect(
        (await listAnalyticsExports(ctx, { page: 2 }))?.items,
      ).toHaveLength(5);
      expect((await listAnalyticsExports(ctx, { format: "csv" }))?.total).toBe(
        15,
      );
      const history = JSON.stringify(await listAnalyticsExports(ctx));
      expect(history).not.toContain("requestKey");
      expect(history).not.toContain("filters");
      const factory = createAnalyticsExportWorker({
        ...deps(),
        durable,
        queueName: `analytics-export-test-${crypto.randomUUID()}`,
        log() {},
      });
      const linkFactory = createLinkExportWorker({
        ...deps(),
        durable,
        queueName: `analytics-link-isolation-${crypto.randomUUID()}`,
        log() {},
      });
      queueNames.push(factory.queue.name, linkFactory.queue.name);
      try {
        await linkFactory.pump();
        expect(
          await linkFactory.queue.getJobCounts("waiting", "active"),
        ).toMatchObject({ waiting: 0, active: 0 });
        await factory.pump();
        const deadline = Date.now() + 15000;
        while (
          Date.now() < deadline &&
          (await analyticsExportJobs(db).countDocuments({
            workspaceId: ctx.workspace._id,
            state: { $in: ["pending", "running"] },
          }))
        )
          await Bun.sleep(50);
        expect(
          await analyticsExportJobs(db).countDocuments({
            workspaceId: ctx.workspace._id,
            state: "completed",
          }),
        ).toBe(30);
      } finally {
        await factory.close();
        await linkFactory.close();
      }
    }, 20000);

    test("running cancellation and replaced leases fence publication; expired leases recover", async () => {
      const ctx = await context();
      await db
        .collection(physicalNames.click_events)
        .insertMany(Array.from({ length: 1001 }, (_, i) => event(ctx, i)));
      const cancelled = await prepareAnalyticsExport(ctx, input());
      if (!cancelled.ok) throw new Error("prepare");
      const cancelledId = cancelled.value.id;
      const cancelledStore = {
        ...store,
        async putStream(
          key: string,
          chunks: AsyncIterable<Uint8Array>,
          type: string,
          max: number,
        ) {
          async function* cancelMidway() {
            let n = 0;
            for await (const chunk of chunks) {
              yield chunk;
              if (++n === 500) await cancelAnalyticsExport(ctx, cancelledId);
            }
          }
          return store.putStream!(key, cancelMidway(), type, max);
        },
      };
      await runAnalyticsExport(
        { ...deps(), store: cancelledStore },
        cancelled.value.id,
      );
      expect((await getAnalyticsExport(ctx, cancelled.value.id))?.state).toBe(
        "cancelled",
      );
      expect(
        await analyticsExportDelivery(ctx, cancelled.value.id, store.sign),
      ).not.toHaveProperty("downloadUrl");
      const result = await prepareAnalyticsExport(ctx, input());
      if (!result.ok) throw new Error("prepare");
      const jobId = new ObjectId(result.value.id);
      const replacedStore = {
        ...store,
        async putStream(
          key: string,
          chunks: AsyncIterable<Uint8Array>,
          type: string,
          max: number,
        ) {
          const size = await store.putStream!(key, chunks, type, max);
          await analyticsExportJobs(db).updateOne(
            { _id: jobId },
            {
              $set: {
                leaseToken: "replacement",
                leaseUntil: new Date(Date.now() + 300_000),
              },
            },
          );
          return size;
        },
      };
      await runAnalyticsExport(
        { ...deps(), store: replacedStore },
        result.value.id,
      );
      const stale = await analyticsExportJobs(db).findOne({ _id: jobId });
      expect(stale?.state).toBe("running");
      expect(stale?.objectKey).toBeUndefined();
      await analyticsExportJobs(db).updateOne(
        { _id: jobId },
        { $set: { leaseUntil: new Date(0), nextAttemptAt: new Date(0) } },
      );
      await runAnalyticsExport(deps(), result.value.id);
      const recovered = await getAnalyticsExport(ctx, result.value.id);
      expect(recovered?.state).toBe("completed");
      expect(recovered?.attempts).toBe(2);
      expect(recovered?.done).toBe(1001);
    });
  },
);
