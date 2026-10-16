import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { Redis } from "ioredis";
import { collection, desiredIndexes, physicalNames } from "@shortn/db";
import {
  createLink,
  createMany,
  updateLink,
  ensurePersonalWorkspace,
  decide,
  type ServiceContext,
} from "@shortn/core";
import { linkInvalidateChannel } from "@shortn/redis";
import {
  createResolver,
  mongoLinkLoader,
  parseInvalidation,
} from "../../redirect/src/resolver";
import {
  invalidateRuleBoundary,
  createRuleScheduleWorker,
} from "./rule-schedules";
const mongo = process.env.MONGO_TEST_URL,
  cacheUrl = process.env.REDIS_TEST_URL,
  durableUrl = process.env.REDIS_DURABLE_TEST_URL ?? cacheUrl;
(mongo && cacheUrl ? describe : describe.skip)(
  "durable rule boundary invalidation",
  () => {
    let client: MongoClient, db: Db, cache: Redis, durable: Redis;
    beforeAll(async () => {
      if (
        ![mongo, cacheUrl, durableUrl].every((url) =>
          ["127.0.0.1", "localhost"].includes(new URL(url!).hostname),
        )
      )
        throw new Error("Loopback services required");
      client = await new MongoClient(mongo!).connect();
      db = client.db(
        `shortn_rule_jobs_${crypto.randomUUID().replaceAll("-", "")}`,
      );
      cache = new Redis(cacheUrl!);
      durable = new Redis(durableUrl!);
      await collection(db, "links").createIndexes(
        desiredIndexes[physicalNames.links]!,
      );
    });
    afterAll(async () => {
      await db?.dropDatabase();
      await client?.close();
      cache?.disconnect();
      durable?.disconnect();
    });
    async function context(): Promise<ServiceContext> {
      const userId = new ObjectId().toHexString(),
        workspace = await ensurePersonalWorkspace(db, {
          id: userId,
          name: "Boundaries",
        });
      await db.collection(physicalNames.subscriptions).insertOne({
        workspaceId: workspace._id,
        polarSubscriptionId: crypto.randomUUID(),
        status: "active",
        plan: "pro",
        currentPeriodStart: new Date(Date.now() - 86400000),
        currentPeriodEnd: new Date(Date.now() + 29 * 86400000),
        cancelAtPeriodEnd: false,
      });
      return {
        db,
        cache,
        workspace,
        actor: { userId, role: "owner" },
        linkDomain: "shortn.at",
      };
    }
    async function fixture(past = false) {
      const ctx = await context(),
        activeFrom = new Date(Date.now() + (past ? -2000 : 60000)),
        expiresAt = new Date(activeFrom.getTime() + 1000);
      const created = await createLink(ctx, {
        url: "https://example.com",
        rules: {
          activeFrom: activeFrom.toISOString(),
          expiresAt: expiresAt.toISOString(),
        },
      });
      if (!created.ok) throw new Error(created.error);
      const id = new ObjectId(created.value.id),
        row = (await collection(db, "links").findOne({ _id: id }))!;
      return {
        ctx,
        id,
        key: created.value.key,
        schedule: row.ruleSchedule!,
        activeFrom,
        expiresAt,
      };
    }
    async function waitFor(check: () => Promise<boolean>, timeout = 3000) {
      const end = Date.now() + timeout;
      while (Date.now() < end) {
        if (await check()) return;
        await Bun.sleep(20);
      }
      throw new Error("Fixture did not reach expected state");
    }
    const deps = () => ({ db, cache, linkDomain: "shortn.at" });

    test("both boundaries flush canonical/alias L2 entries and publish L1 eviction, without firing early", async () => {
      const { id, key, schedule, activeFrom, expiresAt } = await fixture();
      const alias = `old-${key}`;
      await collection(db, "links").updateOne(
        { _id: id },
        {
          $set: {
            previousKeys: [alias],
            safetyStatus: "safe",
            requiresInterstitial: false,
          },
        },
      );
      const resolver = createResolver(cache, mongoLinkLoader(db));
      const first = await resolver.resolve("shortn.at", key);
      await cache.set(`link:shortn.at:${alias}`, "alias");
      const subscriber = cache.duplicate(),
        messages: unknown[] = [];
      subscriber.on("message", (_channel, payload) => {
        const message = parseInvalidation(payload);
        if (message?.keys.includes(key)) {
          messages.push(message);
          resolver.evict(message);
        }
      });
      await subscriber.subscribe(linkInvalidateChannel);
      try {
        await invalidateRuleBoundary(
          deps(),
          String(id),
          schedule.generation,
          activeFrom.getTime(),
          new Date(activeFrom.getTime() - 1),
        );
        expect(await cache.get(`link:shortn.at:${key}`)).not.toBeNull();
        expect(messages).toHaveLength(0);
        await invalidateRuleBoundary(
          deps(),
          String(id),
          schedule.generation,
          activeFrom.getTime(),
          activeFrom,
        );
        expect(await cache.get(`link:shortn.at:${key}`)).toBeNull();
        expect(await cache.get(`link:shortn.at:${alias}`)).toBeNull();
        await waitFor(async () => resolver.memory.size === 0);
        expect(messages).toHaveLength(1);
        expect(
          (await collection(db, "links").findOne({ _id: id }))!.ruleSchedule!
            .nextAt,
        ).toEqual(expiresAt);
        expect(
          await decide({
            link: first,
            key,
            origin: "https://shortn.at",
            locale: "en",
            secrets: { legacy: new Uint8Array(32) },
            now: activeFrom.getTime(),
          }),
        ).toMatchObject({ type: "redirect", location: "https://example.com/" });
        await resolver.resolve("shortn.at", key);
        await invalidateRuleBoundary(
          deps(),
          String(id),
          schedule.generation,
          expiresAt.getTime(),
          expiresAt,
        );
        await waitFor(async () => messages.length === 2);
        const completed = (await collection(db, "links").findOne({ _id: id }))!
          .ruleSchedule!;
        expect(completed.nextAt).toBeUndefined();
        expect(completed.completedAt).toBeInstanceOf(Date);
        expect(
          await decide({
            link: first,
            key,
            origin: "https://shortn.at",
            locale: "en",
            secrets: { legacy: new Uint8Array(32) },
            now: expiresAt.getTime(),
          }),
        ).toMatchObject({ type: "unavailable", reason: "expired" });
        await invalidateRuleBoundary(
          deps(),
          String(id),
          schedule.generation,
          expiresAt.getTime(),
          expiresAt,
        );
        expect(messages).toHaveLength(2);
      } finally {
        subscriber.disconnect();
        await cache.del(`link:shortn.at:${key}`, `link:shortn.at:${alias}`);
      }
    });
    test("rule edits and clearing supersede old delayed jobs", async () => {
      const { ctx, id, key, schedule, activeFrom } = await fixture();
      expect(
        (
          await updateLink(ctx, String(id), {
            rules: { expiresAt: new Date(Date.now() + 3600000).toISOString() },
          })
        ).ok,
      ).toBe(true);
      const replacement = (await collection(db, "links").findOne({ _id: id }))!
        .ruleSchedule!;
      await cache.set(`link:shortn.at:${key}`, "new-generation");
      await invalidateRuleBoundary(
        deps(),
        String(id),
        schedule.generation,
        activeFrom.getTime(),
        activeFrom,
      );
      expect(await cache.get(`link:shortn.at:${key}`)).toBe("new-generation");
      expect(
        (await collection(db, "links").findOne({ _id: id }))!.ruleSchedule,
      ).toEqual(replacement);
      expect((await updateLink(ctx, String(id), { rules: null })).ok).toBe(
        true,
      );
      await cache.set(`link:shortn.at:${key}`, "cleared");
      await invalidateRuleBoundary(
        deps(),
        String(id),
        replacement.generation,
        replacement.nextAt!.getTime(),
        replacement.nextAt,
      );
      expect(await cache.get(`link:shortn.at:${key}`)).toBe("cleared");
      expect(
        (await collection(db, "links").findOne({ _id: id }))!.ruleSchedule,
      ).toBeUndefined();
      await cache.del(`link:shortn.at:${key}`);
    });
    test("cache failure retains a retryable boundary and never stores exception details", async () => {
      const { id, schedule } = await fixture(true);
      await invalidateRuleBoundary(
        {
          ...deps(),
          flush: async () => {
            throw new Error("private-cache-details");
          },
        },
        String(id),
        schedule.generation,
        schedule.nextAt!.getTime(),
      );
      let row = (await collection(db, "links").findOne({ _id: id }))!;
      expect(row.ruleSchedule).toMatchObject({
        attempts: 1,
        lastError: "cache_unavailable",
        nextAt: schedule.nextAt,
      });
      expect(JSON.stringify(row.ruleSchedule)).not.toContain(
        "private-cache-details",
      );
      expect(row.ruleSchedule!.token).toBeUndefined();
      await collection(db, "links").updateOne(
        { _id: id },
        { $set: { "ruleSchedule.retryAt": new Date(0) } },
      );
      await invalidateRuleBoundary(
        deps(),
        String(id),
        schedule.generation,
        schedule.nextAt!.getTime(),
      );
      row = (await collection(db, "links").findOne({ _id: id }))!;
      expect(row.ruleSchedule!.nextAt).toEqual(row.rules!.expiresAt);
      expect(row.ruleSchedule!.lastError).toBeUndefined();
      await invalidateRuleBoundary(
        deps(),
        String(id),
        schedule.generation,
        row.ruleSchedule!.nextAt!.getTime(),
      );
    });
    test("expired lease replacement fences a late invalidator's checkpoint", async () => {
      const { id, schedule } = await fixture(true);
      let started!: () => void, release!: () => void;
      const ready = new Promise<void>((resolve) => {
          started = resolve;
        }),
        gate = new Promise<void>((resolve) => {
          release = resolve;
        });
      let calls = 0;
      const slow = {
        ...deps(),
        flush: async () => {
          calls++;
          started();
          await gate;
        },
      };
      const old = invalidateRuleBoundary(
        slow,
        String(id),
        schedule.generation,
        schedule.nextAt!.getTime(),
      );
      await ready;
      let replacement: unknown;
      try {
        await invalidateRuleBoundary(
          slow,
          String(id),
          schedule.generation,
          schedule.nextAt!.getTime(),
        );
        expect(calls).toBe(1);
        await collection(db, "links").updateOne(
          { _id: id },
          { $set: { "ruleSchedule.leaseUntil": new Date(0) } },
        );
        await invalidateRuleBoundary(
          deps(),
          String(id),
          schedule.generation,
          schedule.nextAt!.getTime(),
        );
        replacement = (await collection(db, "links").findOne({ _id: id }))!
          .ruleSchedule;
      } finally {
        release();
      }
      await old;
      expect(
        JSON.stringify(
          (await collection(db, "links").findOne({ _id: id }))!.ruleSchedule,
        ),
      ).toBe(JSON.stringify(replacement));
      const next = (await collection(db, "links").findOne({ _id: id }))!
        .ruleSchedule!.nextAt!;
      await invalidateRuleBoundary(
        deps(),
        String(id),
        schedule.generation,
        next.getTime(),
      );
    });
    test("bounded publication progresses across a shared future deadline and survives queue restart", async () => {
      const ctx = await context(),
        expiresAt = new Date(Date.now() + 15000);
      const created = await createMany(
        ctx,
        Array.from({ length: 1000 }, () => ({
          url: "https://example.com",
          rules: { expiresAt: expiresAt.toISOString() },
        })),
      );
      if (!created.ok) throw new Error(created.error);
      expect(
        (
          await createLink(ctx, {
            url: "https://example.com/extra",
            rules: { expiresAt: expiresAt.toISOString() },
          })
        ).ok,
      ).toBe(true);
      const queueName = `rule-test-${crypto.randomUUID()}`,
        errors: unknown[] = [],
        base = {
          ...deps(),
          durable,
          queueName,
          log: (_message: string, error?: unknown) => {
            errors.push(error);
          },
        };
      const first = createRuleScheduleWorker(base);
      await first.worker.pause();
      await first.pump();
      expect(await first.queue.getDelayedCount()).toBe(100);
      await collection(db, "links").updateMany(
        { workspaceId: ctx.workspace._id, "ruleSchedule.queued": true },
        { $set: { "ruleSchedule.publishedAt": new Date(0) } },
      );
      await first.pump();
      expect(await first.queue.getDelayedCount()).toBe(200);
      for (let page = 0; page < 9; page++) await first.pump();
      expect(await first.queue.getDelayedCount()).toBe(1001);
      await first.close();
      const second = createRuleScheduleWorker(base);
      try {
        await waitFor(
          async () =>
            (await collection(db, "links").countDocuments({
              workspaceId: ctx.workspace._id,
              "ruleSchedule.completedAt": { $exists: true },
            })) === 1001,
          20000,
        );
        expect(Date.now()).toBeGreaterThanOrEqual(expiresAt.getTime());
        expect(errors).toEqual([]);
      } finally {
        await second.worker.pause();
        await second.queue.obliterate({ force: true });
        await second.close();
      }
    }, 30000);
    test("lost queue publication is recoverable and completed legacy schedules do not reseed", async () => {
      const { ctx, id, schedule } = await fixture();
      const queueName = `rule-recover-${crypto.randomUUID()}`,
        worker = createRuleScheduleWorker({
          ...deps(),
          durable,
          queueName,
          log: () => {},
        });
      await worker.worker.pause();
      try {
        await worker.pump();
        const job = (await worker.queue.getDelayed())[0]!;
        await job.remove();
        await worker.pump();
        expect(await worker.queue.getDelayedCount()).toBe(0);
        await collection(db, "links").updateOne(
          { _id: id },
          {
            $set: { "ruleSchedule.publishedAt": new Date(Date.now() - 61000) },
          },
        );
        await worker.pump();
        expect(await worker.queue.getDelayedCount()).toBe(1);
        expect(
          (await collection(db, "links").findOne({ _id: id }))!.ruleSchedule!
            .generation,
        ).toBe(schedule.generation);
      } finally {
        await updateLink(ctx, String(id), { rules: null });
        await worker.queue.obliterate({ force: true });
        await worker.close();
      }
      const legacy = new ObjectId();
      await collection(db, "links").insertOne({
        _id: legacy,
        workspaceId: ctx.workspace._id,
        urlCode: "legacy-boundary",
        longUrl: "https://example.com",
        rules: { startsAt: new Date(0), expiresAt: new Date(1) },
      });
      const recovery = createRuleScheduleWorker({
        ...deps(),
        durable,
        queueName: `legacy-rule-${crypto.randomUUID()}`,
        log: () => {},
      });
      try {
        await waitFor(async () => {
          await recovery.pump();
          return Boolean(
            (await collection(db, "links").findOne({ _id: legacy }))
              ?.ruleSchedule?.completedAt,
          );
        });
        const generation = (await collection(db, "links").findOne({
          _id: legacy,
        }))!.ruleSchedule!.generation;
        await recovery.pump();
        expect(
          (await collection(db, "links").findOne({ _id: legacy }))!
            .ruleSchedule!.generation,
        ).toBe(generation);
      } finally {
        await recovery.worker.pause();
        await recovery.queue.obliterate({ force: true });
        await recovery.close();
      }
    });
  },
);
