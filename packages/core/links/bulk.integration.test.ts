import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { Redis } from "ioredis";
import { desiredIndexes, physicalNames, deriveLink } from "@shortn/db";
import { loadEntitlements } from "@shortn/billing";
import { createLink, createMany } from "./service";
import { ensurePersonalWorkspace } from "../workspaces/service";
import type { ServiceContext } from "../workspaces/context";

const mongo = process.env.MONGO_TEST_URL,
  cache = process.env.REDIS_TEST_URL;
(mongo && cache ? describe : describe.skip)("atomic bulk link creation", () => {
  let client: MongoClient, db: Db, redis: Redis;
  beforeAll(async () => {
    if (
      ![mongo, cache].every((url) =>
        ["localhost", "127.0.0.1"].includes(new URL(url!).hostname),
      )
    )
      throw new Error("Loopback services required");
    client = await new MongoClient(mongo!).connect();
    db = client.db(`shortn_bulk_${crypto.randomUUID().replaceAll("-", "")}`);
    redis = new Redis(cache!);
    for (const name of [
      physicalNames.links,
      physicalNames.tags,
      physicalNames.webhook_events,
    ])
      await db.collection(name).createIndexes(desiredIndexes[name]!);
  });
  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
    redis?.disconnect();
  });
  async function context(pro = false): Promise<ServiceContext> {
    const userId = new ObjectId().toHexString();
    const workspace = await ensurePersonalWorkspace(db, {
      id: userId,
      name: "Bulk",
      sub: `bulk|${userId}`,
    });
    if (pro)
      await db.collection(physicalNames.subscriptions).insertOne({
        workspaceId: workspace._id,
        polarSubscriptionId: crypto.randomUUID(),
        status: "active",
        plan: "pro",
        currentPeriodStart: new Date(Date.now() - 86400000),
        currentPeriodEnd: new Date(Date.now() + 29 * 86400000),
        cancelAtPeriodEnd: false,
      });
    return {
      db,
      workspace,
      actor: { userId, role: "owner" },
      cache: redis,
      linkDomain: "shortn.at",
    };
  }
  async function counts(ctx: ServiceContext) {
    const result: Record<string, number> = {};
    for (const name of [
      physicalNames.links,
      physicalNames.tags,
      physicalNames.webhook_events,
    ])
      result[name] = await db
        .collection(name)
        .countDocuments({ workspaceId: ctx.workspace._id });
    return result;
  }
  test("batch validation preserves the earliest row error across database and local failures", async () => {
    const ctx = await context(true),
      key = `taken-${crypto.randomUUID().slice(0, 8)}`;
    expect(
      (await createLink(ctx, { url: "https://example.com", key })).ok,
    ).toBe(true);
    expect(
      await createMany(ctx, [
        { url: "https://example.com/first", key },
        { url: "javascript:alert(1)" },
      ]),
    ).toMatchObject({ error: "key_taken", detail: { key, index: 0 } });
    expect(
      await createMany(ctx, [
        { url: "https://example.com/first", key },
        { url: "https://example.com/second", key },
      ]),
    ).toMatchObject({ error: "key_taken", detail: { key, index: 0 } });
  });
  test("1000 links preserve ordering, legacy derivations, tag references, events and cache invalidation", async () => {
    const ctx = await context(true),
      prefix = crypto.randomUUID().slice(0, 8);
    await db.collection(physicalNames.webhook_endpoints).insertOne({
      workspaceId: ctx.workspace._id,
      enabled: true,
      events: ["link.created"],
    });
    await redis.set(`link:shortn.at:${prefix}-0`, "negative");
    const result = await createMany(
      ctx,
      Array.from({ length: 1000 }, (_, i) => ({
        url: `https://example.com/${i}`,
        key: `${prefix}-${i}`,
        tags: i % 2 ? ["News", "news"] : ["Print", "News"],
      })),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.value).toHaveLength(1000);
    expect(result.value.map((link) => link.url)).toEqual(
      Array.from({ length: 1000 }, (_, i) => `https://example.com/${i}`),
    );
    expect(await counts(ctx)).toEqual({
      [physicalNames.links]: 1000,
      [physicalNames.tags]: 2,
      [physicalNames.webhook_events]: 1000,
    });
    const docs = await db
      .collection(physicalNames.links)
      .find({ workspaceId: ctx.workspace._id })
      .toArray();
    for (const doc of docs) {
      expect(doc._sync.legacyHash).toBe(deriveLink(doc).legacyHash);
      expect(doc.sub).toBe(ctx.workspace.legacySub);
      expect(doc.safetyStatus).toBe("pending");
      expect(doc.tagIds).toHaveLength(doc.tags.length);
    }
    expect(await redis.get(`link:shortn.at:${prefix}-0`)).toBeNull();
    const events = await db
      .collection(physicalNames.webhook_events)
      .find({ workspaceId: ctx.workspace._id })
      .toArray();
    expect(new Set(events.map((event) => event.event.data.id)).size).toBe(1000);
    expect(JSON.stringify(events)).not.toContain("passwordHash");
  }, 60000);
  test("invalid and duplicate rows have no side effects; foreign tags cannot be reused through legacy sub", async () => {
    const ctx = await context(true),
      prefix = crypto.randomUUID().slice(0, 8),
      baseline = await counts(ctx);
    expect(await createMany(ctx, [])).toMatchObject({ error: "invalid_input" });
    expect(
      await createMany(
        ctx,
        Array.from({ length: 1001 }, () => ({ url: "https://example.com" })),
      ),
    ).toMatchObject({ error: "invalid_input" });
    expect(
      await createMany(ctx, [
        { url: "https://example.com", tags: ["No orphan"] },
        { url: "javascript:alert(1)" },
      ]),
    ).toMatchObject({ error: "invalid_url", detail: { index: 1 } });
    expect(
      await createMany(ctx, [
        { url: "https://example.com", key: prefix, tags: ["No orphan"] },
        { url: "https://example.com/2", key: prefix },
      ]),
    ).toMatchObject({ error: "key_taken", detail: { index: 1 } });
    expect(
      await createMany(ctx, [{ url: "https://example.com", key: "docs" }]),
    ).toMatchObject({ error: "key_reserved" });
    expect(
      await createMany({ ...ctx, actor: { ...ctx.actor, role: "viewer" } }, [
        { url: "https://example.com" },
      ]),
    ).toMatchObject({ error: "forbidden" });
    expect(await counts(ctx)).toEqual(baseline);
    const foreign = new ObjectId();
    await db.collection(physicalNames.tags).insertOne({
      workspaceId: new ObjectId(),
      sub: ctx.workspace.legacySub,
      _id: foreign,
      tagName: "Foreign",
      nameLower: "foreign",
    });
    const result = await createMany(ctx, [
      { url: "https://example.com", tags: ["Foreign"] },
    ]);
    if (!result.ok) throw new Error(result.error);
    const ownTag = await db
      .collection(physicalNames.tags)
      .findOne({ workspaceId: ctx.workspace._id, nameLower: "foreign" });
    expect(ownTag).not.toBeNull();
    expect(result.value[0]!.tags[0]!.id).not.toBe(String(foreign));
    await db.collection(physicalNames.tags).insertMany([
      {
        workspaceId: ctx.workspace._id,
        sub: ctx.workspace.legacySub,
        tagName: "Assigned legacy",
        id: "bulk-assigned",
      },
      {
        sub: ctx.workspace.legacySub,
        tagName: "Unassigned legacy",
        id: "bulk-unassigned",
      },
    ]);
    const legacy = await createMany(ctx, [
      {
        url: "https://example.com/legacy",
        tags: ["Assigned legacy", "Unassigned legacy"],
      },
    ]);
    if (!legacy.ok) throw new Error(legacy.error);
    expect(legacy.value[0]!.tags.map((tag) => tag.id)).toEqual([
      "bulk-assigned",
      "bulk-unassigned",
    ]);
    expect((await counts(ctx))[physicalNames.tags]).toBe(2);
  });
  test("full batch quota is checked before writes and concurrent batches/single creates cannot overspend", async () => {
    const ctx = await context();
    const limit = (await loadEntitlements(db, ctx.workspace)).limits.links!;
    expect((await createLink(ctx, { url: "https://example.com/one" })).ok).toBe(
      true,
    );
    expect(
      await createMany(
        ctx,
        Array.from({ length: limit }, () => ({
          url: "https://example.com",
          tags: ["No orphan"],
        })),
      ),
    ).toMatchObject({
      error: "limit_reached",
      detail: { used: 1, limit, requested: limit },
    });
    expect((await counts(ctx))[physicalNames.tags]).toBe(0);
    const raced = await Promise.all([
      createMany(
        ctx,
        Array.from({ length: limit - 1 }, () => ({
          url: "https://example.com/a",
        })),
      ),
      createLink(ctx, { url: "https://example.com/c" }),
    ]);
    expect(raced.filter((result) => result.ok)).toHaveLength(1);
    expect((await counts(ctx))[physicalNames.links]).toBeLessThanOrEqual(limit);
    const other = await context();
    const batches = await Promise.all(
      [1, 2].map(() =>
        createMany(
          other,
          Array.from({ length: Math.ceil(limit / 2) }, () => ({
            url: "https://example.com/1",
          })),
        ),
      ),
    );
    expect(batches.filter((result) => result.ok)).toHaveLength(1);
    expect((await counts(other))[physicalNames.links]).toBe(
      Math.ceil(limit / 2),
    );
  });
  test("concurrent batches with the same key commit one complete batch", async () => {
    const ctx = await context(true),
      prefix = crypto.randomUUID().slice(0, 8);
    const results = await Promise.all(
      [0, 1].map((i) =>
        createMany(ctx, [
          {
            url: "https://example.com/shared",
            key: `${prefix}-shared`,
            tags: [`Winner ${i}`],
          },
          { url: "https://example.com/other", key: `${prefix}-${i}` },
        ]),
      ),
    );
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.find((result) => !result.ok)).toMatchObject({
      error: "key_taken",
    });
    expect((await counts(ctx))[physicalNames.links]).toBe(2);
    expect((await counts(ctx))[physicalNames.tags]).toBe(1);
  });
  test("a failing outbox write rolls back links and newly created tags", async () => {
    const ctx = await context(true),
      baseline = await counts(ctx),
      key = `rollback-${crypto.randomUUID().slice(0, 8)}`;
    await redis.set(`link:shortn.at:${key}`, "negative");
    await db.collection(physicalNames.webhook_endpoints).insertOne({
      workspaceId: ctx.workspace._id,
      enabled: true,
      events: ["link.created"],
    });
    await db.command({
      collMod: physicalNames.webhook_events,
      validator: {
        $or: [
          { workspaceId: { $ne: ctx.workspace._id } },
          { "event.data.url": { $ne: "https://example.com/2" } },
        ],
      },
      validationLevel: "strict",
      validationAction: "error",
    });
    try {
      await expect(
        createMany(ctx, [
          { url: "https://example.com/1", key, tags: ["Rollback"] },
          { url: "https://example.com/2", tags: ["Rollback too"] },
        ]),
      ).rejects.toThrow();
      expect(await counts(ctx)).toEqual(baseline);
      expect(await redis.get(`link:shortn.at:${key}`)).toBe("negative");
    } finally {
      await redis.del(`link:shortn.at:${key}`);
      await db.command({
        collMod: physicalNames.webhook_events,
        validator: {},
      });
    }
  });
});
