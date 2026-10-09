import { expect, test } from "bun:test";
import { cacheScripts, createCache, keys } from "./index";
import type { CacheStore } from "./index";
function fixture() {
  const data = new Map<string, string>();
  const store: CacheStore = {
    async eval(script, _number, ...args) {
      const [key, generation, token, value] = args;
      if (
        typeof key !== "string" ||
        typeof generation !== "string" ||
        typeof token !== "string"
      )
        throw new Error("Bad fixture arguments");
      if (script === cacheScripts.read) {
        if (!data.has(generation)) data.set(generation, token);
        return [data.get(generation), data.get(key) ?? null];
      }
      if (script === cacheScripts.invalidate) {
        data.set(generation, token);
        return Number(data.delete(key));
      }
      if (data.get(generation) === token && typeof value === "string") {
        data.set(key, value);
        return "OK";
      }
      return null;
    },
    del: async (key) => Number(data.delete(key)),
  };
  return { data, store, cache: createCache(store, Number) };
}
test("keys normalize domain case, trailing dot and port while preserving key case", () => {
  expect(keys.link("Shortn.AT.:443", "AbC")).toBe("link:shortn.at:AbC");
  expect(keys.link("shortn.at", "AbC")).not.toBe(keys.link("shortn.at", "abc"));
  expect(keys.usage("w", "2026-10", "links")).toBe("usage:w:2026-10:links");
  expect(keys.entitlements("w")).toBe("ent:w");
  expect(keys.clicksStream).toBe("clicks:stream");
});
test("single-flight coalesces misses and retries rejected loads", async () => {
  const { cache } = fixture();
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
test("another cache instance invalidates an in-flight load and prevents stale repopulation", async () => {
  const { store, cache, data } = fixture();
  const other = createCache(store, Number);
  let finish: ((value: number) => void) | undefined;
  const gate = new Promise<number>((resolve) => {
    finish = resolve;
  });
  let start: (() => void) | undefined;
  const ready = new Promise<void>((resolve) => {
    start = resolve;
  });
  const first = cache.get("key", 30, async () => {
    start?.();
    return gate;
  });
  await ready;
  await other.invalidate("key");
  expect(await other.get("key", 30, async () => 99)).toBe(99);
  finish?.(1);
  expect(await first).toBe(1);
  expect(data.get("key")).toBe("99");
});
test("cache hits avoid loads and invalid TTLs are rejected", async () => {
  const { data, cache } = fixture();
  data.set("key", "7");
  expect(
    await cache.get("key", 30, async () => {
      throw new Error("must not run");
    }),
  ).toBe(7);
  await expect(cache.get("key", 0, async () => 0)).rejects.toThrow("TTL");
});
test("read and write cache outages fall back to the loader", async () => {
  for (const fail of [cacheScripts.read, cacheScripts.write]) {
    const { store } = fixture();
    const normal = store.eval.bind(store);
    store.eval = async (...args) => {
      if (args[0] === fail) throw new Error("offline");
      return normal(...args);
    };
    let loads = 0;
    const cache = createCache(store, Number);
    expect(
      await cache.get("k", 30, async () => {
        loads++;
        return 7;
      }),
    ).toBe(7);
    expect(loads).toBe(1);
  }
});
test("decode failure deletes the poisoned key and reloads", async () => {
  const { store, data } = fixture();
  data.set("k", "poison");
  let deletes = 0;
  const del = store.del;
  store.del = async (key) => {
    deletes++;
    return del(key);
  };
  const cache = createCache(store, (encoded) => {
    if (encoded === "poison") throw new Error("decode failed");
    return Number(encoded);
  });
  expect(await cache.get("k", 30, async () => 8)).toBe(8);
  expect(deletes).toBe(1);
  expect(data.get("k")).toBe("8");
});
test("generation eviction does not allow an older load to repopulate", async () => {
  const { store, data } = fixture();
  let token: string | undefined;
  const reply = await store.eval(cacheScripts.read, 2, "k", "g", "old");
  if (Array.isArray(reply) && typeof reply[0] === "string") token = reply[0];
  data.delete("g");
  await store.eval(cacheScripts.read, 2, "k", "g", "new");
  await store.eval(
    cacheScripts.write,
    2,
    "k",
    "g",
    token ?? "old",
    "stale",
    30,
  );
  expect(data.has("k")).toBe(false);
});
