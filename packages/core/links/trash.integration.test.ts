import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { collection, physicalNames } from "@shortn/db";
import { MongoClient, ObjectId, type Db } from "mongodb";
import Redis from "ioredis";
import { mongoLinkLoader } from "../../../apps/redirect/src/resolver";
import { publicBioFromDocument } from "../bio/publishing";
import { ensurePersonalWorkspace } from "../workspaces/service";
import type { ServiceContext } from "../workspaces/context";
import { publicLinkQuery } from "./public";
import { toCachedLink } from "./cached-link";
import {
  createLink,
  deleteLinks,
  getLink,
  getLinkByKey,
  listLinks,
  restoreLinks,
  purgeExpiredLinks,
  linkTrashRetentionMs,
} from "./service";

const mongoUrl = process.env.MONGO_TEST_URL,
  redisUrl = process.env.REDIS_TEST_URL;
(mongoUrl && redisUrl ? describe : describe.skip)("30-day link trash", () => {
  let client: MongoClient, db: Db, cache: Redis;
  beforeAll(async () => {
    if (
      !/^mongodb:\/\/(localhost|127\.0\.0\.1):/.test(mongoUrl!) ||
      !/^redis:\/\/(localhost|127\.0\.0\.1):/.test(redisUrl!)
    )
      throw new Error("Trash tests require loopback services");
    client = await new MongoClient(mongoUrl!).connect();
    db = client.db(
      `shortn_p6_trash_${crypto.randomUUID().replaceAll("-", "")}`,
    );
    cache = new Redis(redisUrl!);
  });
  afterAll(async () => {
    cache?.disconnect();
    await db?.dropDatabase();
    await client?.close();
  });
  async function fixture() {
    const userId = new ObjectId().toHexString(),
      now = new Date();
    const workspace = await ensurePersonalWorkspace(db, {
      id: userId,
      name: "Trash",
    });
    await collection(db, "subscriptions").insertOne({
      _id: new ObjectId(),
      workspaceId: workspace._id,
      polarSubscriptionId: crypto.randomUUID(),
      polarCustomerId: "local",
      productId: "local",
      status: "active",
      plan: "pro",
      currentPeriodStart: new Date(now.getTime() - 86_400_000),
      currentPeriodEnd: new Date(now.getTime() + 29 * 86_400_000),
      cancelAtPeriodEnd: false,
    });
    const ctx: ServiceContext = {
      db,
      cache,
      workspace,
      actor: { userId, role: "owner" },
      linkDomain: "shortn.at",
      now: () => now,
    };
    const key = `trash-${crypto.randomUUID().slice(0, 8)}`;
    const result = await createLink(ctx, {
      url: "https://example.com/restore",
      key,
      password: "retained-password",
    });
    if (!result.ok) throw new Error(result.error);
    const id = new ObjectId(result.value.id);
    return { ctx, now, key, id, link: result.value };
  }
  test("trash hides canonical and alias redirects and public bio links while preserving state and references", async () => {
    const { ctx, now, key, id, link } = await fixture();
    const alias = `${key}-old`,
      customDomain = `${key}.example`;
    await collection(db, "links").updateOne(
      { _id: id },
      {
        $set: {
          domain: customDomain,
          previousKeys: [alias],
          safetyStatus: "suspicious",
          requiresInterstitial: true,
        },
      },
    );
    const page = {
      _id: new ObjectId(),
      workspaceId: ctx.workspace._id,
      slug: "trash-bio",
      title: "Trash bio",
      links: [{ link: id }],
    };
    await db.collection(physicalNames.bio_pages).insertOne(page);
    await db.collection(physicalNames.campaigns).insertOne({
      workspaceId: ctx.workspace._id,
      title: "Kept",
      links: [id],
    });
    for (const value of [key, alias])
      await cache.set(`link:${customDomain}:${value}`, "stale");
    expect((await deleteLinks(ctx, [link.id])).ok).toBe(true);
    const stored = await collection(db, "links").findOne({ _id: id });
    expect(stored?.deletedAt).toEqual(now);
    expect(toCachedLink(stored!, key, null)).toEqual({ kind: "deleted" });
    const loader = mongoLinkLoader(db);
    expect(await loader(customDomain, key)).toEqual({ kind: "deleted" });
    expect(await loader(customDomain, alias)).toEqual({ kind: "deleted" });
    expect(await cache.get(`link:${customDomain}:${key}`)).toBeNull();
    expect(await cache.get(`link:${customDomain}:${alias}`)).toBeNull();
    expect(
      await collection(db, "links").findOne(publicLinkQuery(key, customDomain)),
    ).toBeNull();
    expect(await getLink(ctx, link.id)).toBeNull();
    expect(await getLinkByKey(ctx, key, customDomain)).toBeNull();
    expect((await listLinks(ctx)).links).toHaveLength(0);
    const trash = await listLinks(ctx, { trash: true });
    expect(trash.links[0]?.restoreUntil).toBe(
      new Date(now.getTime() + linkTrashRetentionMs).toISOString(),
    );
    expect(
      (await publicBioFromDocument(db, page, "https://shortn.at", false)).links,
    ).toEqual({});
    expect(
      await db
        .collection(physicalNames.bio_delivery_jobs)
        .countDocuments({ bioPageId: page._id }),
    ).toBe(1);
    expect(
      (await db.collection(physicalNames.campaigns).findOne({ title: "Kept" }))
        ?.links,
    ).toEqual([id]);
    await deleteLinks(
      { ...ctx, now: () => new Date(now.getTime() + 86_400_000) },
      [link.id],
    );
    expect(
      (await collection(db, "links").findOne({ _id: id }))?.deletedAt,
    ).toEqual(now);
    expect((await restoreLinks(ctx, [link.id])).ok).toBe(true);
    const restored = await collection(db, "links").findOne({ _id: id });
    expect(restored?.deletedAt).toBeUndefined();
    expect(toCachedLink(restored!, key, null)).toMatchObject({
      kind: "link",
      status: "interstitial",
      pwd: true,
      dest: link.url,
    });
    expect(await loader(customDomain, alias)).toMatchObject({
      kind: "alias",
      key,
    });
    expect(
      (await publicBioFromDocument(db, page, "https://shortn.at", false)).links[
        link.id
      ],
    ).toBeDefined();
  });
  test("keys stay reserved, expiration is exact, and retryable purge retains aggregate analytics and tenant boundaries", async () => {
    const { ctx, now, key, id, link } = await fixture();
    const other = await ensurePersonalWorkspace(db, {
      id: new ObjectId().toHexString(),
      name: "Foreign refs",
    });
    const foreignCampaign = {
      _id: new ObjectId(),
      workspaceId: other._id,
      title: "Foreign",
      links: [id],
    };
    await db.collection(physicalNames.campaigns).insertOne(foreignCampaign);
    const foreignBio = {
      _id: new ObjectId(),
      workspaceId: other._id,
      links: [{ link: id }],
    };
    await db.collection(physicalNames.bio_pages).insertOne(foreignBio);
    await db.collection(physicalNames.click_rollups).insertOne({
      _id: new ObjectId(),
      workspaceId: ctx.workspace._id,
      linkId: id,
      day: now,
      clicks: 42,
    });
    await deleteLinks(ctx, [link.id]);
    expect(
      await createLink(ctx, { url: "https://example.com/reuse", key }),
    ).toMatchObject({ ok: false, error: "key_taken" });
    const boundary = new Date(now.getTime() + linkTrashRetentionMs);
    expect(
      await restoreLinks({ ...ctx, now: () => boundary }, [link.id]),
    ).toEqual({ ok: true, value: { restored: [] } });
    const failingCache = {
      del: async () => 0,
      publish: async () => 0,
      eval: async () => {
        throw new Error("simulated invalidation outage");
      },
    };
    await expect(
      purgeExpiredLinks({ ...ctx, cache: failingCache }, boundary),
    ).rejects.toThrow("simulated invalidation outage");
    expect(
      (await collection(db, "links").findOne({ _id: id }))?.purgingAt,
    ).toEqual(boundary);
    expect(await restoreLinks(ctx, [link.id])).toEqual({
      ok: true,
      value: { restored: [] },
    });
    expect(await purgeExpiredLinks(ctx, boundary)).toEqual({ purged: 1 });
    expect(await collection(db, "links").findOne({ _id: id })).toBeNull();
    expect(
      await db
        .collection(physicalNames.click_rollups)
        .countDocuments({ linkId: id }),
    ).toBe(1);
    expect(
      (
        await db
          .collection(physicalNames.campaigns)
          .findOne({ _id: foreignCampaign._id })
      )?.links,
    ).toEqual([id]);
    expect(
      (
        await db
          .collection(physicalNames.bio_pages)
          .findOne({ _id: foreignBio._id })
      )?.links,
    ).toEqual([{ link: id }]);
    expect(
      (await createLink(ctx, { url: "https://example.com/reuse", key })).ok,
    ).toBe(true);
  });
  test("delete and restore enforce creator ownership, workspace isolation, and explicit operation limits", async () => {
    const { ctx, link } = await fixture();
    const member = {
      ...ctx,
      actor: { userId: "other-member", role: "member" as const },
    };
    expect(await deleteLinks(member, [link.id])).toMatchObject({
      error: "forbidden",
    });
    await deleteLinks(ctx, [link.id]);
    expect(await restoreLinks(member, [link.id])).toMatchObject({
      error: "forbidden",
    });
    expect(
      await restoreLinks(
        { ...ctx, actor: { ...ctx.actor, role: "viewer" } },
        [],
      ),
    ).toMatchObject({ error: "forbidden" });
    const other = await ensurePersonalWorkspace(db, {
      id: new ObjectId().toHexString(),
      name: "Other",
    });
    expect(await restoreLinks({ ...ctx, workspace: other }, [link.id])).toEqual(
      { ok: true, value: { restored: [] } },
    );
    expect(
      await deleteLinks(
        ctx,
        Array.from({ length: 1001 }, () => link.id),
      ),
    ).toMatchObject({ error: "invalid_input" });
    expect(await restoreLinks(ctx, ["invalid"])).toMatchObject({
      error: "invalid_input",
    });
    expect(
      await restoreLinks({ ...ctx, actor: { ...ctx.actor, role: "member" } }, [
        link.id,
      ]),
    ).toEqual({ ok: true, value: { restored: [link.id] } });
  });
});
