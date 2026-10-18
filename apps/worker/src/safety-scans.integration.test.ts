import type { Documents } from "@shortn/db";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { Redis } from "ioredis";
import { collection, desiredIndexes, physicalNames } from "@shortn/db";
import {
  createLink,
  createMany,
  updateLink,
  scanAndPersistLink,
  ensurePersonalWorkspace,
  type ServiceContext,
} from "@shortn/core";
import { createSafetyWorker, runSafetyScan } from "./safety-scans";
import { safetyDigest } from "../../../packages/core/safety/cache";
const mongo = process.env.MONGO_TEST_URL,
  cacheUrl = process.env.REDIS_TEST_URL,
  durableUrl = process.env.REDIS_DURABLE_TEST_URL ?? cacheUrl;
(mongo && cacheUrl ? describe : describe.skip)("durable safety scans", () => {
  let client: MongoClient, db: Db, cache: Redis, durable: Redis;
  const provider = { fetch: async () => new Response(null, { status: 404 }) };
  beforeAll(async () => {
    if (
      ![mongo, cacheUrl, durableUrl].every((url) =>
        ["localhost", "127.0.0.1"].includes(new URL(url!).hostname),
      )
    )
      throw new Error("Loopback services required");
    client = await new MongoClient(mongo!).connect();
    db = client.db(
      `shortn_safety_jobs_${crypto.randomUUID().replaceAll("-", "")}`,
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
  async function fixture() {
    const userId = new ObjectId().toHexString(),
      workspace = await ensurePersonalWorkspace(db, {
        id: userId,
        name: "Scans",
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
    const ctx: ServiceContext = {
      db,
      cache,
      workspace,
      actor: { userId, role: "owner" },
      linkDomain: "shortn.at",
    };
    const result = await createLink(ctx, { url: "https://example.com" });
    if (!result.ok) throw new Error(result.error);
    const id = new ObjectId(result.value.id),
      row = (await collection(db, "links").findOne({ _id: id }))!;
    return { ctx, id, generation: row.safetyScan!.generation };
  }
  test("one lease wins concurrent executions; successful scans schedule weekly work", async () => {
    const { id, generation } = await fixture();
    let scans = 0,
      started!: () => void,
      release!: () => void;
    const ready = new Promise<void>((resolve) => {
        started = resolve;
      }),
      gate = new Promise<void>((resolve) => {
        release = resolve;
      });
    const deps = {
      db,
      cache,
      linkDomain: "shortn.at",
      provider,
      scan: async (...args: Parameters<typeof scanAndPersistLink>) => {
        scans++;
        started();
        await gate;
        return scanAndPersistLink(...args);
      },
    };
    const first = runSafetyScan(deps, String(id), generation);
    await ready;
    try {
      await runSafetyScan(deps, String(id), generation);
      expect(scans).toBe(1);
    } finally {
      release();
    }
    await first;
    const row = (await collection(db, "links").findOne({ _id: id }))!;
    expect(row.safetyStatus).toBe("safe");
    expect(row.safetyScan!.attempts).toBe(0);
    expect(row.safetyScan!.token).toBeUndefined();
    expect(
      row.safetyScan!.dueAt.getTime() - row.safetyScan!.completedAt!.getTime(),
    ).toBe(7 * 86400000);
  });
  test("failure retries preserve durable work and omit exception details", async () => {
    const { id, generation } = await fixture();
    await runSafetyScan(
      {
        db,
        cache,
        linkDomain: "shortn.at",
        scan: async () => {
          throw new Error("secret-provider-url");
        },
      },
      String(id),
      generation,
    );
    let row = (await collection(db, "links").findOne({ _id: id }))!;
    expect(row.safetyScan).toMatchObject({
      lastError: "scan_failed",
      attempts: 1,
    });
    expect(JSON.stringify(row.safetyScan)).not.toContain("secret-provider-url");
    expect(row.safetyScan!.leaseUntil).toBeUndefined();
    await collection(db, "links").updateOne(
      { _id: id },
      { $set: { "safetyScan.dueAt": new Date(0) } },
    );
    await runSafetyScan(
      { db, cache, linkDomain: "shortn.at", provider },
      String(id),
      generation,
    );
    row = (await collection(db, "links").findOne({ _id: id }))!;
    expect(row.safetyScan!.completedAt).toBeInstanceOf(Date);
    expect(row.safetyScan!.lastError).toBeUndefined();
  });
  test("new destinations supersede active generations and stale jobs cannot overwrite their request", async () => {
    const { ctx, id, generation } = await fixture();
    let started!: () => void, release!: () => void;
    const ready = new Promise<void>((resolve) => {
        started = resolve;
      }),
      gate = new Promise<void>((resolve) => {
        release = resolve;
      });
    const running = runSafetyScan(
      {
        db,
        cache,
        linkDomain: "shortn.at",
        provider,
        scan: async (...args) => {
          started();
          await gate;
          return scanAndPersistLink(...args);
        },
      },
      String(id),
      generation,
    );
    await ready;
    try {
      expect(
        (await updateLink(ctx, String(id), { url: "https://example.org/new" }))
          .ok,
      ).toBe(true);
    } finally {
      release();
    }
    await running;
    const row = (await collection(db, "links").findOne({ _id: id }))!;
    expect(row.safetyScan!.generation).not.toBe(generation);
    expect(row.safetyScan!.completedAt).toBeUndefined();
    expect(row.safetyStatus).toBe("pending");
    await runSafetyScan(
      { db, cache, linkDomain: "shortn.at", provider },
      String(id),
      row.safetyScan!.generation,
    );
    expect(
      (await collection(db, "links").findOne({ _id: id }))!.safetyStatus,
    ).toBe("safe");
  });
  test("expired leases recover and fenced old workers cannot apply verdicts", async () => {
    const { ctx, id, generation } = await fixture();
    await collection(db, "links").updateOne(
      { _id: id },
      {
        $set: {
          "safetyScan.token": "dead",
          "safetyScan.leaseUntil": new Date(0),
        },
      },
    );
    await runSafetyScan(
      { db, cache, linkDomain: "shortn.at", provider },
      String(id),
      generation,
    );
    let requests = 0;
    expect(
      await scanAndPersistLink(
        ctx,
        id,
        {
          fetch: async () => {
            requests++;
            return new Response(null, { status: 404 });
          },
        },
        { generation, token: "dead" },
      ),
    ).toBeUndefined();
    expect(requests).toBe(0);
  });
  test("a provider result from an expired lease cannot overwrite its replacement's verdict", async () => {
    const { id, generation } = await fixture();
    let started!: () => void, release!: () => void;
    const ready = new Promise<void>((resolve) => {
        started = resolve;
      }),
      gate = new Promise<void>((resolve) => {
        release = resolve;
      });
    const old = runSafetyScan(
      {
        db,
        cache,
        linkDomain: "shortn.at",
        provider: {
          webRiskApiKey: "stub",
          fetch: async (input) => {
            if (new URL(input).hostname !== "webrisk.googleapis.com")
              return new Response(null, { status: 404 });
            started();
            await gate;
            return Response.json({ threat: { threatTypes: ["MALWARE"] } });
          },
        },
      },
      String(id),
      generation,
    );
    await ready;
    let replacement: Documents["links"]["safetyScan"];
    try {
      await collection(db, "links").updateOne(
        { _id: id },
        { $set: { "safetyScan.leaseUntil": new Date(0) } },
      );
      await runSafetyScan(
        { db, cache, linkDomain: "shortn.at", provider },
        String(id),
        generation,
      );
      replacement = (await collection(db, "links").findOne({ _id: id }))!
        .safetyScan;
    } finally {
      release();
    }
    await old;
    const row = (await collection(db, "links").findOne({ _id: id }))!;
    expect(row.safetyStatus).toBe("safe");
    expect(row.disabled).toBe(false);
    expect(row.safetyScan).toEqual(replacement);
  });
  test("configured reputation outages retry rather than waiting a week", async () => {
    const { id, generation } = await fixture();
    await runSafetyScan(
      {
        db,
        cache,
        linkDomain: "shortn.at",
        provider: {
          webRiskApiKey: "stub",
          fetch: async () => new Response(null, { status: 503 }),
        },
      },
      String(id),
      generation,
    );
    const row = (await collection(db, "links").findOne({ _id: id }))!;
    expect(row.safetyScan!.lastError).toBe("reputation_unavailable");
    expect(row.safetyScan!.completedAt).toBeUndefined();
    expect(row.safetyScan!.dueAt.getTime() - Date.now()).toBeLessThan(6000);
  });
  test("real Redis shares host metadata and exact-URL threats across workers without trusting other paths", async () => {
    const { ctx } = await fixture();
    const host = `safety-${crypto.randomUUID()}.example.com`;
    let reputationRequests = 0,
      registrationRequests = 0;
    const provider = {
      webRiskApiKey: "synthetic-cache-key",
      fetch: async (input: string) => {
        const request = new URL(input);
        if (request.hostname === "rdap.org") {
          registrationRequests++;
          return Response.json({
            events: [
              {
                eventAction: "registration",
                eventDate: "2020-01-01T00:00:00Z",
              },
            ],
          });
        }
        reputationRequests++;
        return Response.json(
          request.searchParams.get("uri")?.endsWith("/bad")
            ? {
                threat: {
                  threatTypes: ["MALWARE"],
                  expireTime: new Date(Date.now() + 60000).toISOString(),
                },
              }
            : {},
        );
      },
    };
    const secondCache = cache.duplicate();
    await secondCache.ping();
    const hostPrefix = `safety:v1:host:${safetyDigest(host)}:`;
    try {
      const scan = async (path: string, store = cache) => {
        const result = await createLink(ctx, {
          url: `https://${host}/${path}`,
        });
        if (!result.ok) throw new Error(result.error);
        const id = new ObjectId(result.value.id);
        const row = (await collection(db, "links").findOne({ _id: id }))!;
        await runSafetyScan(
          { db, cache: store, linkDomain: "shortn.at", provider },
          String(id),
          row.safetyScan!.generation,
        );
        return (await collection(db, "links").findOne({ _id: id }))!;
      };
      expect((await scan("bad")).disabled).toBe(true);
      expect((await scan("bad", secondCache)).disabled).toBe(true);
      expect(reputationRequests).toBe(1);
      expect(registrationRequests).toBe(1);
      const keys = await cache.keys(`${hostPrefix}*`);
      expect(keys).toHaveLength(2);
      const threatKey = keys.find((key) => key.includes(":web-risk:"))!;
      expect(await cache.pttl(threatKey)).toBeGreaterThan(0);
      // Check the policy in seconds; Redis clocks can differ by a millisecond
      // between setting an absolute expiry and answering PTTL.
      expect(await cache.ttl(threatKey)).toBeLessThanOrEqual(60);
      expect(await cache.pttl(`${hostPrefix}rdap`)).toBeGreaterThan(86000000);
      expect((await scan("clean", secondCache)).disabled).toBe(false);
      expect(reputationRequests).toBe(2);
      expect(registrationRequests).toBe(1);
      await cache.pexpire(threatKey, 1);
      await Bun.sleep(5);
      expect((await scan("bad", secondCache)).disabled).toBe(true);
      expect(reputationRequests).toBe(3);
      expect(registrationRequests).toBe(1);
    } finally {
      const keys = await cache.keys(`${hostPrefix}*`);
      if (keys.length) await cache.del(...keys);
      secondCache.disconnect();
    }
  });
  test("bounded Mongo pumping and BullMQ restart recover pending jobs", async () => {
    const { ctx } = await fixture();
    const result = await createMany(
      ctx,
      Array.from({ length: 101 }, () => ({ url: "https://example.com/batch" })),
    );
    if (!result.ok) throw new Error(result.error);
    // Isolate this library from other tests' due work without flushing shared Redis.
    await collection(db, "links").updateMany(
      { workspaceId: { $ne: ctx.workspace._id } },
      { $set: { "safetyScan.dueAt": new Date(Date.now() + 86400000) } },
    );
    const queueName = `safety-test-${crypto.randomUUID()}`,
      errors: unknown[] = [];
    const deps = {
      db,
      cache,
      durable,
      linkDomain: "shortn.at",
      provider,
      queueName,
      log: (_message: string, error?: unknown) => {
        errors.push(error);
      },
    };
    const first = createSafetyWorker(deps);
    await first.worker.pause();
    await Promise.all([first.pump(), first.pump()]);
    expect(await first.queue.getWaitingCount()).toBe(50);
    await first.close();
    const second = createSafetyWorker(deps);
    try {
      const until = Date.now() + 10000;
      while (
        Date.now() < until &&
        (await collection(db, "links").countDocuments({
          workspaceId: ctx.workspace._id,
          "safetyScan.completedAt": { $exists: true },
        })) < 50
      )
        await Bun.sleep(20);
      expect(
        await collection(db, "links").countDocuments({
          workspaceId: ctx.workspace._id,
          "safetyScan.completedAt": { $exists: true },
        }),
      ).toBe(50);
      expect(
        await collection(db, "links").countDocuments({
          workspaceId: ctx.workspace._id,
          safetyStatus: "pending",
        }),
      ).toBe(52);
      expect(errors).toEqual([]);
    } finally {
      await second.worker.pause();
      await second.queue.obliterate({ force: true });
      await second.close();
    }
  }, 20000);
  test("pending legacy links are recovered in place and trash is excluded", async () => {
    const { ctx } = await fixture();
    await collection(db, "links").updateMany(
      {},
      { $set: { "safetyScan.dueAt": new Date(Date.now() + 86400000) } },
    );
    const live = new ObjectId(),
      trash = new ObjectId();
    await collection(db, "links").insertMany([
      {
        _id: live,
        workspaceId: ctx.workspace._id,
        longUrl: "https://example.com/legacy",
        urlCode: "legacy-recover",
        safetyStatus: "pending",
      },
      {
        _id: trash,
        workspaceId: ctx.workspace._id,
        longUrl: "https://example.com/trash",
        urlCode: "legacy-trash",
        safetyStatus: "pending",
        deletedAt: new Date(),
      },
    ]);
    const worker = createSafetyWorker({
      db,
      cache,
      durable,
      linkDomain: "shortn.at",
      provider,
      queueName: `legacy-safety-${crypto.randomUUID()}`,
      log: () => {},
    });
    await worker.worker.pause();
    try {
      await worker.pump();
      expect(
        (await collection(db, "links").findOne({ _id: live }))!.safetyScan!
          .generation,
      ).toBeString();
      expect(
        (await collection(db, "links").findOne({ _id: trash }))!.safetyScan,
      ).toBeUndefined();
      expect(await worker.queue.getWaitingCount()).toBe(1);
    } finally {
      await worker.queue.obliterate({ force: true });
      await worker.close();
    }
  });
});
