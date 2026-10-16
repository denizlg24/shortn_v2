import { createRestApi } from "../../api/src/rest";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { Redis } from "ioredis";
import { physicalNames as names, collection } from "@shortn/db";
import {
  createLink,
  createApiKey,
  ensurePersonalWorkspace,
  encodeClickMessage,
  decodeClickMessage,
  queryAnalytics,
  recomputeRollups,
  type ClickMessage,
  type ServiceContext,
} from "@shortn/core";
import { createResolver, mongoLinkLoader } from "../../redirect/src/resolver";
import { createApp } from "../../redirect/src/app";
import { writeBatch } from "./ingest";
const mongo = process.env.MONGO_TEST_URL,
  cacheUrl = process.env.REDIS_TEST_URL;
(mongo && cacheUrl ? describe : describe.skip)(
  "targeting branch pipeline",
  () => {
    let client: MongoClient, db: Db, cache: Redis;
    beforeAll(async () => {
      if (
        ![mongo, cacheUrl].every((url) =>
          ["localhost", "127.0.0.1"].includes(new URL(url!).hostname),
        )
      )
        throw new Error("Loopback services required");
      client = await new MongoClient(mongo!).connect();
      db = client.db(
        `shortn_targets_${crypto.randomUUID().replaceAll("-", "")}`,
      );
      cache = new Redis(cacheUrl!);
      await db
        .collection(names.click_rollups)
        .createIndex({ linkId: 1, day: 1 }, { unique: true });
    });
    afterAll(async () => {
      await db?.dropDatabase();
      await client?.close();
      cache?.disconnect();
    });
    test("cached redirects persist branches once and expose scoped branch breakdown/filter/rollups", async () => {
      const userId = new ObjectId().toHexString(),
        workspace = await ensurePersonalWorkspace(db, {
          id: userId,
          name: "Targets",
          sub: `target|${userId}`,
        });
      await db.collection(names.subscriptions).insertOne({
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
      const created = await createLink(ctx, {
        url: "https://example.com/default",
        rules: {
          device: [{ os: "ios", url: "https://example.com/ios" }],
          geo: [{ country: "PT", url: "https://example.com/pt" }],
          utm: { source: "configured" },
          forwardQuery: true,
        },
      });
      if (!created.ok) throw new Error(created.error);
      const id = new ObjectId(created.value.id);
      await collection(db, "links").updateOne(
        { _id: id },
        { $set: { safetyStatus: "safe", requiresInterstitial: false } },
      );
      let loads = 0;
      const load = mongoLinkLoader(db);
      const resolver = createResolver(cache, async (domain, key) => {
        loads++;
        return load(domain, key);
      });
      const messages: ClickMessage[] = [];
      const app = createApp({
        resolver,
        enqueue: (message) => messages.push(message),
        health: async () => true,
        secrets: { legacy: new Uint8Array(32) },
        origin: "https://shortn.at",
        linkDomain: "shortn.at",
      });
      try {
        const rows = [
          {
            ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
            country: "PT",
            path: "/ios",
            branch: "device:0",
          },
          {
            ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
            country: "PT",
            path: "/pt",
            branch: "geo:0",
          },
          {
            ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
            country: "US",
            path: "/default",
            branch: "destination",
          },
        ];
        for (const row of rows) {
          const response = await app.request(
            `/${created.value.key}?utm_source=incoming&branch=spoofed&extra=ok`,
            { headers: { "user-agent": row.ua, "cf-ipcountry": row.country } },
          );
          expect(response.status).toBe(302);
          const target = new URL(response.headers.get("location")!);
          expect(target.pathname).toBe(row.path);
          expect(target.searchParams.get("utm_source")).toBe("configured");
          expect(target.searchParams.get("extra")).toBe("ok");
          expect(messages.at(-1)!.branch).toBe(row.branch);
        }
        expect(loads).toBe(1);
        const l2 = createResolver(cache, async (domain, key) => {
          loads++;
          return load(domain, key);
        });
        const warm = await l2.resolve("shortn.at", created.value.key);
        expect(warm.kind === "link" && warm.rules?.geo?.[0]?.country).toBe(
          "PT",
        );
        expect(loads).toBe(1);

        const entries = messages.map((message, index) => ({
          sid: `target-${index}`,
          message: decodeClickMessage(encodeClickMessage(message)),
        }));
        await writeBatch(db, entries, { redelivered: false, ipSecret: "stub" });
        await writeBatch(db, entries, { redelivered: true, ipSecret: "stub" });
        expect(
          await collection(db, "click_events").countDocuments({
            "m.linkId": id,
          }),
        ).toBe(3);
        const events = await collection(db, "click_events")
          .find({ "m.linkId": id })
          .toArray();
        expect(events.map((event) => event.m.branch)).toEqual(
          rows.map((row) => row.branch),
        );
        const from = new Date(Date.now() - 3600000),
          to = new Date(Date.now() + 3600000);
        const analytics = await queryAnalytics(ctx, {
          scope: { type: "link", id: String(id) },
          from: from.toISOString(),
          to: to.toISOString(),
          timezone: "UTC",
          dimensions: ["branch"],
          series: false,
          compare: false,
        });
        if (!analytics.ok) throw new Error(analytics.error);
        expect(analytics.value.breakdowns.branch).toHaveLength(3);
        const filtered = await queryAnalytics(ctx, {
          scope: { type: "link", id: String(id) },
          from: from.toISOString(),
          to: to.toISOString(),
          timezone: "UTC",
          dimensions: ["branch"],
          filters: { branch: "geo:0" },
          series: false,
          compare: false,
        });
        expect(filtered.ok && filtered.value.totals.clicks).toBe(1);
        await collection(db, "workspaces").updateOne(
          { _id: workspace._id },
          { $set: { platformFeatures: { api: true } } },
        );
        const pepper = "target-fixture-pepper".repeat(3),
          key = await createApiKey(
            ctx,
            { name: "Branch analytics", scopes: ["analytics:read"] },
            pepper,
          );
        if (!key.ok) throw new Error(key.error);
        try {
          const api = createRestApi({
            db,
            cache,
            durable: cache,
            pepper,
            linkDomain: "shortn.at",
            rolloutPercent: 0,
            clientIp: () => undefined,
            log: () => {},
          });
          const query = new URLSearchParams({
            from: from.toISOString(),
            to: to.toISOString(),
            groupBy: "branch",
            branch: "geo:0",
          });
          const response = await api.request(
            `/v1/links/${id}/analytics?${query}`,
            { headers: { Authorization: `Bearer ${key.value.secret}` } },
          );
          expect(response.status).toBe(200);
          expect(await response.json()).toMatchObject({
            totals: { clicks: 1 },
            breakdowns: { branch: [{ value: "geo:0", clicks: 1 }] },
          });
        } finally {
          await cache.del(
            `api:rate:${key.value.key.id}`,
            `apikey:last-used:${key.value.key.id}`,
          );
        }

        await recomputeRollups(db, from, to, [id]);
        const rollup = await collection(db, "click_rollups").findOne({
          linkId: id,
        });
        expect(rollup!.byBranch).toEqual({
          "device:0": 1,
          "geo:0": 1,
          destination: 1,
        });
      } finally {
        await cache.del(`link:shortn.at:${created.value.key}`);
      }
    });
    test("rotation remains sticky through HTTP and preserves its branch through ingestion and rollups", async () => {
      const userId = new ObjectId().toHexString(),
        workspace = await ensurePersonalWorkspace(db, {
          id: userId,
          name: "Rotation",
        });
      const ctx: ServiceContext = {
        db,
        cache,
        workspace,
        actor: { userId, role: "owner" },
        linkDomain: "shortn.at",
      };
      const created = await createLink(ctx, {
        url: "https://example.com/default",
        rules: {
          rotation: [
            { url: "https://example.com/a", weight: 1 },
            { url: "https://example.com/b", weight: 3 },
          ],
        },
      });
      if (!created.ok) throw new Error(created.error);
      expect(Object.hasOwn(created.value.rules!, "rotationKey")).toBe(false);
      const id = new ObjectId(created.value.id);
      await collection(db, "links").updateOne(
        { _id: id },
        { $set: { safetyStatus: "safe", requiresInterstitial: false } },
      );
      const resolver = createResolver(cache, mongoLinkLoader(db)),
        messages: ClickMessage[] = [];
      const app = createApp({
        resolver,
        enqueue: (message) => messages.push(message),
        health: async () => true,
        secrets: { legacy: new Uint8Array(32) },
        origin: "https://shortn.at",
        linkDomain: "shortn.at",
      });
      try {
        const first = await app.request(`/${created.value.key}`),
          cookie = first.headers.get("Set-Cookie")!.split(";")[0]!;
        const second = await app.request(`/${created.value.key}`, {
          headers: { Cookie: cookie },
        });
        expect(first.status).toBe(302);
        expect(second.headers.get("location")).toBe(
          first.headers.get("location"),
        );
        expect(second.headers.get("Set-Cookie")).toBeNull();
        expect(messages).toHaveLength(2);
        expect(messages[1]!.branch).toBe(messages[0]!.branch);
        expect(messages[0]!.branch).toMatch(/^rotation:[01]$/);
        const entries = messages.map((message, index) => ({
          sid: `rotation-${index}`,
          message: decodeClickMessage(encodeClickMessage(message)),
        }));
        await writeBatch(db, entries, { redelivered: false, ipSecret: "stub" });
        await writeBatch(db, entries, { redelivered: true, ipSecret: "stub" });
        const events = await collection(db, "click_events")
          .find({ "m.linkId": id })
          .toArray();
        expect(events).toHaveLength(2);
        expect(
          events.every((event) => event.m.branch === messages[0]!.branch),
        ).toBe(true);
        await recomputeRollups(
          db,
          new Date(Date.now() - 3600000),
          new Date(Date.now() + 3600000),
          [id],
        );
        expect(
          (await collection(db, "click_rollups").findOne({ linkId: id }))!
            .byBranch,
        ).toEqual({ [messages[0]!.branch!]: 2 });
      } finally {
        await cache.del(`link:shortn.at:${created.value.key}`);
      }
    });
    test("deep handoff branches survive replay, filtering and daily rollups", async () => {
      const userId = new ObjectId().toHexString();
      const workspace = await ensurePersonalWorkspace(db, {
        id: userId,
        name: "Deep links",
      });
      await db.collection(names.subscriptions).insertOne({
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
      const created = await createLink(ctx, {
        url: "https://example.com/default",
        rules: {
          deepLink: {
            ios: "youtube://watch?v=123",
            android: "spotify:track:abc",
            fallback: "web",
          },
        },
      });
      if (!created.ok) throw new Error(created.error);
      const id = new ObjectId(created.value.id);
      await collection(db, "links").updateOne(
        { _id: id },
        { $set: { safetyStatus: "safe", requiresInterstitial: false } },
      );
      const resolver = createResolver(cache, mongoLinkLoader(db)),
        messages: ClickMessage[] = [];
      const app = createApp({
        resolver,
        enqueue: (message) => messages.push(message),
        health: async () => true,
        secrets: { legacy: new Uint8Array(32) },
        origin: "https://shortn.at",
        linkDomain: "shortn.at",
      });
      try {
        for (const ua of [
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
          "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36",
        ])
          expect(
            (
              await app.request(`/${created.value.key}`, {
                headers: { "user-agent": ua },
              })
            ).status,
          ).toBe(200);
        const entries = messages.map((message, index) => ({
          sid: `deep-${index}`,
          message: decodeClickMessage(encodeClickMessage(message)),
        }));
        await writeBatch(db, entries, { redelivered: false, ipSecret: "stub" });
        await writeBatch(db, entries, { redelivered: true, ipSecret: "stub" });
        const events = await collection(db, "click_events")
          .find({ "m.linkId": id })
          .toArray();
        expect(events).toHaveLength(2);
        expect(events.map((event) => event.m.branch).sort()).toEqual([
          "deep:android",
          "deep:ios",
        ]);
        const from = new Date(Date.now() - 3600000),
          to = new Date(Date.now() + 3600000);
        await recomputeRollups(db, from, to, [id]);
        expect(
          (await collection(db, "click_rollups").findOne({ linkId: id }))!
            .byBranch,
        ).toEqual({ "deep:ios": 1, "deep:android": 1 });
        const result = await queryAnalytics(ctx, {
          scope: { type: "link", id: String(id) },
          from: from.toISOString(),
          to: to.toISOString(),
          timezone: "UTC",
          dimensions: ["branch"],
          filters: { branch: "deep:ios" },
          series: false,
          compare: false,
        });
        expect(result.ok && result.value.totals.clicks).toBe(1);
      } finally {
        await cache.del(`link:shortn.at:${created.value.key}`);
      }
    });
  },
);
