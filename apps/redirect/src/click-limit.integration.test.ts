import { describe, expect, test } from "bun:test";
import Redis from "ioredis";
import { ObjectId } from "mongodb";
import { encodeSecret, type CachedLink, type ClickMessage } from "@shortn/core";
import {
  countedClickScript,
  hotClickCountKey,
  incrementUntrackedClickCount,
  readHotClickCount,
} from "@shortn/redis";
import { createApp } from "./app";
import { createClickQueue } from "./clicks";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const url = process.env.REDIS_DURABLE_TEST_URL;
if (!url && process.env.REQUIRE_INTEGRATION === "1")
  throw new Error("Redis fixture required");
async function fixture(run: (redis: Redis, id: string) => Promise<void>) {
  if (
    !url ||
    !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)
  )
    throw new Error("Local Redis required");
  const redis = new Redis(url);
  const id = new ObjectId().toHexString();
  try {
    await run(redis, id);
  } finally {
    await redis.del(hotClickCountKey(id));
    redis.disconnect();
  }
}
async function until(check: () => Promise<boolean>) {
  for (let n = 0; n < 100; n++) {
    if (await check()) return;
    await Bun.sleep(10);
  }
  throw new Error("Counter did not settle");
}
(url ? describe : describe.skip)("maximum clicks with durable Redis", () => {
  test("historical seeding reconciles without addition, rejects corruption, and failed XADD does not count", () =>
    fixture(async (redis, id) => {
      const stream = `test:limit:${id}`;
      try {
        expect(await readHotClickCount(redis, id, 9)).toBe(9);
        expect(await readHotClickCount(redis, id, 9)).toBe(9);
        await incrementUntrackedClickCount(redis, id, 4);
        expect(await readHotClickCount(redis, id, 9)).toBe(10);
        expect(await readHotClickCount(redis, id, 15)).toBe(15);
        expect(await redis.ttl(hotClickCountKey(id))).toBe(-1);
        await redis.set(stream, "wrong type");
        await expect(
          redis.eval(
            countedClickScript,
            2,
            stream,
            hotClickCountKey(id),
            15,
            "d",
            "{}",
          ),
        ).rejects.toThrow();
        expect(await readHotClickCount(redis, id, 0)).toBe(15);
        await redis.del(stream);
        await redis.eval(
          countedClickScript,
          2,
          stream,
          hotClickCountKey(id),
          15,
          "d",
          "{}",
        );
        expect(await redis.xlen(stream)).toBe(1);
        expect(await readHotClickCount(redis, id, 0)).toBe(16);
        await redis.hset(hotClickCountKey(id), "hits", "corrupt");
        await expect(readHotClickCount(redis, id, 0)).rejects.toThrow();
        await expect(readHotClickCount(redis, id, -1)).rejects.toThrow();
      } finally {
        await redis.del(stream);
      }
    }));
  test("tracked and QR visits share the counter; bots and limit fallbacks produce no human increment", () =>
    fixture(async (redis, id) => {
      const spoolPath = join(tmpdir(), `shortn-limit-${id}.ndjson`);
      const stream = `test:limit:${id}`;
      const queue = createClickQueue(
        {
          xadd: (_key, entry, ...fields) =>
            redis.xadd(stream, entry, ...fields),
          eval: (script, count, _key, ...args) =>
            redis.eval(script, count, stream, ...args),
        },
        spoolPath,
      );
      let link: CachedLink = {
        kind: "link",
        id,
        key: "limited",
        dest: "https://example.com",
        status: "ok",
        pwd: false,
        hits: 5,
        rules: { maxClicks: 6 },
      };
      const app = createApp({
        resolver: { resolve: async () => link },
        enqueue: queue.enqueue,
        health: async () => true,
        secrets: { legacy: encodeSecret("test") },
        origin: "https://shortn.at",
        linkDomain: "shortn.at",
        clickCounter: {
          read: (id, base) => readHotClickCount(redis, id, base),
          untracked: (id, base) =>
            incrementUntrackedClickCount(redis, id, base),
        },
        log: () => {},
      });
      try {
        expect(
          (
            await app.request("/limited", {
              headers: { "user-agent": "Googlebot" },
            })
          ).status,
        ).toBe(302);
        await until(async () => (await redis.xlen(stream)) === 1);
        expect(await readHotClickCount(redis, id, 0)).toBe(5);
        link = {
          ...link,
          qr: { id: new ObjectId().toHexString(), publicId: "qr" },
          og: { title: "Limited preview" },
        };
        expect(
          (
            await app.request("/limited", {
              headers: { "user-agent": "WhatsApp/2.24" },
            })
          ).status,
        ).toBe(200);
        await until(async () => (await redis.xlen(stream)) === 2);
        expect(await readHotClickCount(redis, id, 0)).toBe(5);
        expect((await app.request("/limited")).status).toBe(302);
        await until(
          async () => (await redis.hget(hotClickCountKey(id), "hits")) === "6",
        );
        for (const locale of ["en", "es", "pt"]) {
          const response = await app.request("/limited", {
            headers: { cookie: `NEXT_LOCALE=${locale}` },
          });
          expect(response.status).toBe(410);
          expect(await response.text()).toContain(`<html lang="${locale}">`);
        }
        const cappedBot = await app.request("/limited", {
          headers: { "user-agent": "WhatsApp/2.24" },
        });
        expect(cappedBot.status).toBe(410);
        expect(await cappedBot.text()).not.toContain("Limited preview");
        link = {
          ...link,
          rules: { maxClicks: 6, expiredUrl: "https://example.com/closed" },
        };
        const response = await app.request("/limited");
        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toBe(
          "https://example.com/closed",
        );
        expect(await redis.xlen(stream)).toBe(3);
        expect(await readHotClickCount(redis, id, 0)).toBe(6);
      } finally {
        await queue.drain();
        await redis.del(stream);
        await rm(spoolPath, { force: true });
      }
    }));
  test("missing-QR legacy hops count without analytics, and counted spool entries replay once", () =>
    fixture(async (redis, id) => {
      const messages: ClickMessage[] = [];
      const app = createApp({
        resolver: {
          resolve: async () => ({
            kind: "link",
            id,
            key: "q",
            dest: "https://example.com",
            status: "ok",
            pwd: false,
            untracked: true,
            rules: { maxClicks: 1 },
          }),
        },
        enqueue: (message) => messages.push(message),
        health: async () => true,
        secrets: { legacy: encodeSecret("test") },
        origin: "https://shortn.at",
        linkDomain: "shortn.at",
        clickCounter: {
          read: (id, base) => readHotClickCount(redis, id, base),
          untracked: (id, base) =>
            incrementUntrackedClickCount(redis, id, base),
        },
      });
      expect((await app.request("/q")).status).toBe(302);
      expect((await app.request("/q")).status).toBe(410);
      expect(messages).toHaveLength(0);
      const stream = `test:limit:${id}`,
        path = join(tmpdir(), `shortn-limit-${id}.ndjson`);
      let offline = true;
      const queue = createClickQueue(
        {
          xadd: () => {
            throw new Error("unexpected uncounted append");
          },
          eval: async (script, count, _key, ...args) => {
            if (offline) throw new Error("offline");
            return redis.eval(script, count, stream, ...args);
          },
        },
        path,
        () => {},
      );
      try {
        queue.enqueue({
          v: 1,
          ts: Date.now(),
          linkId: id,
          domain: "shortn.at",
          key: "q",
          bot: false,
          counterBase: 1,
        });
        await until(
          async () => queue.spooled === 1 && (await Bun.file(path).exists()),
        );
        expect(await readHotClickCount(redis, id, 0)).toBe(1);
        offline = false;
        await queue.drain();
        await queue.drain();
        expect(await redis.xlen(stream)).toBe(1);
        expect(await readHotClickCount(redis, id, 0)).toBe(2);
      } finally {
        await redis.del(stream);
        await rm(path, { force: true });
      }
    }));
});
