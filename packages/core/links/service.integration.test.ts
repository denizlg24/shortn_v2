import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { deriveLink, physicalNames } from "@shortn/db";
import { Redis } from "ioredis";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { toCachedLink } from "./cached-link";
import {
  createLink,
  deleteLinks,
  listLinks,
  updateLink,
  purgeExpiredLinks,
  linkTrashRetentionMs,
} from "./service";
import { ensurePersonalWorkspace, type Workspace } from "../workspaces/service";
import type { ServiceContext } from "../workspaces/context";
import type { Role } from "../workspaces/authz";

const mongoUrl = process.env.MONGO_TEST_URL;
const redisUrl = process.env.REDIS_TEST_URL;
const enabled = Boolean(mongoUrl && redisUrl);
if (!enabled)
  console.log(
    "SKIP link service integration: set MONGO_TEST_URL and REDIS_TEST_URL",
  );

(enabled ? describe : describe.skip)(
  "link service against Mongo + Redis",
  () => {
    let client: MongoClient;
    let redis: Redis;
    let db: Db;

    beforeAll(async () => {
      client = await new MongoClient(mongoUrl ?? "").connect();
      redis = new Redis(redisUrl ?? "");
      db = client.db(
        `shortn_core_test_${crypto.randomUUID().replaceAll("-", "")}`,
      );
    });
    afterAll(async () => {
      await db?.dropDatabase();
      await client?.close();
      redis?.disconnect();
    });

    async function personal(sub = `authS|${crypto.randomUUID()}`) {
      const userId = new ObjectId().toHexString();
      const workspace = await ensurePersonalWorkspace(db, {
        id: userId,
        name: "Ana",
        email: "ana@example.com",
        sub,
      });
      return { userId, workspace };
    }

    const ctxFor = (
      workspace: Workspace,
      userId: string,
      role: Role = "owner",
    ): ServiceContext => ({
      db,
      workspace,
      actor: { userId, role },
      cache: redis,
      linkDomain: "shortn.at",
    });

    async function subscribe(
      workspace: Workspace,
      plan: "basic" | "plus" | "pro",
    ) {
      await db.collection(physicalNames.subscriptions).insertOne({
        workspaceId: workspace._id,
        polarSubscriptionId: crypto.randomUUID(),
        polarCustomerId: "c",
        productId: "p",
        status: "active",
        plan,
        currentPeriodStart: new Date(Date.now() - 86_400_000),
        currentPeriodEnd: new Date(Date.now() + 29 * 86_400_000),
        cancelAtPeriodEnd: false,
      });
    }

    test("a created link is a complete legacy document the redirect and M3 agree on", async () => {
      const { userId, workspace } = await personal();
      const result = await createLink(ctxFor(workspace, userId), {
        url: "example.com/path?q=1",
        tags: ["News", "news ", "Print"],
      });
      if (!result.ok) throw new Error(result.error);
      const doc = await db
        .collection(physicalNames.links)
        .findOne({ _id: new ObjectId(result.value.id) });
      if (!doc) throw new Error("missing");
      expect(doc.sub).toBe(workspace.legacySub);
      expect(doc.urlCode).toHaveLength(6);
      expect(doc.longUrl).toBe("https://example.com/path?q=1");
      expect(doc.workspaceId).toEqual(workspace._id);
      expect(doc.tags.map((t: { tagName: string }) => t.tagName)).toEqual([
        "News",
        "Print",
      ]);
      expect(doc.tagIds).toHaveLength(2);
      expect(doc.requiresInterstitial).toBe(true);
      expect(doc._sync.lastWriter).toBe("v2");
      expect(doc._sync.legacyHash).toBe(deriveLink(doc).legacyHash);
      expect(doc.key).toBe(doc.urlCode);
      expect(doc.destination).toBe(doc.longUrl);
      const cached = toCachedLink(
        { ...doc, _id: doc._id, workspaceId: doc.workspaceId },
        doc.urlCode,
        null,
      );
      expect(cached).toMatchObject({
        kind: "link",
        status: "interstitial",
        pwd: false,
      });
      const tags = await db
        .collection(physicalNames.tags)
        .find({ workspaceId: workspace._id })
        .toArray();
      expect(tags.map((t) => t.tagName).sort()).toEqual(["News", "Print"]);
      expect(tags.every((t) => t.sub === workspace.legacySub)).toBe(true);
    });

    test("feature gates follow the plan; reserved and taken keys are refused", async () => {
      const { userId, workspace } = await personal();
      const ctx = ctxFor(workspace, userId);
      expect(
        await createLink(ctx, { url: "https://a.com", key: "mine1" }),
      ).toMatchObject({
        ok: false,
        error: "feature_required",
      });
      await subscribe(workspace, "basic");
      expect(
        (await createLink(ctx, { url: "https://a.com", key: "mine1" })).ok,
      ).toBe(true);
      expect(
        await createLink(ctx, { url: "https://a.com", key: "mine1" }),
      ).toMatchObject({ error: "key_taken" });
      expect(
        await createLink(ctx, { url: "https://a.com", key: "dashboard" }),
      ).toMatchObject({ error: "key_reserved" });
      expect(
        await createLink(ctx, { url: "https://a.com", key: "bad key" }),
      ).toMatchObject({ error: "invalid_key" });
      expect(
        await createLink(ctx, { url: "https://a.com", password: "x" }),
      ).toMatchObject({
        error: "feature_required",
      });
      expect(
        await createLink(ctx, { url: "http://127.0.0.1/x" }),
      ).toMatchObject({ error: "unsafe_destination" });
      expect(
        await createLink(ctx, { url: "javascript:alert(1)" }),
      ).toMatchObject({ error: "invalid_url" });
    });

    test("the monthly limit counts legacy-created links and rolls back the extra one", async () => {
      const { userId, workspace } = await personal();
      await db.collection(physicalNames.links).insertMany(
        Array.from({ length: 4 }, (_, i) => ({
          sub: workspace.legacySub,
          urlCode: `legacy${i}${crypto.randomUUID().slice(0, 4)}`,
          longUrl: "https://legacy.example",
          date: new Date(),
        })),
      );
      const ctx = ctxFor(workspace, userId);
      expect((await createLink(ctx, { url: "https://a.com" })).ok).toBe(true);
      expect(await createLink(ctx, { url: "https://b.com" })).toMatchObject({
        error: "limit_reached",
      });
      expect(
        await db
          .collection(physicalNames.links)
          .countDocuments({ longUrl: "https://b.com/" }),
      ).toBe(0);
      expect(
        await db
          .collection(physicalNames.links)
          .countDocuments({ longUrl: "https://b.com" }),
      ).toBe(0);
      const listed = await listLinks(ctx);
      expect(listed.links).toHaveLength(5);
    });

    test("renaming keeps the old key as an alias and moves legacy clicks", async () => {
      const { userId, workspace } = await personal();
      await subscribe(workspace, "pro");
      const ctx = ctxFor(workspace, userId);
      const created = await createLink(ctx, {
        url: "https://a.com",
        key: "before",
      });
      if (!created.ok) throw new Error(created.error);
      await db.collection(physicalNames.clicks).insertOne({
        type: "click",
        urlCode: "before",
        sub: workspace.legacySub,
      });
      await redis.set("link:shortn.at:before", "stale");
      const updated = await updateLink(ctx, created.value.id, {
        key: "after",
        password: "s3cret",
        passwordHint: "pet",
      });
      if (!updated.ok) throw new Error(updated.error);
      const doc = await db
        .collection(physicalNames.links)
        .findOne({ _id: new ObjectId(created.value.id) });
      expect(doc?.urlCode).toBe("after");
      expect(doc?.previousKeys).toEqual(["before"]);
      expect(doc?.passwordProtected).toBe(true);
      expect(doc?.password?.hint).toBe("pet");
      expect(doc?._sync.legacyHash).toBe(doc ? deriveLink(doc).legacyHash : "");
      expect(await redis.get("link:shortn.at:before")).toBeNull();
      expect(
        await db
          .collection(physicalNames.clicks)
          .countDocuments({ urlCode: "after" }),
      ).toBe(1);
      expect(
        await createLink(ctx, { url: "https://b.com", key: "before" }),
      ).toMatchObject({ error: "key_taken" });
      const removed = await updateLink(ctx, created.value.id, {
        removePassword: true,
      });
      expect(removed.ok && removed.value.password).toBeNull();
    });

    test("expired trash archives legacy clicks and detaches owned references", async () => {
      const { userId, workspace } = await personal();
      const ctx = ctxFor(workspace, userId);
      const created = await createLink(ctx, { url: "https://a.com" });
      if (!created.ok) throw new Error(created.error);
      const linkId = new ObjectId(created.value.id);
      await db.collection(physicalNames.clicks).insertOne({
        type: "click",
        urlCode: created.value.key,
        sub: workspace.legacySub,
      });
      await db
        .collection(physicalNames.campaigns)
        .insertOne({ workspaceId: workspace._id, title: "c", links: [linkId] });
      await db.collection(physicalNames.bio_pages).insertOne({
        workspaceId: workspace._id,
        slug: "b",
        links: [{ link: linkId }],
      });
      expect((await deleteLinks(ctx, [created.value.id])).ok).toBe(true);
      expect(
        await db
          .collection(physicalNames.links)
          .countDocuments({ _id: linkId }),
      ).toBe(1);
      expect(
        await db
          .collection(physicalNames.clicks)
          .countDocuments({ urlCode: created.value.key }),
      ).toBe(1);
      await purgeExpiredLinks(
        ctx,
        new Date(Date.now() + linkTrashRetentionMs + 1000),
      );
      expect(
        await db
          .collection(physicalNames.links)
          .countDocuments({ _id: linkId }),
      ).toBe(0);
      expect(
        await db
          .collection(physicalNames.clicks)
          .countDocuments({ urlCode: created.value.key }),
      ).toBe(0);
      expect(
        await db
          .collection("clicks_deleted")
          .countDocuments({ urlCode: created.value.key }),
      ).toBe(1);
      expect(
        await db
          .collection(physicalNames.campaigns)
          .countDocuments({ title: "c" }),
      ).toBe(0);
      expect(
        (await db.collection(physicalNames.bio_pages).findOne({ slug: "b" }))
          ?.links,
      ).toEqual([]);
    });

    test("roles: viewers can't create, members can't delete others' links", async () => {
      const { userId, workspace } = await personal();
      const created = await createLink(ctxFor(workspace, userId), {
        url: "https://a.com",
      });
      if (!created.ok) throw new Error(created.error);
      expect(
        await createLink(ctxFor(workspace, "v", "viewer"), {
          url: "https://a.com",
        }),
      ).toMatchObject({
        error: "forbidden",
      });
      expect(
        await deleteLinks(ctxFor(workspace, "m", "member"), [created.value.id]),
      ).toMatchObject({
        error: "forbidden",
      });
    });

    test("team workspaces never write the legacy owner", async () => {
      const team = await db.collection(physicalNames.workspaces).insertOne({
        slug: `team-${crypto.randomUUID().slice(0, 8)}`,
        name: "Team",
        ownerUserId: "u",
        personal: false,
        plan: "free",
        addOns: [],
        defaultDomain: "shortn.at",
      });
      const workspace = await db
        .collection<Workspace>(physicalNames.workspaces)
        .findOne({ _id: team.insertedId });
      if (!workspace) throw new Error("missing");
      const created = await createLink(ctxFor(workspace, "u"), {
        url: "https://a.com",
        tags: ["x"],
      });
      if (!created.ok) throw new Error(created.error);
      const doc = await db
        .collection(physicalNames.links)
        .findOne({ _id: new ObjectId(created.value.id) });
      expect(doc?.sub).toBeUndefined();
      expect(doc?.tags[0].sub).toBeUndefined();
    });

    test("explicit filters: status, created window, sort by clicks, numbered pages", async () => {
      const { userId, workspace } = await personal();
      await db.collection(physicalNames.subscriptions).insertOne({
        workspaceId: workspace._id,
        polarSubscriptionId: crypto.randomUUID(),
        status: "active",
        plan: "pro",
        currentPeriodStart: new Date(Date.now() - 864e5),
        currentPeriodEnd: new Date(Date.now() + 29 * 864e5),
        cancelAtPeriodEnd: false,
      });
      const ctx = ctxFor(workspace, userId);
      const made = [];
      for (let i = 0; i < 5; i++) {
        const r = await createLink(ctx, {
          url: `https://a.com/${i}`,
          ...(i === 0 ? { password: "x" } : {}),
        });
        if (!r.ok) throw new Error(r.error);
        made.push(r.value);
      }
      await db
        .collection(physicalNames.links)
        .updateOne(
          { _id: new ObjectId(made[3]?.id) },
          { $set: { "clicks.total": 99 } },
        );
      await db
        .collection(physicalNames.links)
        .updateOne(
          { _id: new ObjectId(made[4]?.id) },
          { $set: { date: new Date("2020-01-01") } },
        );
      expect(
        (await listLinks(ctx, { page: 1, status: "password" })).links.map(
          (l) => l.id,
        ),
      ).toEqual([made[0]?.id ?? ""]);
      expect(
        (await listLinks(ctx, { page: 1, sort: "clicks" })).links[0]?.id,
      ).toBe(made[3]?.id);
      expect(
        (
          await listLinks(ctx, {
            page: 1,
            createdAfter: new Date("2025-01-01"),
          })
        ).total,
      ).toBe(4);
      const oldRange = await listLinks(ctx, {
        page: 1,
        createdAfter: new Date("2020-01-01T00:00:00Z"),
        createdBefore: new Date("2020-01-02T00:00:00Z"),
      });
      expect(oldRange.links.map((link) => link.id)).toEqual([
        made[4]?.id ?? "",
      ]);
      expect(
        (
          await listLinks(ctx, {
            createdBefore: new Date("2020-01-01T00:00:00Z"),
          })
        ).links,
      ).toEqual([]);
      const second = await listLinks(ctx, { page: 2, limit: 2 });
      expect([
        second.total,
        second.page,
        second.pages,
        second.links.length,
      ]).toEqual([5, 2, 3, 2]);
    });

    test("personal workspaces also list legacy links that M2 hasn't assigned yet", async () => {
      const { userId, workspace } = await personal();
      await db.collection(physicalNames.links).insertOne({
        sub: workspace.legacySub,
        urlCode: `gap${crypto.randomUUID().slice(0, 6)}`,
        longUrl: "https://gap.example",
        date: new Date(),
      });
      const listed = await listLinks(ctxFor(workspace, userId));
      expect(listed.links.map((l) => l.url)).toContain("https://gap.example");
    });
  },
);
