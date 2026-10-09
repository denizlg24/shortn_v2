import { expect, test } from "bun:test";
import { encodeSecret } from "@shortn/core";
import type { CachedLink, ClickMessage } from "@shortn/core";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app";
import { createClickQueue } from "./clicks";
import { createResolver, MemoryLayer, parseInvalidation } from "./resolver";

const id = "0123456789abcdef01234567";
const links: Record<string, CachedLink> = {
  abc: {
    kind: "link",
    id,
    key: "abc",
    dest: "https://example.com/x",
    status: "ok",
    pwd: false,
  },
  qr1: {
    kind: "link",
    id,
    key: "qr1",
    dest: "https://example.com/qr",
    status: "ok",
    pwd: false,
    qr: { id: "abcdefabcdefabcdefabcdef", publicId: "pub" },
  },
  old: { kind: "alias", id, key: "abc" },
};

function setup(overrides: { edgeAuthSecret?: string; failing?: boolean } = {}) {
  const enqueued: ClickMessage[] = [];
  const resolved: string[] = [];
  const app = createApp({
    resolver: {
      async resolve(domain, key) {
        resolved.push(`${domain}/${key}`);
        if (overrides.failing) throw new Error("mongo down");
        return links[key] ?? { kind: "missing" };
      },
    },
    enqueue: (message) => enqueued.push(message),
    health: async () => true,
    secrets: { legacy: encodeSecret("legacy-secret") },
    origin: "https://shortn.at",
    linkDomain: "shortn.at",
    edgeAuthSecret: overrides.edgeAuthSecret,
    log: () => {},
  });
  return { app, enqueued, resolved };
}

test("redirects to the destination with legacy headers and enqueues one click", async () => {
  const { app, enqueued } = setup();
  const response = await app.request("/abc?utm_source=news", {
    headers: {
      "cf-connecting-ip": "203.0.113.9",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
      "cf-ipcountry": "PT",
    },
  });
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe("https://example.com/x");
  expect(response.headers.get("cache-control")).toBe("private, max-age=0");
  expect(response.headers.get("referrer-policy")).toBe(
    "strict-origin-when-cross-origin",
  );
  expect(enqueued).toHaveLength(1);
  expect(enqueued[0]).toMatchObject({
    linkId: id,
    key: "abc",
    domain: "shortn.at",
    bot: false,
    ip: "203.0.113.9",
    country: "PT",
    query: { utm_source: "news" },
  });
});

test("legacy /qr/ paths and trailing slashes resolve the same key; QR links carry the scan target", async () => {
  const { app, enqueued } = setup();
  for (const path of ["/qr/qr1", "/qr1/"]) {
    const response = await app.request(path);
    expect(response.headers.get("location")).toBe("https://example.com/qr");
  }
  expect(enqueued.map((message) => message.qrId)).toEqual([
    "abcdefabcdefabcdefabcdef",
    "abcdefabcdefabcdefabcdef",
  ]);
});

test("missing keys go to the not-found page, aliases 301, bots are flagged", async () => {
  const { app, enqueued } = setup();
  const missing = await app.request("/nope", {
    headers: { cookie: "NEXT_LOCALE=pt" },
  });
  expect(missing.headers.get("location")).toBe(
    "https://shortn.at/en/url-not-found",
  );
  const alias = await app.request("/old");
  expect(alias.status).toBe(301);
  expect(alias.headers.get("location")).toBe("https://shortn.at/abc");
  expect(enqueued).toHaveLength(0);
  await app.request("/abc", { headers: { "user-agent": "Slackbot 1.0" } });
  expect(enqueued[0]?.bot).toBe(true);
});

test("paths that belong to legacy are never resolved", async () => {
  const { app, resolved } = setup();
  for (const path of ["/pricing", "/en/dashboard", "/logo.png", "/a/b"])
    expect((await app.request(path)).status).toBe(404);
  expect(resolved).toHaveLength(0);
});

test("resolution failures answer 503 with Retry-After rather than a wrong redirect", async () => {
  const { app } = setup({ failing: true });
  const response = await app.request("/abc");
  expect(response.status).toBe(503);
  expect(response.headers.get("retry-after")).toBe("5");
});

test("the edge secret is enforced when configured, except for health", async () => {
  const { app } = setup({ edgeAuthSecret: "edge" });
  expect((await app.request("/abc")).status).toBe(403);
  expect(
    (await app.request("/abc", { headers: { "x-edge-auth": "edge" } })).status,
  ).toBe(302);
  expect((await app.request("/__health")).status).toBe(200);
});

test("memory layer expires entries and evicts the oldest beyond capacity", async () => {
  const memory = new MemoryLayer(2, 20);
  const value: CachedLink = { kind: "missing" };
  memory.set("a", value);
  memory.set("b", value);
  memory.set("c", value);
  expect(memory.get("a")).toBeUndefined();
  expect(memory.get("c")).toEqual(value);
  await Bun.sleep(30);
  expect(memory.get("c")).toBeUndefined();
});

test("resolver serves memory hits, loads misses once, and evicts on invalidation", async () => {
  const data = new Map<string, string>();
  const store = {
    async eval(script: string, _keys: number, ...args: (string | number)[]) {
      const [key, generation, token, value] = args.map(String);
      if (!key || !generation || !token) throw new Error("bad args");
      if (script.includes("redis.call('GET', KEYS[2])\nif not token")) {
        if (!data.has(generation)) data.set(generation, token);
        return [data.get(generation), data.get(key) ?? null];
      }
      if (script.includes("'EX'")) {
        if (data.get(generation) === token && value) data.set(key, value);
        return "OK";
      }
      data.set(generation, token);
      return Number(data.delete(key));
    },
    del: async (key: string) => Number(data.delete(key)),
  };
  let loads = 0;
  const resolver = createResolver(store, async () => {
    loads++;
    return links.abc ?? { kind: "missing" };
  });
  await resolver.resolve("shortn.at", "abc");
  await resolver.resolve("shortn.at", "abc");
  expect(loads).toBe(1);
  expect(data.get("link:shortn.at:abc")).toContain("example.com");
  const message = parseInvalidation('{"domain":"shortn.at","keys":["abc"]}');
  expect(message).toEqual({ domain: "shortn.at", keys: ["abc"] });
  if (message) resolver.evict(message);
  expect(resolver.memory.size).toBe(0);
  expect(parseInvalidation("nope")).toBeUndefined();
});

test("click queue spools while Redis fails and replays in order", async () => {
  const path = join(tmpdir(), `spool-${crypto.randomUUID()}.ndjson`);
  const written: string[] = [];
  let up = false;
  const stream = {
    async xadd(_key: string, _id: string, ...fields: string[]) {
      if (!up) throw new Error("redis down");
      written.push(fields[1] ?? "");
      return "1-0";
    },
  };
  const queue = createClickQueue(stream, path, () => {});
  const message = (key: string): ClickMessage => ({
    v: 1,
    ts: Date.now(),
    linkId: id,
    domain: "shortn.at",
    key,
    bot: false,
  });
  queue.enqueue(message("a"));
  await Bun.sleep(10);
  queue.enqueue(message("b"));
  await Bun.sleep(10);
  expect(queue.spooled).toBe(2);
  const restarted = createClickQueue(stream, path, () => {});
  await restarted.load();
  expect(restarted.spooled).toBe(2);
  up = true;
  await queue.drain();
  expect(queue.spooled).toBe(0);
  expect(written.map((payload) => JSON.parse(payload).key)).toEqual(["a", "b"]);
  expect(await Bun.file(path).exists()).toBe(false);
  await rm(path, { force: true });
});
