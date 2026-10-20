import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import {
  accountStatusKey,
  cachedAccountSuspension,
  endSuspendedSession,
  invalidateAccountStatus,
  type AccountStatusCache,
} from "./account-status";
import { physicalNames } from "./collections";

const mongo = process.env.MONGO_TEST_URL;
if (!mongo && process.env.REQUIRE_INTEGRATION === "1")
  throw new Error("MONGO_TEST_URL required");

// In-memory stand-in with the same contract as the cache Redis.
function memoryCache() {
  const entries = new Map<string, { value: string; until: number }>();
  let reads = 0;
  const cache: AccountStatusCache = {
    async get(key) {
      reads++;
      const entry = entries.get(key);
      return entry && entry.until > Date.now() ? entry.value : null;
    },
    async set(key, value, _mode, seconds) {
      entries.set(key, { value, until: Date.now() + seconds * 1000 });
      return "OK";
    },
    async del(key) {
      return entries.delete(key) ? 1 : 0;
    },
  };
  return { cache, entries, reads: () => reads };
}

(mongo ? describe : describe.skip)("session-path account status", () => {
  let client: MongoClient, db: Db;
  beforeAll(async () => {
    if (!["127.0.0.1", "localhost"].includes(new URL(mongo!).hostname))
      throw new Error("Loopback Mongo required");
    client = await new MongoClient(mongo!).connect();
    db = client.db(
      `shortn_account_status_${crypto.randomUUID().replaceAll("-", "")}`,
    );
  });
  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
  });

  const fixture = async () => {
    const userId = new ObjectId();
    const sessionId = new ObjectId();
    await db
      .collection(physicalNames.user)
      .insertOne({ _id: userId, email: `${userId.toHexString()}@example.com` });
    await db.collection(physicalNames.session).insertOne({
      _id: sessionId,
      userId,
      token: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    return {
      userId,
      sessionId,
      live: {
        session: { id: sessionId.toHexString() },
        user: { id: userId.toHexString() },
      },
    };
  };

  test("a session opened before a ban ends on its next request", async () => {
    const { userId, sessionId, live } = await fixture();
    const { cache } = memoryCache();
    expect(await endSuspendedSession(db, cache, live)).toBe(false);
    await db
      .collection(physicalNames.user)
      .updateOne({ _id: userId }, { $set: { banned: true } });
    // Status is cached for a minute; the ban writer invalidates it.
    expect(await endSuspendedSession(db, cache, live)).toBe(false);
    await invalidateAccountStatus(cache, userId.toHexString());
    expect(await endSuspendedSession(db, cache, live)).toBe(true);
    expect(
      await db.collection(physicalNames.session).findOne({ _id: sessionId }),
    ).toBeNull();
  });

  test("status is cached, a timed ban isn't cached past its expiry, and a broken cache falls back to Mongo", async () => {
    const { userId } = await fixture();
    const id = userId.toHexString();
    const memory = memoryCache();
    const expires = new Date(Date.now() + 5_000);
    await db
      .collection(physicalNames.user)
      .updateOne(
        { _id: userId },
        { $set: { banned: true, banReason: "spam", banExpires: expires } },
      );
    expect(await cachedAccountSuspension(db, memory.cache, id)).toEqual({
      kind: "banned",
      reason: "spam",
    });
    const entry = memory.entries.get(accountStatusKey(id))!;
    expect(entry.until - Date.now()).toBeLessThanOrEqual(5_000);
    expect(await cachedAccountSuspension(db, memory.cache, id)).toEqual({
      kind: "banned",
      reason: "spam",
    });
    const broken: AccountStatusCache = {
      get: async () => {
        throw new Error("redis down");
      },
      set: async () => {
        throw new Error("redis down");
      },
      del: async () => 0,
    };
    expect(await cachedAccountSuspension(db, broken, id)).toEqual({
      kind: "banned",
      reason: "spam",
    });
    expect(await cachedAccountSuspension(db, undefined, id)).not.toBeNull();
  });
});
