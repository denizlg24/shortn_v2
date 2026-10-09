import { describe, expect, test } from "bun:test";
import { createCache, createRedisClients, keys } from "./index";
const cacheUrl = process.env.REDIS_TEST_URL;
const durableUrl = process.env.REDIS_DURABLE_TEST_URL;
if (!cacheUrl || !durableUrl)
  console.log(
    "SKIP Redis integration: set REDIS_TEST_URL and REDIS_DURABLE_TEST_URL to the two local test instances",
  );
if ((!cacheUrl || !durableUrl) && process.env.REQUIRE_INTEGRATION === "1")
  throw new Error("Both Redis test URLs required when REQUIRE_INTEGRATION=1");
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
      const clients = await createRedisClients({
        REDIS_CACHE_URL: cacheUrl,
        REDIS_DURABLE_URL: durableUrl,
      });
      const key = keys.link("fixture.test", crypto.randomUUID());
      const stream = `test:${crypto.randomUUID()}:${keys.clicksStream}`;
      try {
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

(cacheUrl && durableUrl ? describe : describe.skip)(
  "Redis safety integration",
  () => {
    function urls() {
      if (!cacheUrl || !durableUrl) throw new Error("Missing Redis test URLs");
      for (const url of [cacheUrl, durableUrl])
        if (
          !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)
        )
          throw new Error("Local Redis required");
      return { REDIS_CACHE_URL: cacheUrl, REDIS_DURABLE_URL: durableUrl };
    }
    test("startup refuses eviction and disabled AOF, and configures bounded queues/timeouts", async () => {
      const config = urls();
      await expect(
        createRedisClients({
          ...config,
          REDIS_DURABLE_URL: config.REDIS_CACHE_URL,
        }),
      ).rejects.toThrow("noeviction");
      const clients = await createRedisClients(config);
      try {
        expect(clients.cache.options.enableOfflineQueue).toBe(false);
        expect(clients.cache.options.commandTimeout).toBe(1000);
        expect(clients.cache.options.connectTimeout).toBe(1000);
        expect(clients.durable.options.enableOfflineQueue).toBe(false);
        expect(clients.durable.options.maxRetriesPerRequest).toBe(2);
        const { assertDurableRedis } = await import("./index");
        await clients.durable.config("SET", "appendonly", "no");
        await expect(assertDurableRedis(clients.durable)).rejects.toThrow(
          "AOF",
        );
      } finally {
        await clients.durable.config("SET", "appendonly", "yes");
        clients.cache.disconnect();
        clients.durable.disconnect();
      }
      await expect(
        createRedisClients({
          ...config,
          NODE_ENV: "production",
          REDIS_DURABLE_URL: config.REDIS_CACHE_URL,
        }),
      ).rejects.toThrow("must differ");
    }, 15000);
    test("invalidation from a separate process prevents stale loader writes; corrupt entries and outages reload", async () => {
      const config = urls();
      const clients = await createRedisClients(config);
      const key = keys.link("Fixture.TEST.:443", crypto.randomUUID());
      const { generationKey } = await import("./index");
      const cache = createCache(clients.cache, (encoded) => {
        if (encoded === "corrupt") throw new Error("decode");
        return Number(encoded);
      });
      let finish: ((value: number) => void) | undefined;
      let start: (() => void) | undefined;
      const gate = new Promise<number>((resolve) => {
        finish = resolve;
      });
      const ready = new Promise<void>((resolve) => {
        start = resolve;
      });
      let disconnected = false;
      try {
        const first = cache.get(key, 30, async () => {
          start?.();
          return gate;
        });
        await ready;
        const child = Bun.spawn(
          [
            "bun",
            "-e",
            `import {Redis} from "ioredis"; import {createCache} from "./index"; const redis=new Redis(process.env.FIXTURE_CACHE_URL,{lazyConnect:true,enableOfflineQueue:false}); try {await redis.connect(); await createCache(redis,Number).invalidate(process.env.FIXTURE_KEY);} finally {redis.disconnect();}`,
          ],
          {
            cwd: import.meta.dir,
            env: {
              ...process.env,
              FIXTURE_CACHE_URL: config.REDIS_CACHE_URL,
              FIXTURE_KEY: key,
            },
            stdout: "pipe",
            stderr: "pipe",
          },
        );
        const [exit, stderr] = await Promise.all([
          child.exited,
          new Response(child.stderr).text(),
        ]);
        expect(stderr).toBe("");
        expect(exit).toBe(0);
        finish?.(1);
        expect(await first).toBe(1);
        expect(await clients.cache.get(key)).toBeNull();
        expect(await cache.get(key, 30, async () => 99)).toBe(99);
        await clients.cache.set(key, "corrupt");
        expect(await cache.get(key, 30, async () => 100)).toBe(100);
        expect(await clients.cache.get(key)).toBe("100");
        await clients.cache.del(key, generationKey(key));
        disconnected = true;
        clients.cache.disconnect();
        expect(await cache.get(key, 30, async () => 101)).toBe(101);
      } finally {
        finish?.(1);
        if (!disconnected && clients.cache.status === "ready")
          await clients.cache.del(key, generationKey(key));
        clients.cache.disconnect();
        clients.durable.disconnect();
      }
    }, 15000);
  },
);
