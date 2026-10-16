import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { Redis } from "ioredis";
import { desiredIndexes, physicalNames } from "@shortn/db";
import { bulkLinkTags, pageBulkTagLinks } from "./bulk-tags";
import { ensurePersonalWorkspace } from "../workspaces/service";
import type { ServiceContext } from "../workspaces/context";
const mongo = process.env.MONGO_TEST_URL,
  cache = process.env.REDIS_TEST_URL;
(mongo && cache ? describe : describe.skip)(
  "atomic bounded bulk link tags",
  () => {
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
        `shortn_bulk_tags_${crypto.randomUUID().replaceAll("-", "")}`,
      );
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
    async function fixture(count = 2) {
      const userId = new ObjectId().toHexString(),
        workspace = await ensurePersonalWorkspace(db, {
          id: userId,
          name: "Synthetic tagging",
          sub: `bulk|${userId}`,
        });
      const ctx: ServiceContext = {
        db,
        cache: redis,
        workspace,
        actor: { userId, role: "owner" },
        linkDomain: "shortn.at",
      };
      const rows = Array.from({ length: count }, (_, i) => ({
        _id: new ObjectId(),
        workspaceId: workspace._id,
        urlCode: `${workspace._id}-${i}`,
        longUrl: `https://example.com/${i}`,
        title: `Link ${i}`,
        tags: [{ id: "old", tagName: "Existing" }],
        passwordHash: "PRIVATE",
        rules: { forwardQuery: true },
        _sync: { rev: 1 },
      }));
      await db.collection(physicalNames.links).insertMany(rows);
      return { ctx, rows, ids: rows.map((row) => row._id.toHexString()) };
    }
    test("add/remove/replace preserve fields, legacy tags, canonical IDs and retry idempotence", async () => {
      const { ctx, rows, ids } = await fixture();
      expect(
        await bulkLinkTags(ctx, {
          ids: [...ids, ids[0]!],
          mode: "add",
          tags: [" São  João ", "são joão"],
        }),
      ).toEqual({ ok: true, value: { selected: 2, updated: 2 } });
      const first = (await db
        .collection(physicalNames.links)
        .findOne({ _id: rows[0]!._id }))!;
      expect(first.tags.map((tag: { tagName: string }) => tag.tagName)).toEqual(
        ["Existing", "são joão"],
      );
      expect(first.tagIds).toHaveLength(1);
      expect(first.passwordHash).toBe("PRIVATE");
      expect(first.rules).toEqual({ forwardQuery: true });
      expect(first._sync.rev).toBe(2);
      expect(
        await bulkLinkTags(ctx, { ids, mode: "add", tags: ["São João"] }),
      ).toEqual({ ok: true, value: { selected: 2, updated: 0 } });
      expect(
        (await bulkLinkTags(ctx, { ids, mode: "remove", tags: ["EXISTING"] }))
          .ok,
      ).toBe(true);
      expect(
        await db
          .collection(physicalNames.tags)
          .countDocuments({ workspaceId: ctx.workspace._id }),
      ).toBe(1);
      expect(
        (await bulkLinkTags(ctx, { ids, mode: "replace", tags: [] })).ok,
      ).toBe(true);
      const cleared = (await db
        .collection(physicalNames.links)
        .findOne({ _id: rows[0]!._id }))!;
      expect(cleared.tags).toEqual([]);
      expect(cleared.tagIds).toEqual([]);
    });
    test("foreign/missing/deleted/hidden/QR selection and viewer refuse without partial writes", async () => {
      const { ctx, rows, ids } = await fixture(),
        foreign = await fixture(1);
      for (const bad of [foreign.ids[0]!, new ObjectId().toHexString()])
        expect(
          await bulkLinkTags(ctx, {
            ids: [...ids, bad],
            mode: "add",
            tags: ["No write"],
          }),
        ).toEqual({ ok: false, error: "not_found" });
      for (const field of ["deletedAt", "hidden", "isQrCode"]) {
        await db
          .collection(physicalNames.links)
          .updateOne(
            { _id: rows[1]!._id },
            { $set: { [field]: field === "deletedAt" ? new Date() : true } },
          );
        expect(
          (
            await bulkLinkTags(ctx, {
              ids,
              mode: "replace",
              tags: ["No write"],
            })
          ).ok,
        ).toBe(false);
        await db
          .collection(physicalNames.links)
          .updateOne({ _id: rows[1]!._id }, { $unset: { [field]: "" } });
      }
      expect(
        await bulkLinkTags(
          { ...ctx, actor: { ...ctx.actor, role: "viewer" } },
          { ids, mode: "add", tags: ["No write"] },
        ),
      ).toEqual({ ok: false, error: "forbidden" });
      expect(
        await db
          .collection(physicalNames.tags)
          .countDocuments({ workspaceId: ctx.workspace._id }),
      ).toBe(0);
      expect(
        (await db
          .collection(physicalNames.links)
          .findOne({ _id: rows[0]!._id }))!._sync.rev,
      ).toBe(1);
    });
    test("operation and per-link tag limits reject before writes and empty remove is invalid", async () => {
      const { ctx, rows, ids } = await fixture();
      await db
        .collection(physicalNames.links)
        .updateOne(
          { _id: rows[1]!._id },
          {
            $set: {
              tags: Array.from({ length: 50 }, (_, i) => ({
                tagName: `Tag ${i}`,
              })),
            },
          },
        );
      expect(
        await bulkLinkTags(ctx, { ids, mode: "add", tags: ["Overflow"] }),
      ).toEqual({ ok: false, error: "tag_limit" });
      expect(
        await db
          .collection(physicalNames.tags)
          .countDocuments({ workspaceId: ctx.workspace._id }),
      ).toBe(0);
      for (const input of [
        { ids: Array(501).fill(ids[0]), mode: "add", tags: ["x"] },
        { ids, mode: "remove", tags: [] },
        { ids, mode: "add", tags: ["x".repeat(49)] },
        { ids: ["bad"], mode: "add", tags: ["x"] },
      ])
        expect(
          await bulkLinkTags(ctx, input as Parameters<typeof bulkLinkTags>[1]),
        ).toEqual({ ok: false, error: "invalid_input" });
    });
    test("500 selected links from a 5001 library change together and emit exactly one event per changed link", async () => {
      const { ctx, ids } = await fixture(5001);
      await db
        .collection(physicalNames.webhook_endpoints)
        .insertOne({
          workspaceId: ctx.workspace._id,
          enabled: true,
          events: ["link.updated"],
        });
      expect(
        await bulkLinkTags(ctx, {
          ids: ids.slice(0, 500),
          mode: "add",
          tags: ["Bulk"],
        }),
      ).toEqual({ ok: true, value: { selected: 500, updated: 500 } });
      expect(
        await db
          .collection(physicalNames.links)
          .countDocuments({
            workspaceId: ctx.workspace._id,
            "tags.tagName": "Bulk",
          }),
      ).toBe(500);
      expect(
        await db
          .collection(physicalNames.webhook_events)
          .countDocuments({ workspaceId: ctx.workspace._id }),
      ).toBe(500);
      expect(
        await bulkLinkTags(ctx, {
          ids: ids.slice(0, 500),
          mode: "add",
          tags: ["Bulk"],
        }),
      ).toEqual({ ok: true, value: { selected: 500, updated: 0 } });
      expect(
        await db
          .collection(physicalNames.webhook_events)
          .countDocuments({ workspaceId: ctx.workspace._id }),
      ).toBe(500);
    });
    test("concurrent additions retain both edits and legacy personal ownership is accepted", async () => {
      const { ctx, rows, ids } = await fixture(1);
      await db
        .collection(physicalNames.links)
        .updateOne(
          { _id: rows[0]!._id },
          {
            $unset: { workspaceId: "" },
            $set: { sub: ctx.workspace.legacySub },
          },
        );
      const results = await Promise.all(
        ["First", "Second"].map((name) =>
          bulkLinkTags(ctx, { ids, mode: "add", tags: [name] }),
        ),
      );
      expect(results.every((result) => result.ok)).toBe(true);
      const link = (await db
        .collection(physicalNames.links)
        .findOne({ _id: rows[0]!._id }))!;
      expect(
        link.tags.map((tag: { tagName: string }) => tag.tagName).sort(),
      ).toEqual(["Existing", "First", "Second"]);
    });
    test("selected review is server-paginated and filters never expand its scope", async () => {
      const { ctx, rows, ids } = await fixture(5001),
        selected = ids.slice(0, 51);
      const first = await pageBulkTagLinks(ctx, selected),
        second = await pageBulkTagLinks(ctx, selected, { page: 2 });
      expect(first?.selected).toBe(51);
      expect(first?.total).toBe(51);
      expect(first?.items).toHaveLength(25);
      expect(first?.pages).toBe(3);
      expect(second?.items).toHaveLength(25);
      expect(
        second?.items.some((link) =>
          first!.items.some((other) => other.id === link.id),
        ),
      ).toBe(false);
      expect(
        (
          await pageBulkTagLinks(ctx, selected, {
            search: "Link 50",
            tags: ["Existing"],
          })
        )?.total,
      ).toBe(1);
      expect(
        (await pageBulkTagLinks(ctx, selected, { search: "Link 5000" }))?.total,
      ).toBe(0);
      await db
        .collection(physicalNames.links)
        .updateOne({ _id: rows[0]!._id }, { $set: { deletedAt: new Date() } });
      expect((await pageBulkTagLinks(ctx, selected))?.selected).toBe(50);
      expect(
        await pageBulkTagLinks(
          { ...ctx, actor: { ...ctx.actor, role: "viewer" } },
          selected,
        ),
      ).toBeNull();
    });
  },
);
