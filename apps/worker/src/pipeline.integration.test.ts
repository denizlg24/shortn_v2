import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { encodeSecret } from "@shortn/core";
import { physicalNames as names, syncIndexes } from "@shortn/db";
import { invalidateLinks, keys } from "@shortn/redis";
import { Redis } from "ioredis";
import { MongoClient, ObjectId } from "mongodb";
import type { Db } from "mongodb";
import { createApp } from "../../redirect/src/app";
import { createClickQueue } from "../../redirect/src/clicks";
import { createResolver, mongoLinkLoader } from "../../redirect/src/resolver";
import { createIngest, ingestGroup } from "./ingest";
import { createInvalidator } from "./invalidator";
import { fillEventWorkspaces, refreshRecentRollups, trimStream } from "./jobs";

const mongoUrl = process.env.MONGO_TEST_URL;
const cacheUrl = process.env.REDIS_TEST_URL;
const durableUrl = process.env.REDIS_DURABLE_TEST_URL;
const ready = Boolean(mongoUrl && cacheUrl && durableUrl);
if (!ready)
  console.log(
    "SKIP click pipeline integration: set MONGO_TEST_URL, REDIS_TEST_URL and REDIS_DURABLE_TEST_URL",
  );
if (!ready && process.env.REQUIRE_INTEGRATION === "1")
  throw new Error("Pipeline integration requires all test URLs");

const browser =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";

(ready ? describe : describe.skip)("redirect → stream → worker", () => {
  let client: MongoClient;
  let db: Db;
  let cache: Redis;
  let durable: Redis;
  const stream = keys.clicksStream;

  beforeAll(async () => {
    for (const url of [mongoUrl, cacheUrl, durableUrl])
      if (!["localhost", "127.0.0.1"].includes(new URL(url ?? "").hostname))
        throw new Error(
          "Integration tests only connect to local fixture services",
        );
    client = await new MongoClient(mongoUrl ?? "").connect();
    db = client.db(
      `shortn_foundation_test_${crypto.randomUUID().replaceAll("-", "")}`,
    );
    cache = new Redis(cacheUrl ?? "");
    durable = new Redis(durableUrl ?? "");
    await durable.del(stream, "cs:link-invalidate:token");
    for (const name of [
      names.links,
      names.qr_codes,
      names.clicks,
      names.bio_pages,
      names.campaigns,
      names.tags,
      names.link_reports,
      names.scheduled_changes,
      names.contacts,
      names.rate_limits,
      names.user,
      names.session,
      names.account,
      names.verification,
      names.admin_audit_log,
      names.meta,
      names.login_records,
    ])
      await db.createCollection(name);
    await syncIndexes(db, { log: () => {} });
  }, 20_000);

  afterAll(async () => {
    await durable?.del(stream, "cs:link-invalidate:token");
    await db?.dropDatabase();
    await client?.close();
    cache?.disconnect();
    durable?.disconnect();
  });

  test("clicks and scans reach click_events, the legacy dual-write and rollups exactly once", async () => {
    const workspaceId = new ObjectId();
    const { insertedId: linkId } = await db.collection(names.links).insertOne({
      urlCode: `pipe${Date.now()}`,
      longUrl: "https://example.com/dest",
      sub: "google|pipe",
      workspaceId,
      clicks: { total: 10, lastClick: null },
    });
    const link = await db.collection(names.links).findOne({ _id: linkId });
    const code = String(link?.urlCode);
    const qrCode = `${code}q`;
    const { insertedId: qrLinkId } = await db
      .collection(names.links)
      .insertOne({
        urlCode: qrCode,
        longUrl: "https://example.com/qr",
        sub: "google|pipe",
        isQrCode: true,
        qrCodeId: "QPIPE",
        clicks: { total: 0 },
      });
    const { insertedId: qrId } = await db.collection(names.qr_codes).insertOne({
      qrCodeId: "QPIPE",
      urlId: qrCode,
      sub: "google|pipe",
      clicks: { total: 3 },
    });

    const resolver = createResolver(cache, mongoLinkLoader(db));
    const queue = createClickQueue(
      durable,
      `/tmp/pipeline-${crypto.randomUUID()}.ndjson`,
    );
    const app = createApp({
      resolver,
      enqueue: queue.enqueue,
      health: async () => true,
      secrets: { legacy: encodeSecret("legacy") },
      origin: "https://shortn.at",
      linkDomain: "shortn.at",
      log: () => {},
    });
    const headers = {
      "user-agent": browser,
      "cf-connecting-ip": "203.0.113.7",
      "cf-ipcountry": "PT",
      referer: "https://www.google.com/",
    };
    for (const path of [
      `/${code}?utm_source=mail`,
      `/${code}`,
      `/qr/${qrCode}`,
    ]) {
      const response = await app.request(path, { headers });
      expect(response.status).toBe(302);
    }
    await app.request(`/${code}`, {
      headers: { "user-agent": "Googlebot/2.1" },
    });
    await Bun.sleep(50);
    expect(await durable.xlen(stream)).toBe(4);

    const ingest = createIngest({
      stream: durable,
      db,
      ipSecret: "ip-hash-fixture-secret-0123456789abcdef",
      consumer: "test",
      blockMs: 100,
      log: () => {},
    });
    const run = ingest.run();
    for (
      let attempt = 0;
      attempt < 50 && ingest.stats.processed + ingest.stats.bots < 4;
      attempt++
    )
      await Bun.sleep(50);
    ingest.stop();
    await run;
    expect(ingest.stats).toMatchObject({ processed: 3, bots: 1, rejected: 0 });

    const events = await db.collection(names.click_events).find({}).toArray();
    expect(events).toHaveLength(3);
    expect(events.filter((event) => event.m.kind === "scan")).toHaveLength(1);
    expect(events.find((event) => event.m.kind === "scan")?.m).toMatchObject({
      linkId: qrLinkId,
      qrId,
      legacyCode: qrCode,
    });
    expect(events[0]).toMatchObject({
      country: "PT",
      refDomain: "google.com",
      device: "desktop",
    });
    expect(events.some((event) => event.utm?.source === "mail")).toBe(true);
    const legacy = await db
      .collection(names.clicks)
      .find({ src: "v2" })
      .toArray();
    expect(legacy.map((click) => [click.type, click.urlCode]).sort()).toEqual([
      ["click", code],
      ["click", code],
      ["scan", "QPIPE"],
    ]);
    expect(
      (await db.collection(names.links).findOne({ _id: linkId }))?.clicks.total,
    ).toBe(12);
    expect(
      (await db.collection(names.qr_codes).findOne({ _id: qrId }))?.clicks
        .total,
    ).toBe(4);
    expect(await db.collection(names.click_ips).countDocuments()).toBe(3);

    // A redelivered batch must not duplicate anything.
    const replay = await durable.xrange(stream, "-", "+");
    await ingest.handle(
      replay.map(([id, fields]) => [id, fields]),
      true,
    );
    expect(await db.collection(names.click_events).countDocuments()).toBe(3);
    expect(
      await db.collection(names.clicks).countDocuments({ src: "v2" }),
    ).toBe(3);

    await fillEventWorkspaces(db);
    await refreshRecentRollups(db);
    const rollup = await db.collection(names.click_rollups).findOne({ linkId });
    expect(rollup).toMatchObject({
      clicks: 2,
      scans: 0,
      workspaceId,
      byCountry: { PT: 2 },
    });
    expect(rollup?.byHour.reduce((sum: number, n: number) => sum + n, 0)).toBe(
      2,
    );
    expect(
      (await db.collection(names.links).findOne({ _id: linkId }))?.stats,
    ).toMatchObject({
      clicks: 2,
      scans: 0,
    });
    expect(
      (await db.collection(names.links).findOne({ _id: qrLinkId }))?.stats,
    ).toMatchObject({
      scans: 1,
    });

    const trimmed = await trimStream(durable);
    expect(trimmed).toBeDefined();
    expect(await durable.xlen(stream)).toBeLessThanOrEqual(1);
    const pending = await durable.xpending(stream, ingestGroup);
    expect(Array.isArray(pending) ? pending[0] : -1).toBe(0);
  }, 30_000);

  test("legacy writes invalidate cached resolutions through the change stream", async () => {
    const code = `inv${Date.now()}`;
    const resolver = createResolver(cache, mongoLinkLoader(db));
    expect((await resolver.resolve("shortn.at", code)).kind).toBe("missing");
    const invalidator = createInvalidator({
      db,
      cache,
      tokens: durable,
      domain: "shortn.at",
      log: () => {},
    });
    const running = invalidator.run();
    await Bun.sleep(500);
    await db
      .collection(names.links)
      .insertOne({ urlCode: code, longUrl: "https://example.com/new" });
    let cached = await cache.get(keys.link("shortn.at", code));
    for (let attempt = 0; attempt < 40 && cached; attempt++) {
      await Bun.sleep(50);
      cached = await cache.get(keys.link("shortn.at", code));
    }
    expect(cached).toBeNull();
    resolver.memory.clear();
    expect(await resolver.resolve("shortn.at", code)).toMatchObject({
      kind: "link",
      dest: "https://example.com/new",
    });
    await db
      .collection(names.links)
      .updateOne({ urlCode: code }, { $set: { disabled: true } });
    for (
      let attempt = 0;
      attempt < 40 && (await cache.get(keys.link("shortn.at", code)));
      attempt++
    )
      await Bun.sleep(50);
    resolver.memory.clear();
    expect(await resolver.resolve("shortn.at", code)).toMatchObject({
      status: "blocked",
    });
    await invalidator.stop();
    await running;
    expect(await durable.get("cs:link-invalidate:token")).toBeTruthy();
    await invalidateLinks(cache, "shortn.at", [code]);
  }, 30_000);
});
