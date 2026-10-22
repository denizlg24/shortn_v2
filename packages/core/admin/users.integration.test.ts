import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  accountStatusKey,
  collection,
  endSuspendedSession,
  physicalNames,
} from "@shortn/db";
import { Redis } from "ioredis";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { banUser, revokeUserSessions, unbanUser } from "./users";

const mongoUrl = process.env.MONGO_TEST_URL;
const redisUrl = process.env.REDIS_TEST_URL;

(mongoUrl && redisUrl ? describe : describe.skip)("staff bans", () => {
  let client: MongoClient, db: Db, redis: Redis;
  const deps = () => ({ db, cache: redis });
  beforeAll(async () => {
    client = await new MongoClient(mongoUrl!).connect();
    db = client.db(`shortn_bans_${crypto.randomUUID().replaceAll("-", "")}`);
    redis = new Redis(redisUrl!);
  });
  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
    redis?.disconnect();
  });

  const seed = async () => {
    const userId = new ObjectId();
    const id = userId.toHexString();
    await db
      .collection(physicalNames.user)
      .insertOne({ _id: userId, email: `${id}@example.com` });
    const expiresAt = new Date(Date.now() + 3_600_000);
    // better-auth versions and legacy wrote userId both ways (F18).
    const asObjectId = new ObjectId(),
      asString = new ObjectId();
    await db.collection(physicalNames.session).insertMany([
      { _id: asObjectId, userId, token: "a", expiresAt },
      { _id: asString, userId: id, token: "b", expiresAt },
    ]);
    await db.collection(physicalNames.handoff_tokens).insertOne({ userId: id });
    await db
      .collection(physicalNames.oauth_access_tokens)
      .insertOne({ userId: id, expiresAt });
    await db
      .collection(physicalNames.oauth_refresh_tokens)
      .insertOne({ userId, expiresAt });
    await db
      .collection(physicalNames.verification)
      .insertOne({ identifier: "trust-device-x", value: id, expiresAt });
    await collection(db, "admin_sessions").insertOne({
      _id: crypto.randomUUID(),
      userId: id,
      createdAt: new Date(),
      lastSeenAt: new Date(),
      expiresAt,
      idleUntil: expiresAt,
      uaHash: "ua",
    });
    return { userId, id, asObjectId, asString };
  };

  test("a ban ends sessions and credentials stored under either id type", async () => {
    const { userId, id } = await seed();
    await redis.set(accountStatusKey(id), "active", "EX", 60);
    const result = await banUser(deps(), id, {
      by: "staff",
      reason: "Phishing",
      expires: new Date(Date.now() + 86_400_000),
    });
    expect(result).toMatchObject({
      ok: true,
      value: {
        revoked: {
          sessions: 2,
          handoffs: 1,
          oauthTokens: 2,
          trustedDevices: 1,
          adminSessions: 1,
        },
      },
    });
    expect(await redis.get(accountStatusKey(id))).toBeNull();
    expect(
      await db.collection(physicalNames.user).findOne({ _id: userId }),
    ).toMatchObject({ banned: true, banReason: "Phishing", bannedBy: "staff" });
  });

  test("a session that survived a ban written elsewhere ends on its next read", async () => {
    const { userId, id, asString } = await seed();
    // A ban written straight to Mongo, bypassing banUser's revocation.
    await db
      .collection(physicalNames.user)
      .updateOne({ _id: userId }, { $set: { banned: true } });
    await redis.del(accountStatusKey(id));
    expect(
      await endSuspendedSession(db, redis, {
        session: { id: asString.toHexString() },
        user: { id },
      }),
    ).toBe(true);
    expect(
      await db.collection(physicalNames.session).findOne({ _id: asString }),
    ).toBeNull();
  });

  test("unban clears the flags and the cached status; revoke-sessions leaves the account alone", async () => {
    const { userId, id } = await seed();
    await banUser(deps(), id, { by: "staff" });
    expect((await unbanUser(deps(), id)).ok).toBe(true);
    const user = await db
      .collection(physicalNames.user)
      .findOne({ _id: userId });
    expect(user?.banned).toBeUndefined();
    expect(await redis.get(accountStatusKey(id))).toBeNull();
    const again = await seed();
    expect((await revokeUserSessions(deps(), again.id)).ok).toBe(true);
    expect(
      await db
        .collection(physicalNames.session)
        .countDocuments({ userId: { $in: [again.id, again.userId] } }),
    ).toBe(0);
    expect(
      (await db.collection(physicalNames.user).findOne({ _id: again.userId }))
        ?.banned,
    ).toBeUndefined();
  });
});
