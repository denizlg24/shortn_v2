import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { physicalNames } from "@shortn/db";
import bcrypt from "bcryptjs";
import { Redis } from "ioredis";
import { jwtVerify } from "jose";
import { MongoClient, type Db } from "mongodb";
import { publicLink, reportLink, verifyLinkPassword } from "./public";

const mongoUrl = process.env.MONGO_TEST_URL;
const redisUrl = process.env.REDIS_TEST_URL;
const secret = "link-access-test-secret-0123456789abcdef";

(mongoUrl && redisUrl ? describe : describe.skip)("public link pages", () => {
  let client: MongoClient;
  let redis: Redis;
  let db: Db;
  beforeAll(async () => {
    client = await new MongoClient(mongoUrl ?? "").connect();
    redis = new Redis(redisUrl ?? "");
    db = client.db(
      `shortn_core_public_${crypto.randomUUID().replaceAll("-", "")}`,
    );
  });
  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
    redis?.disconnect();
  });

  test("password: wrong, right (token the redirect accepts), then rate limited", async () => {
    const key = `p${crypto.randomUUID().slice(0, 6)}`;
    await db.collection(physicalNames.links).insertOne({
      urlCode: key,
      longUrl: "https://a.com",
      passwordProtected: true,
      passwordHash: await bcrypt.hash("open sesame", 10),
      passwordHint: "cave",
    });
    expect((await publicLink(db, key))?.passwordHint).toBe("cave");
    const deps = { db, counters: redis, linkAccessSecret: secret };
    const ipHash = crypto.randomUUID();
    expect(
      await verifyLinkPassword(deps, { key, password: "nope", ipHash }),
    ).toEqual({ ok: false, error: "wrong_password" });
    const right = await verifyLinkPassword(deps, {
      key,
      password: "open sesame",
      ipHash,
    });
    if (!right.ok) throw new Error(right.error);
    const { payload } = await jwtVerify(
      right.token,
      new TextEncoder().encode(secret),
    );
    expect(payload.urlCode).toBe(key);
    for (let i = 0; i < 5; i++)
      await verifyLinkPassword(deps, { key, password: "x", ipHash });
    expect(
      await verifyLinkPassword(deps, { key, password: "open sesame", ipHash }),
    ).toEqual({ ok: false, error: "rate_limited" });
  });

  test("three distinct reporters disable the link; a repeat reporter counts once", async () => {
    const key = `r${crypto.randomUUID().slice(0, 6)}`;
    await db
      .collection(physicalNames.links)
      .insertOne({
        urlCode: key,
        longUrl: "https://b.com",
        reportCount: 0,
        disabled: false,
      });
    const deps = { db, counters: redis, cache: redis, linkDomain: "shortn.at" };
    await reportLink(deps, { key, reason: "spam", ipHash: "a" });
    await reportLink(deps, { key, reason: "spam", ipHash: "a" });
    await reportLink(deps, { key, reason: "phishing", ipHash: "b" });
    expect(
      (await db.collection(physicalNames.links).findOne({ urlCode: key }))
        ?.disabled,
    ).toBe(false);
    await reportLink(deps, { key, reason: "malware", ipHash: "c" });
    const doc = await db
      .collection(physicalNames.links)
      .findOne({ urlCode: key });
    expect(doc).toMatchObject({
      reportCount: 3,
      disabled: true,
      safetyStatus: "blocked",
    });
    expect((await publicLink(db, key))?.blocked).toBe(true);
  });
});
