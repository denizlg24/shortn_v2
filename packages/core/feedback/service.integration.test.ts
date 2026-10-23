import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { Redis } from "ioredis";
import { desiredIndexes, physicalNames } from "@shortn/db";
import { ensurePersonalWorkspace } from "../workspaces/service";
import type { ServiceContext } from "../workspaces/context";
import type { Actor } from "../workspaces/authz";
import {
  feedbackHourlyLimit,
  listOwnFeedback,
  submitFeedback,
} from "./service";

const mongo = process.env.MONGO_TEST_URL,
  cache = process.env.REDIS_TEST_URL;
(mongo && cache ? describe : describe.skip)("product feedback", () => {
  let client: MongoClient, db: Db, redis: Redis;
  beforeAll(async () => {
    if (
      ![mongo, cache].every((url) =>
        ["localhost", "127.0.0.1"].includes(new URL(url!).hostname),
      )
    )
      throw new Error("Loopback services required");
    client = await new MongoClient(mongo!).connect();
    db = client.db(
      `shortn_feedback_${crypto.randomUUID().replaceAll("-", "")}`,
    );
    redis = new Redis(cache!);
    await db
      .collection(physicalNames.feedback)
      .createIndexes(desiredIndexes[physicalNames.feedback]!);
  });
  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
    redis?.disconnect();
  });

  const contextFor = async (
    actor: Partial<Actor> = {},
  ): Promise<ServiceContext> => {
    const userId = new ObjectId().toHexString();
    const workspace = await ensurePersonalWorkspace(db, {
      id: userId,
      name: "Feedback author",
      sub: `feedback|${userId}`,
    });
    return {
      db,
      cache: redis,
      workspace,
      actor: { userId, role: "owner", ...actor },
      linkDomain: "shortn.at",
    };
  };

  test("stores trimmed feedback for the author and lists it newest first", async () => {
    const ctx = await contextFor();
    const first = await submitFeedback(ctx, {
      category: "bug",
      message: "  The sort menu is missing  ",
      page: "/acme/bio",
    });
    expect(first.ok).toBe(true);
    await submitFeedback(
      { ...ctx, now: () => new Date(Date.now() + 1000) },
      { category: "idea", message: "Group links by tag" },
    );
    const own = await listOwnFeedback(ctx);
    expect(
      own.map((item) => [item.category, item.message, item.status]),
    ).toEqual([
      ["idea", "Group links by tag", "new"],
      ["bug", "The sort menu is missing", "new"],
    ]);
    const other = await contextFor();
    expect(await listOwnFeedback(other)).toEqual([]);
  });

  test("rejects empty messages, impersonation and floods", async () => {
    const ctx = await contextFor();
    expect(
      await submitFeedback(ctx, { category: "other", message: "   " }),
    ).toEqual({ ok: false, error: "invalid_input" });
    expect(
      await submitFeedback(await contextFor({ impersonation: "write" }), {
        category: "idea",
        message: "Staff should not speak for users",
      }),
    ).toEqual({ ok: false, error: "forbidden" });
    for (let i = 0; i < feedbackHourlyLimit; i++)
      expect(
        (await submitFeedback(ctx, { category: "idea", message: `#${i}` })).ok,
      ).toBe(true);
    expect(
      await submitFeedback(ctx, { category: "idea", message: "one more" }),
    ).toEqual({ ok: false, error: "rate_limited" });
  });
});
