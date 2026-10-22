import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { restoreLink, takedownLink } from "@shortn/core";
import { physicalNames } from "@shortn/db";
import { keys, linkInvalidateChannel } from "@shortn/redis";
import { Redis } from "ioredis";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { createResolver, mongoLinkLoader, parseInvalidation } from "./resolver";

const mongoUrl = process.env.MONGO_TEST_URL;
const redisUrl = process.env.REDIS_TEST_URL;
if ((!mongoUrl || !redisUrl) && process.env.REQUIRE_INTEGRATION === "1")
  throw new Error("Mongo and Redis fixtures required");

// The change-stream invalidator only evicts root-domain keys (doc 23 F7), so
// a custom-domain takedown must invalidate by the link's own domain.
(mongoUrl && redisUrl ? describe : describe.skip)(
  "takedown of a custom-domain link reaches warm redirect caches",
  () => {
    let client: MongoClient, db: Db, cache: Redis, subscriber: Redis;
    const domain = `go-${crypto.randomUUID().slice(0, 8)}.example`;
    const key = "promo";
    const linkId = new ObjectId();
    const replica = () => createResolver(cache, mongoLinkLoader(db));
    const replicas = [] as ReturnType<typeof replica>[];
    let delivered = 0;

    beforeAll(async () => {
      for (const url of [mongoUrl!, redisUrl!])
        if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname))
          throw new Error("Loopback fixtures required");
      client = await new MongoClient(mongoUrl!).connect();
      db = client.db(
        `shortn_takedown_${crypto.randomUUID().replaceAll("-", "")}`,
      );
      cache = new Redis(redisUrl!);
      subscriber = new Redis(redisUrl!);
      replicas.push(replica(), replica());
      // Mirrors apps/redirect/src/index.ts: each replica evicts its L1 on
      // every invalidation message.
      subscriber.on("message", (channel, payload) => {
        if (channel !== linkInvalidateChannel) return;
        const message = parseInvalidation(payload);
        for (const resolver of replicas)
          if (message) resolver.evict(message);
          else resolver.memory.clear();
        // Other suites share this Redis channel; count only this domain.
        if (message?.domain === domain) delivered++;
      });
      await subscriber.subscribe(linkInvalidateChannel);
      await db.collection(physicalNames.links).insertOne({
        _id: linkId,
        workspaceId: new ObjectId(),
        domain,
        key,
        longUrl: "https://example.com/landing",
        safetyStatus: "safe",
      });
    });
    afterAll(async () => {
      await cache?.del(keys.link(domain, key));
      await db?.dropDatabase();
      await client?.close();
      subscriber?.disconnect();
      cache?.disconnect();
    });

    const settle = async (count: number) => {
      for (let i = 0; i < 50 && delivered < count; i++) await Bun.sleep(20);
      expect(delivered).toBeGreaterThanOrEqual(count);
    };

    test("Redis and every warm L1 drop the entry at once, and restore brings it back", async () => {
      for (const resolver of replicas)
        expect(await resolver.resolve(domain, key)).toMatchObject({
          kind: "link",
          status: "ok",
        });
      expect(await cache.exists(keys.link(domain, key))).toBe(1);

      const deps = { db, cache, linkDomain: "shortn.at" };
      const taken = await takedownLink(deps, linkId, {
        category: "phishing",
        by: "staff",
      });
      expect(taken.ok).toBe(true);
      await settle(1);
      expect(await cache.exists(keys.link(domain, key))).toBe(0);
      for (const resolver of replicas)
        expect(await resolver.resolve(domain, key)).toMatchObject({
          status: "blocked",
        });

      expect((await restoreLink(deps, linkId)).ok).toBe(true);
      await settle(2);
      for (const resolver of replicas)
        expect(await resolver.resolve(domain, key)).toMatchObject({
          status: "ok",
        });
    });
  },
);
