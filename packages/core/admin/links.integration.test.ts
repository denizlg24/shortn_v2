import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { collection, desiredIndexes, physicalNames } from "@shortn/db";
import { Redis } from "ioredis";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { setLinksArchived } from "../links/archive";
import { bulkLinkTags } from "../links/bulk-tags";
import { createLink, deleteLinks, getLink, updateLink } from "../links/service";
import { publicLink } from "../links/public";
import { toCachedLink } from "../links/cached-link";
import type { ServiceContext } from "../workspaces/context";
import { ensurePersonalWorkspace } from "../workspaces/service";
import { clearAutoBlock, restoreLink, takedownLink } from "./links";

const mongoUrl = process.env.MONGO_TEST_URL;
const redisUrl = process.env.REDIS_TEST_URL;

(mongoUrl && redisUrl ? describe : describe.skip)(
  "link takedown and restore",
  () => {
    let client: MongoClient, db: Db, redis: Redis, ctx: ServiceContext;
    const deps = () => ({ db, cache: redis, linkDomain: "shortn.at" });
    const links = () => collection(db, "links");
    const create = async (url: string) => {
      const created = await createLink(ctx, { url });
      if (!created.ok) throw new Error(created.error);
      return new ObjectId(created.value.id);
    };

    beforeAll(async () => {
      client = await new MongoClient(mongoUrl!).connect();
      db = client.db(
        `shortn_admin_links_${crypto.randomUUID().replaceAll("-", "")}`,
      );
      redis = new Redis(redisUrl!);
      for (const name of [physicalNames.webhook_endpoints])
        await db.collection(name).createIndexes(desiredIndexes[name]!);
      const userId = new ObjectId().toHexString();
      const workspace = await ensurePersonalWorkspace(db, {
        id: userId,
        name: "Moderated",
      });
      await db.collection(physicalNames.subscriptions).insertOne({
        workspaceId: workspace._id,
        status: "active",
        plan: "pro",
        polarSubscriptionId: "pro",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 86_400_000),
      });
      ctx = {
        db,
        workspace,
        actor: { userId, role: "owner" },
        cache: redis,
        linkDomain: "shortn.at",
      };
    });
    afterAll(async () => {
      await db?.dropDatabase();
      await client?.close();
      redis?.disconnect();
    });

    test("a takedown blocks delivery through the legacy-visible fields and freezes owner edits", async () => {
      const id = await create("https://example.com/phish");
      await links().updateOne({ _id: id }, { $set: { safetyStatus: "safe" } });
      const taken = await takedownLink(deps(), id, {
        category: "phishing",
        publicNote: "Credential harvesting",
        internalNote: "ticket 42",
        by: "staff-1",
      });
      expect(taken).toMatchObject({
        ok: true,
        value: { previous: { disabled: false, safetyStatus: "safe" } },
      });
      const doc = (await links().findOne({ _id: id }))!;
      expect(doc).toMatchObject({
        disabled: true,
        disabledReason: "admin:takedown",
        safetyStatus: "blocked",
        safety: {
          disabled: true,
          status: "blocked",
          disabledReason: "admin:takedown",
        },
        moderation: {
          state: "taken_down",
          category: "phishing",
          by: "staff-1",
        },
      });
      expect(toCachedLink(doc, "k", null)).toMatchObject({ status: "blocked" });
      // Defense in depth: moderation alone still blocks.
      expect(
        toCachedLink(
          { ...doc, disabled: false, safetyStatus: "safe" },
          "k",
          null,
        ),
      ).toMatchObject({ status: "blocked" });
      expect(await publicLink(db, doc.urlCode ?? doc.key ?? "")).toMatchObject({
        blocked: true,
        disabledReason: "admin:takedown",
        moderationCategory: "phishing",
      });
      expect((await getLink(ctx, String(id)))?.moderation).toEqual({
        state: "taken_down",
        category: "phishing",
      });
      expect(
        await updateLink(ctx, String(id), { title: "mine" }),
      ).toMatchObject({ ok: false, error: "taken_down" });
      expect(
        await bulkLinkTags(ctx, {
          ids: [String(id)],
          mode: "add",
          tags: ["x"],
        }),
      ).toMatchObject({ ok: false, error: "taken_down" });
      expect(await setLinksArchived(ctx, [String(id)], true)).toMatchObject({
        ok: false,
        error: "taken_down",
      });
      expect(
        await takedownLink(deps(), id, { category: "spam", by: "staff-2" }),
      ).toMatchObject({ ok: false, error: "already_taken_down" });
    });

    test("restore returns the exact pre-takedown state and queues a rescan", async () => {
      const id = await create("https://example.com/restore");
      await links().updateOne(
        { _id: id },
        {
          $set: {
            disabled: true,
            disabledReason: "auto:report-threshold",
            safetyStatus: "blocked",
          },
        },
      );
      await takedownLink(deps(), id, { category: "spam", by: "staff" });
      const now = new Date();
      const restored = await restoreLink({ ...deps(), now: () => now }, id);
      expect(restored).toMatchObject({
        ok: true,
        value: {
          restored: {
            disabled: true,
            safetyStatus: "blocked",
            disabledReason: "auto:report-threshold",
          },
        },
      });
      const doc = (await links().findOne({ _id: id }))!;
      expect(doc.moderation).toBeUndefined();
      expect(doc).toMatchObject({
        disabled: true,
        disabledReason: "auto:report-threshold",
        safetyStatus: "blocked",
      });
      expect(doc.safetyScan?.dueAt).toEqual(now);
      expect(await restoreLink(deps(), id)).toMatchObject({
        ok: false,
        error: "not_taken_down",
      });

      const clean = await create("https://example.com/clean");
      await links().updateOne(
        { _id: clean },
        { $set: { safetyStatus: "safe" } },
      );
      await takedownLink(deps(), clean, { category: "other", by: "staff" });
      await restoreLink(deps(), clean);
      const back = (await links().findOne({ _id: clean }))!;
      expect(back).toMatchObject({ disabled: false, safetyStatus: "safe" });
      expect(back.disabledReason).toBeUndefined();
      expect(
        await updateLink(ctx, String(clean), { title: "editable again" }),
      ).toMatchObject({ ok: true });
    });

    test("an owner can still delete a taken-down link; the record survives in trash", async () => {
      const id = await create("https://example.com/delete");
      await takedownLink(deps(), id, { category: "malware", by: "staff" });
      expect((await deleteLinks(ctx, [String(id)])).ok).toBe(true);
      expect(await links().findOne({ _id: id })).toMatchObject({
        moderation: { category: "malware" },
        deletedAt: expect.any(Date),
      });
    });

    test("takedown and restore emit link.updated to subscribed endpoints", async () => {
      await db.collection(physicalNames.webhook_endpoints).insertOne({
        workspaceId: ctx.workspace._id,
        name: "Moderation",
        url: "https://receiver.example/hook",
        events: ["link.updated"],
        enabled: true,
        secret: "unused",
        createdBy: ctx.actor.userId,
      });
      const id = await create("https://example.com/webhook");
      await takedownLink(deps(), id, { category: "spam", by: "staff" });
      await restoreLink(deps(), id);
      const events = await db
        .collection(physicalNames.webhook_events)
        .find({ "event.type": "link.updated", "event.data.id": String(id) })
        .toArray();
      expect(events.map((event) => event.event.data.moderation)).toEqual([
        { state: "taken_down", category: "spam" },
        null,
      ]);
    });

    test("dismissing an automatic block clears it and the report counters only", async () => {
      const id = await create("https://example.com/reported");
      await links().updateOne(
        { _id: id },
        {
          $set: {
            disabled: true,
            flagged: true,
            disabledReason: "auto:report-threshold",
            safetyStatus: "blocked",
            reportCount: 3,
            "safety.reportCount": 3,
          },
        },
      );
      expect((await clearAutoBlock(deps(), id)).ok).toBe(true);
      expect(await links().findOne({ _id: id })).toMatchObject({
        disabled: false,
        reportCount: 0,
        safetyStatus: "pending",
      });
      const malicious = await create("https://example.com/malicious");
      await links().updateOne(
        { _id: malicious },
        { $set: { disabled: true, disabledReason: "auto:malicious-score" } },
      );
      expect(await clearAutoBlock(deps(), malicious)).toMatchObject({
        ok: false,
        error: "not_auto_blocked",
      });
    });
  },
);
