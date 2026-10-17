import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { Redis } from "ioredis";
import { desiredIndexes, physicalNames } from "@shortn/db";
import { setLinksArchived } from "./archive";
import { listLinks, deleteLinks, restoreLinks } from "./service";
import { mongoLinkLoader } from "./loader";
import { pageBulkTagLinks } from "./bulk-tags";
import { ensurePersonalWorkspace } from "../workspaces/service";
import type { ServiceContext } from "../workspaces/context";
const mongo = process.env.MONGO_TEST_URL,
  cache = process.env.REDIS_TEST_URL;
(mongo && cache ? describe : describe.skip)(
  "atomic link archive organization",
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
        `shortn_archive_${crypto.randomUUID().replaceAll("-", "")}`,
      );
      redis = new Redis(cache!);
      for (const name of [physicalNames.links, physicalNames.webhook_events])
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
          name: "Synthetic archive",
          sub: `archive|${userId}`,
        });
      const ctx: ServiceContext = {
        db,
        cache: redis,
        workspace,
        actor: { userId, role: "owner" },
        linkDomain: `${workspace._id}.invalid`,
      };
      const rows = Array.from({ length: count }, (_, i) => ({
        _id: new ObjectId(),
        workspaceId: workspace._id,
        domain: ctx.linkDomain,
        urlCode: `${workspace._id}-${i}`,
        key: `${workspace._id}-${i}`,
        longUrl: `https://example.com/${i}`,
        title: `Link ${i}`,
        tags: [{ tagName: "Keep" }],
        passwordHash: "PRIVATE",
        rules: { forwardQuery: true },
        _sync: { rev: 1 },
      }));
      await db.collection(physicalNames.links).insertMany(rows);
      return { ctx, rows, ids: rows.map((row) => row._id.toHexString()) };
    }
    test("500 selected of 5001 archive atomically, paginate separately, keep redirect and associations, retry without duplicate events", async () => {
      const { ctx, rows, ids } = await fixture(5001),
        selected = ids.slice(0, 500),
        first = rows[0]!;
      const campaign = {
        workspaceId: ctx.workspace._id,
        title: "Preserve",
        links: [first._id],
      };
      const { insertedId } = await db
        .collection(physicalNames.campaigns)
        .insertOne(campaign);
      await db
        .collection(physicalNames.webhook_endpoints)
        .insertOne({
          workspaceId: ctx.workspace._id,
          enabled: true,
          events: ["link.updated"],
        });
      const loader = mongoLinkLoader(db, ctx.linkDomain),
        before = await loader(ctx.linkDomain, first.urlCode);
      expect(await setLinksArchived(ctx, selected, true)).toEqual({
        ok: true,
        value: { selected: 500, updated: 500 },
      });
      expect(await loader(ctx.linkDomain, first.urlCode)).toEqual(before);
      expect(before.kind).toBe("link");
      const active = await listLinks(ctx, { page: 1, limit: 25 }),
        archived = await listLinks(ctx, {
          archived: true,
          page: 2,
          limit: 25,
          tags: ["Keep"],
        });
      expect(active.total).toBe(4501);
      expect(archived.total).toBe(500);
      expect(archived.links).toHaveLength(25);
      expect((await pageBulkTagLinks(ctx, selected))?.selected).toBe(0);
      const review = await pageBulkTagLinks(ctx, selected, {
        includeArchived: true,
        search: "Link 499",
      });
      expect(review?.selected).toBe(500);
      expect(review?.total).toBe(1);
      expect(review?.items).toHaveLength(1);
      expect(
        archived.links.every(
          (link) => link.archivedAt && selected.includes(link.id),
        ),
      ).toBe(true);
      expect(
        (await listLinks(ctx, { archived: true, search: "Link 499" })).total,
      ).toBe(1);
      const saved = (await db
        .collection(physicalNames.links)
        .findOne({ _id: first._id }))!;
      expect(saved.passwordHash).toBe(first.passwordHash);
      expect(saved.rules).toEqual(first.rules);
      expect(saved.tags).toEqual(first.tags);
      expect(saved._sync.rev).toBe(2);
      expect(
        (await db
          .collection(physicalNames.campaigns)
          .findOne({ _id: insertedId }))!.links,
      ).toEqual(campaign.links);
      expect(await setLinksArchived(ctx, selected, true)).toEqual({
        ok: true,
        value: { selected: 500, updated: 0 },
      });
      const events = await db
        .collection(physicalNames.webhook_events)
        .find({ workspaceId: ctx.workspace._id })
        .toArray();
      expect(events).toHaveLength(500);
      expect(JSON.stringify(events).includes("PRIVATE")).toBe(false);
      expect(events.every((event) => event.event.data.archivedAt)).toBe(true);
      expect(await setLinksArchived(ctx, selected, false)).toEqual({
        ok: true,
        value: { selected: 500, updated: 500 },
      });
      expect((await listLinks(ctx, { archived: true })).total).toBe(0);
      expect((await listLinks(ctx)).total).toBe(5001);
      expect(await setLinksArchived(ctx, selected, false)).toEqual({
        ok: true,
        value: { selected: 500, updated: 0 },
      });
    });
    test("foreign, missing, hidden, QR, deleted and purging selections refuse with no partial changes", async () => {
      const { ctx, rows, ids } = await fixture(),
        foreign = await fixture(1);
      for (const bad of [foreign.ids[0]!, String(new ObjectId())])
        expect(await setLinksArchived(ctx, [...ids, bad], true)).toEqual({
          ok: false,
          error: "not_found",
        });
      for (const field of ["hidden", "isQrCode", "deletedAt", "purgingAt"]) {
        await db
          .collection(physicalNames.links)
          .updateOne(
            { _id: rows[1]!._id },
            { $set: { [field]: field.endsWith("At") ? new Date() : true } },
          );
        expect(await setLinksArchived(ctx, ids, true)).toEqual({
          ok: false,
          error: "not_found",
        });
        await db
          .collection(physicalNames.links)
          .updateOne({ _id: rows[1]!._id }, { $unset: { [field]: "" } });
      }
      expect(
        await db
          .collection(physicalNames.links)
          .countDocuments({
            workspaceId: ctx.workspace._id,
            archivedAt: { $exists: true },
          }),
      ).toBe(0);
    });
    test("viewer and bounds refuse; free-plan members and legacy personal ownership work", async () => {
      const { ctx, rows, ids } = await fixture(1);
      expect(
        await setLinksArchived(
          { ...ctx, actor: { ...ctx.actor, role: "viewer" } },
          ids,
          true,
        ),
      ).toEqual({ ok: false, error: "forbidden" });
      for (const invalid of [[], Array(501).fill(ids[0]), ["bad"]])
        expect(await setLinksArchived(ctx, invalid, true)).toEqual({
          ok: false,
          error: "invalid_input",
        });
      expect(
        await setLinksArchived(ctx, ids, "true" as unknown as boolean),
      ).toEqual({ ok: false, error: "invalid_input" });
      await db
        .collection(physicalNames.links)
        .updateOne(
          { _id: rows[0]!._id },
          {
            $unset: { workspaceId: "" },
            $set: { sub: ctx.workspace.legacySub },
          },
        );
      expect(
        (
          await setLinksArchived(
            { ...ctx, actor: { ...ctx.actor, role: "member" } },
            ids,
            true,
          )
        ).ok,
      ).toBe(true);
    });
    test("trash remains separate, restoration retains archival state, and concurrent inverse actions commit a complete selection", async () => {
      const { ctx, rows, ids } = await fixture();
      await setLinksArchived(ctx, ids, true);
      expect((await deleteLinks(ctx, [ids[0]!])).ok).toBe(true);
      expect((await listLinks(ctx, { trash: true })).total).toBe(1);
      expect((await listLinks(ctx, { archived: true })).total).toBe(1);
      expect(await setLinksArchived(ctx, ids, false)).toEqual({
        ok: false,
        error: "not_found",
      });
      expect((await restoreLinks(ctx, [ids[0]!])).ok).toBe(true);
      expect((await listLinks(ctx, { archived: true })).total).toBe(2);
      expect(await setLinksArchived(ctx, [ids[0]!, ids[0]!], false)).toEqual({
        ok: true,
        value: { selected: 1, updated: 1 },
      });
      expect(
        (
          await Promise.all(
            [false, true].map((archived) =>
              setLinksArchived(ctx, ids, archived),
            ),
          )
        ).every((result) => result.ok),
      ).toBe(true);
      const state = await db
        .collection(physicalNames.links)
        .find({ _id: { $in: rows.map((row) => row._id) } })
        .toArray();
      expect(
        state.every(
          (link) => Boolean(link.archivedAt) === Boolean(state[0]!.archivedAt),
        ),
      ).toBe(true);
    });
  },
);
