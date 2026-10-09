import { expect, test } from "bun:test";
import { createCache, keys } from "./index";
test("keys preserve case and escape ambiguous segments", () => {
  expect(keys.link("shortn.at", "AbC")).toBe("link:shortn.at:AbC");
  expect(keys.link("a:b", "c")).not.toBe(keys.link("a", "b:c"));
  expect(keys.usage("w", "2026-10", "links")).toBe("usage:w:2026-10:links");
  expect(keys.entitlements("w")).toBe("ent:w");
  expect(keys.clicksStream).toBe("clicks:stream");
});
test("single-flight coalesces misses and retries rejected loads", async () => {
  const stored = new Map<string, string>();
  const cache = createCache(
    {
      get: async (key) => stored.get(key) ?? null,
      set: async (key, value) => {
        stored.set(key, value);
        return "OK";
      },
      del: async (key) => Number(stored.delete(key)),
    },
    Number,
  );
  let loads = 0;
  const load = async () => {
    loads++;
    await Bun.sleep(5);
    return 42;
  };
  expect(
    await Promise.all([cache.get("k", 60, load), cache.get("k", 60, load)]),
  ).toEqual([42, 42]);
  expect(loads).toBe(1);
  await cache.invalidate("k");
  await expect(
    cache.get("k", 60, async () => {
      throw new Error("load failed");
    }),
  ).rejects.toThrow("load failed");
  expect(await cache.get("k", 60, load)).toBe(42);
});

test("invalidation during an in-flight load prevents stale repopulation", async () => {
  const stored = new Map<string, string>();
  const cache = createCache(
    {
      get: async (key) => stored.get(key) ?? null,
      set: async (key, value) => {
        stored.set(key, value);
        return "OK";
      },
      del: async (key) => Number(stored.delete(key)),
    },
    Number,
  );
  let finish: ((value: number) => void) | undefined;
  const gate = new Promise<number>((resolve) => {
    finish = resolve;
  });
  let started: (() => void) | undefined;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const first = cache.get("key", 30, async () => {
    started?.();
    return gate;
  });
  await ready;
  await cache.invalidate("key");
  expect(await cache.get("key", 30, async () => 99)).toBe(99);
  finish?.(1);
  expect(await first).toBe(1);
  expect(stored.get("key")).toBe("99");
});

test("cache hits avoid loading and invalid TTLs are rejected", async () => {
  const cache = createCache(
    { get: async () => "7", set: async () => "OK", del: async () => 1 },
    Number,
  );
  expect(
    await cache.get("key", 30, async () => {
      throw new Error("must not run");
    }),
  ).toBe(7);
  await expect(cache.get("key", 0, async () => 0)).rejects.toThrow("TTL");
});
