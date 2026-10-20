import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { APIError } from "better-auth/api";
import { physicalNames } from "../../packages/db";
import { refuseSuspendedAccount } from "../lib/account-status";

const mongo = process.env.MONGO_TEST_URL;
(mongo ? describe : describe.skip)("legacy session ban gate", () => {
  let client: MongoClient, db: Db;
  const user = async (fields: Record<string, unknown>) => {
    const _id = new ObjectId();
    await db
      .collection(physicalNames.user)
      .insertOne({ _id, email: `${_id.toHexString()}@example.com`, ...fields });
    return _id.toHexString();
  };
  const refusal = async (userId: string) => {
    try {
      await refuseSuspendedAccount(db, userId);
      return null;
    } catch (error) {
      return error instanceof APIError ? error.body?.code : "unexpected";
    }
  };
  beforeAll(async () => {
    if (!["127.0.0.1", "localhost"].includes(new URL(mongo!).hostname))
      throw new Error("Loopback Mongo required");
    client = await new MongoClient(mongo!).connect();
    db = client.db(
      `shortn_legacy_ban_${crypto.randomUUID().replaceAll("-", "")}`,
    );
  });
  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
  });

  test("a banned or deletion-pending user can't open a legacy session", async () => {
    expect(await refusal(await user({ banned: true }))).toBe(
      "ACCOUNT_SUSPENDED",
    );
    expect(
      await refusal(
        await user({
          banned: true,
          banExpires: new Date(Date.now() + 60_000),
        }),
      ),
    ).toBe("ACCOUNT_SUSPENDED");
    expect(
      await refusal(
        await user({
          deletion: {
            requestedAt: new Date(),
            by: "staff",
            purgeAfter: new Date(),
            state: "scheduled",
          },
        }),
      ),
    ).toBe("ACCOUNT_SUSPENDED");
  });

  test("expired, malformed and absent bans don't block", async () => {
    expect(
      await refusal(
        await user({ banned: true, banExpires: new Date(Date.now() - 1000) }),
      ),
    ).toBeNull();
    expect(await refusal(await user({ banned: "true" }))).toBeNull();
    expect(await refusal(await user({}))).toBeNull();
    expect(await refusal(new ObjectId().toHexString())).toBeNull();
  });
});
