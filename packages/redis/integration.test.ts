import { describe, expect, test } from "bun:test";
import { createCache, createRedisClients, keys } from "./index";
const cacheUrl = process.env.REDIS_TEST_URL;
const durableUrl = process.env.REDIS_DURABLE_TEST_URL;
if (!cacheUrl || !durableUrl)
  console.log(
    "SKIP Redis integration: set REDIS_TEST_URL and REDIS_DURABLE_TEST_URL to the two local test instances",
  );
(cacheUrl && durableUrl ? describe : describe.skip)(
  "Redis instances integration",
  () => {
    test("cache TTL, single-flight, invalidation and durable stream isolation", async () => {
      if (!cacheUrl || !durableUrl) throw new Error("Missing Redis test URLs");
      for (const url of [cacheUrl, durableUrl])
        if (
          !["localhost", "127.0.0.1", "redis-cache", "redis-durable"].includes(
            new URL(url).hostname,
          )
        )
          throw new Error(
            "Integration tests only connect to local fixture services",
          );
      const clients = createRedisClients({
        REDIS_CACHE_URL: cacheUrl,
        REDIS_DURABLE_URL: durableUrl,
      });
      const key = keys.link("fixture.test", crypto.randomUUID());
      const stream = `test:${crypto.randomUUID()}:${keys.clicksStream}`;
      try {
        await Promise.all([clients.cache.connect(), clients.durable.connect()]);
        const cache = createCache(clients.cache, Number);
        let calls = 0;
        const load = async () => {
          calls++;
          await Bun.sleep(10);
          return 42;
        };
        expect(
          await Promise.all([
            cache.get(key, 60, load),
            cache.get(key, 60, load),
          ]),
        ).toEqual([42, 42]);
        expect(calls).toBe(1);
        expect(await clients.cache.ttl(key)).toBeGreaterThan(0);
        expect(await clients.durable.get(key)).toBeNull();
        await cache.invalidate(key);
        expect(await clients.cache.get(key)).toBeNull();
        await clients.durable.xadd(stream, "*", "key", key);
        expect(await clients.durable.xlen(stream)).toBe(1);
        expect(await clients.cache.exists(stream)).toBe(0);
      } finally {
        try {
          if (clients.cache.status === "ready") await clients.cache.del(key);
          if (clients.durable.status === "ready")
            await clients.durable.del(stream);
        } finally {
          clients.cache.disconnect();
          clients.durable.disconnect();
        }
      }
    }, 15_000);
  },
);
