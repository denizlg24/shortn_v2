import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { keys } from "@shortn/redis";
import { Redis } from "ioredis";
import { physicalNames, desiredIndexes } from "@shortn/db";
import { ensurePersonalWorkspace } from "../workspaces/service";
import type { ServiceContext } from "../workspaces/context";
import { createLink, updateLink } from "../links/service";
import { createQr, updateQr, deleteQrs } from "../qr/service";
import {
  createCampaign,
  setLinkUtm,
  updateCampaign,
  deleteCampaign,
} from "../campaigns/service";
import { webhookOutbox } from "./events";
const mongoUrl = process.env.MONGO_TEST_URL,
  redisUrl = process.env.REDIS_TEST_URL;
(mongoUrl && redisUrl ? describe : describe.skip)(
  "secondary link mutation events",
  () => {
    let client: MongoClient, db: Db, redis: Redis;
    beforeAll(async () => {
      if (
        ![mongoUrl, redisUrl].every((url) =>
          ["127.0.0.1", "localhost"].includes(new URL(url!).hostname),
        )
      )
        throw new Error("Loopback services required");
      client = await new MongoClient(mongoUrl!).connect();
      redis = new Redis(redisUrl!);
      db = client.db(
        `shortn_secondary_events_${crypto.randomUUID().replaceAll("-", "")}`,
      );
      await db
        .collection(physicalNames.webhook_events)
        .createIndexes(desiredIndexes[physicalNames.webhook_events]!);
    });
    afterAll(async () => {
      redis?.disconnect();
      await db?.dropDatabase();
      await client?.close();
    });
    async function context(pro = true): Promise<ServiceContext> {
      const userId = new ObjectId().toHexString();
      const workspace = await ensurePersonalWorkspace(db, {
        id: userId,
        name: "Events",
        sub: `auth|${userId}`,
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
      await db.collection(physicalNames.webhook_endpoints).insertOne({
        workspaceId: workspace._id,
        enabled: true,
        events: ["link.created", "link.updated", "link.deleted"],
        createdAt: new Date(0),
      });
      return {
        db,
        cache: redis,
        actor: { userId, role: "owner" },
        workspace,
        linkDomain: "shortn.at",
      };
    }
    async function link(ctx: ServiceContext) {
      const result = await createLink(ctx, {
        url: "https://example.org/original",
        password: "private-secret",
      });
      if (!result.ok) throw new Error(result.error);
      return result.value;
    }
    async function rejectEvents(ctx: ServiceContext) {
      await db.command({
        collMod: physicalNames.webhook_events,
        validator: { workspaceId: { $ne: ctx.workspace._id } },
        validationLevel: "strict",
        validationAction: "error",
      });
    }
    async function allowEvents() {
      await db.command({
        collMod: physicalNames.webhook_events,
        validator: {},
      });
    }
    test("QR lifecycle emits backing/attachment events and archives scans in the deletion transaction", async () => {
      const ctx = await context(),
        attached = await link(ctx);
      const created = await createQr(ctx, {
        url: "https://example.org/qr",
        attachToLinkId: attached.id,
      });
      if (!created.ok) throw new Error(created.error);
      const qrId = new ObjectId(created.value.id),
        qr = await db.collection(physicalNames.qr_codes).findOne({ _id: qrId });
      expect(
        (
          await updateQr(ctx, created.value.id, {
            url: "https://example.org/new",
            title: "Changed",
            applyToLink: true,
          })
        ).ok,
      ).toBe(true);
      const beforeRepeat = await webhookOutbox(db).countDocuments({
        workspaceId: ctx.workspace._id,
      });
      await updateQr(ctx, created.value.id, {
        url: "https://example.org/new",
        title: "Changed",
        applyToLink: true,
      });
      expect(
        await webhookOutbox(db).countDocuments({
          workspaceId: ctx.workspace._id,
        }),
      ).toBe(beforeRepeat);
      expect(
        (
          await updateQr(ctx, created.value.id, {
            tags: ["QR tag"],
            applyToLink: true,
          })
        ).ok,
      ).toBe(true);
      const ownClick = new ObjectId(),
        foreignClick = new ObjectId();
      await db.collection(physicalNames.clicks).insertMany([
        {
          _id: ownClick,
          sub: ctx.workspace.legacySub,
          urlCode: qr!.qrCodeId,
          type: "scan",
          workspaceId: ctx.workspace._id,
        },
        {
          _id: foreignClick,
          sub: ctx.workspace.legacySub,
          urlCode: qr!.qrCodeId,
          type: "scan",
          workspaceId: new ObjectId(),
        },
      ]);
      await db.collection(physicalNames.clicks).insertMany(
        Array.from({ length: 1000 }, () => ({
          sub: ctx.workspace.legacySub,
          urlCode: qr!.qrCodeId,
          type: "scan",
          workspaceId: ctx.workspace._id,
        })),
      );
      expect((await deleteQrs(ctx, [created.value.id])).ok).toBe(true);
      expect(
        await db.collection("clicks_deleted").findOne({ _id: ownClick }),
      ).not.toBeNull();
      expect(
        await db
          .collection(physicalNames.clicks)
          .findOne({ _id: foreignClick }),
      ).not.toBeNull();
      expect(
        await db.collection("clicks_deleted").findOne({ _id: foreignClick }),
      ).toBeNull();
      expect(
        await db
          .collection("clicks_deleted")
          .countDocuments({ workspaceId: ctx.workspace._id }),
      ).toBe(1001);
      const events = await webhookOutbox(db)
        .find({ workspaceId: ctx.workspace._id })
        .sort({ _id: 1 })
        .toArray();
      expect(events.map((row) => row.event.type)).toEqual([
        "link.created",
        "link.created",
        "link.updated",
        "link.updated",
        "link.updated",
        "link.updated",
        "link.deleted",
        "link.updated",
      ]);
      expect(
        events.find((row) => row.event.type === "link.deleted")?.event.data
          .deletedAt,
      ).not.toBeNull();
      expect(JSON.stringify(events)).not.toContain("private-secret");
      await deleteQrs(ctx, [created.value.id]);
      expect(
        await webhookOutbox(db).countDocuments({
          workspaceId: ctx.workspace._id,
        }),
      ).toBe(events.length);
    });
    test("QR attachment edits and detachment survive a linked resource rename", async () => {
      const ctx = await context(),
        attached = await link(ctx);
      const made = await createQr(ctx, {
        url: "https://example.org/qr",
        attachToLinkId: attached.id,
      });
      if (!made.ok) throw new Error(made.error);
      const key = `renamed-${crypto.randomUUID().slice(0, 8)}`;
      expect((await updateLink(ctx, attached.id, { key })).ok).toBe(true);
      const aliasCache = keys.link(ctx.linkDomain, attached.key);
      await redis.set(aliasCache, "stale");
      expect(
        (
          await updateQr(ctx, made.value.id, {
            title: "After rename",
            applyToLink: true,
          })
        ).ok,
      ).toBe(true);
      expect(
        (
          await db
            .collection(physicalNames.links)
            .findOne({ _id: new ObjectId(attached.id) })
        )?.title,
      ).toBe("After rename");
      expect(await redis.get(aliasCache)).toBeNull();
      await redis.set(aliasCache, "stale");
      expect((await deleteQrs(ctx, [made.value.id])).ok).toBe(true);
      expect(
        (
          await db
            .collection(physicalNames.links)
            .findOne({ _id: new ObjectId(attached.id) })
        )?.attachedQrId,
      ).toBeUndefined();
      expect(await redis.get(aliasCache)).toBeNull();
    });

    test("QR outbox failure rolls back creation, editing, deletion and scan archival", async () => {
      const ctx = await context(),
        attached = await link(ctx);
      await rejectEvents(ctx);
      try {
        await expect(
          createQr(ctx, {
            url: "https://example.org/qr",
            attachToLinkId: attached.id,
          }),
        ).rejects.toThrow();
      } finally {
        await allowEvents();
      }
      expect(
        await db
          .collection(physicalNames.qr_codes)
          .countDocuments({ workspaceId: ctx.workspace._id }),
      ).toBe(0);
      expect(
        await db
          .collection(physicalNames.links)
          .countDocuments({ workspaceId: ctx.workspace._id }),
      ).toBe(1);
      const made = await createQr(ctx, {
        url: "https://example.org/qr",
        attachToLinkId: attached.id,
      });
      if (!made.ok) throw new Error(made.error);
      const qrId = new ObjectId(made.value.id),
        qr = await db.collection(physicalNames.qr_codes).findOne({ _id: qrId });
      const clickId = (
        await db.collection(physicalNames.clicks).insertOne({
          sub: ctx.workspace.legacySub,
          urlCode: qr!.qrCodeId,
          type: "scan",
          workspaceId: ctx.workspace._id,
        })
      ).insertedId;
      await rejectEvents(ctx);
      try {
        await expect(
          updateQr(ctx, made.value.id, {
            url: "https://example.org/failed",
            applyToLink: true,
          }),
        ).rejects.toThrow();
        expect(
          (await db.collection(physicalNames.qr_codes).findOne({ _id: qrId }))
            ?.longUrl,
        ).toBe("https://example.org/qr");
        expect(
          (
            await db
              .collection(physicalNames.links)
              .findOne({ _id: qr!.linkId })
          )?.destination,
        ).toBe("https://example.org/qr");
        await expect(deleteQrs(ctx, [made.value.id])).rejects.toThrow();
        expect(
          await db.collection(physicalNames.qr_codes).findOne({ _id: qrId }),
        ).not.toBeNull();
        expect(
          await db.collection(physicalNames.clicks).findOne({ _id: clickId }),
        ).not.toBeNull();
        expect(
          await db.collection("clicks_deleted").findOne({ _id: clickId }),
        ).toBeNull();
      } finally {
        await allowEvents();
      }
    });
    test("concurrent free QR creation respects quota with no orphan backing links or extra events", async () => {
      const ctx = await context(false);
      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          createQr(ctx, { url: "https://example.org/quota" }),
        ),
      );
      expect(results.filter((result) => result.ok)).toHaveLength(5);
      expect(
        results.filter(
          (result) => !result.ok && result.error === "limit_reached",
        ),
      ).toHaveLength(3);
      expect(
        await db
          .collection(physicalNames.links)
          .countDocuments({ workspaceId: ctx.workspace._id }),
      ).toBe(5);
      expect(
        await db
          .collection(physicalNames.qr_codes)
          .countDocuments({ workspaceId: ctx.workspace._id }),
      ).toBe(5);
      expect(
        await webhookOutbox(db).countDocuments({
          workspaceId: ctx.workspace._id,
        }),
      ).toBe(5);
    });
    test("campaign edits emit events, preserve other campaign IDs and exclude contaminated foreign references", async () => {
      const ctx = await context(),
        own = await link(ctx),
        foreign = await context(),
        foreignLink = await link(foreign);
      expect(
        (
          await setLinkUtm(ctx, own.id, [
            { campaign: "Campaign", source: "mail" },
          ])
        ).ok,
      ).toBe(true);
      const campaign = await db
        .collection(physicalNames.campaigns)
        .findOne({ workspaceId: ctx.workspace._id, title: "Campaign" });
      const id = campaign!._id;
      const foreignVariants = [{ campaign: { _id: id, title: "Campaign" } }];
      await db
        .collection(physicalNames.links)
        .updateOne(
          { _id: new ObjectId(foreignLink.id) },
          { $set: { utmLinks: foreignVariants } },
        );
      const siblingCampaign = new ObjectId();
      await db
        .collection<{
          utmLinks: { campaign: { _id: ObjectId; title: string } }[];
        }>(physicalNames.links)
        .updateOne(
          { _id: new ObjectId(own.id) },
          {
            $push: {
              utmLinks: {
                campaign: { _id: siblingCampaign, title: "Campaign" },
              },
            },
          },
        );
      expect(
        (await updateCampaign(ctx, id.toHexString(), { title: "Renamed" })).ok,
      ).toBe(true);
      const renamed = await db
        .collection(physicalNames.links)
        .findOne({ _id: new ObjectId(own.id) });
      expect(
        renamed?.utmLinks.map(
          (v: { campaign: { title: string } }) => v.campaign.title,
        ),
      ).toEqual(["Renamed", "Campaign"]);
      expect((await deleteCampaign(ctx, id.toHexString())).ok).toBe(true);
      expect(
        (
          await db
            .collection(physicalNames.links)
            .findOne({ _id: new ObjectId(own.id) })
        )?.utmLinks,
      ).toEqual([{ campaign: { _id: siblingCampaign, title: "Campaign" } }]);
      expect(
        (
          await db
            .collection(physicalNames.links)
            .findOne({ _id: new ObjectId(foreignLink.id) })
        )?.utmLinks,
      ).toEqual(foreignVariants);
      expect(
        await webhookOutbox(db).countDocuments({
          workspaceId: ctx.workspace._id,
        }),
      ).toBe(4);
    });
    test("removing a contaminated UTM reference cannot alter a foreign campaign's membership", async () => {
      const ctx = await context(),
        foreign = await context(),
        own = await link(ctx);
      const foreignCampaign = new ObjectId();
      await db.collection(physicalNames.campaigns).insertOne({
        _id: foreignCampaign,
        workspaceId: foreign.workspace._id,
        title: "Foreign",
        links: [new ObjectId(own.id)],
      });
      await db.collection(physicalNames.links).updateOne(
        { _id: new ObjectId(own.id) },
        {
          $set: {
            utmLinks: [
              { campaign: { _id: foreignCampaign, title: "Foreign" } },
            ],
          },
        },
      );
      expect((await setLinkUtm(ctx, own.id, [])).ok).toBe(true);
      expect(
        (
          await db
            .collection(physicalNames.campaigns)
            .findOne({ _id: foreignCampaign })
        )?.links,
      ).toEqual([new ObjectId(own.id)]);
    });

    test("campaign rename/delete walks a thousand-link library and legacy title-only references", async () => {
      const ctx = await context();
      const made = await createCampaign(ctx, { title: "Large" });
      if (!made.ok) throw new Error(made.error);
      const campaignId = new ObjectId(made.value.id);
      const docs = Array.from({ length: 1001 }, (_, i) => ({
        _id: new ObjectId(),
        workspaceId: ctx.workspace._id,
        urlCode: `large-${i}`,
        longUrl: "https://example.org/large",
        utmLinks: [
          { campaign: { _id: campaignId, title: "Large" }, source: "mail" },
        ],
      }));
      const legacyId = new ObjectId();
      await db.collection(physicalNames.links).insertMany([
        ...docs,
        {
          _id: legacyId,
          workspaceId: ctx.workspace._id,
          urlCode: "legacy-reference",
          longUrl: "https://example.org/legacy",
          utmLinks: [{ campaign: { title: "Large" }, source: "mail" }],
        },
      ]);
      const alias = `campaign-alias-${ctx.workspace._id}`;
      await db
        .collection(physicalNames.links)
        .updateOne({ _id: legacyId }, { $set: { previousKeys: [alias] } });
      await redis.set(keys.link(ctx.linkDomain, alias), "stale");
      expect(
        (await updateCampaign(ctx, made.value.id, { title: "Large renamed" }))
          .ok,
      ).toBe(true);
      expect(
        await db.collection(physicalNames.links).countDocuments({
          workspaceId: ctx.workspace._id,
          "utmLinks.campaign.title": "Large renamed",
        }),
      ).toBe(1002);
      expect(
        await webhookOutbox(db).countDocuments({
          workspaceId: ctx.workspace._id,
        }),
      ).toBe(1002);
      expect(await redis.get(keys.link(ctx.linkDomain, alias))).toBeNull();
      await redis.set(keys.link(ctx.linkDomain, alias), "stale");
      expect((await deleteCampaign(ctx, made.value.id)).ok).toBe(true);
      expect(await redis.get(keys.link(ctx.linkDomain, alias))).toBeNull();
      expect(
        await db.collection(physicalNames.links).countDocuments({
          workspaceId: ctx.workspace._id,
          utmLinks: { $size: 0 },
        }),
      ).toBe(1002);
      expect(
        await webhookOutbox(db).countDocuments({
          workspaceId: ctx.workspace._id,
        }),
      ).toBe(2004);
    }, 30000);

    test("campaign outbox failures roll back variants, membership and rename/delete", async () => {
      const ctx = await context(),
        own = await link(ctx);
      await rejectEvents(ctx);
      try {
        await expect(
          setLinkUtm(ctx, own.id, [{ campaign: "Rollback" }]),
        ).rejects.toThrow();
      } finally {
        await allowEvents();
      }
      expect(
        await db
          .collection(physicalNames.campaigns)
          .countDocuments({ workspaceId: ctx.workspace._id }),
      ).toBe(0);
      expect(
        (
          await db
            .collection(physicalNames.links)
            .findOne({ _id: new ObjectId(own.id) })
        )?.utmLinks,
      ).toEqual([]);
      await setLinkUtm(ctx, own.id, [{ campaign: "Rollback" }]);
      const campaign = await db
        .collection(physicalNames.campaigns)
        .findOne({ workspaceId: ctx.workspace._id });
      await rejectEvents(ctx);
      try {
        await expect(
          updateCampaign(ctx, campaign!._id.toHexString(), { title: "Failed" }),
        ).rejects.toThrow();
        await expect(
          deleteCampaign(ctx, campaign!._id.toHexString()),
        ).rejects.toThrow();
        expect(
          (
            await db
              .collection(physicalNames.campaigns)
              .findOne({ _id: campaign!._id })
          )?.title,
        ).toBe("Rollback");
        expect(
          (
            await db
              .collection(physicalNames.links)
              .findOne({ _id: new ObjectId(own.id) })
          )?.utmLinks[0].campaign.title,
        ).toBe("Rollback");
      } finally {
        await allowEvents();
      }
    });
    test("concurrent expected-state UTM edits reject stale input and create only the winning campaign", async () => {
      const ctx = await context(),
        own = await link(ctx);
      const results = await Promise.all([
        setLinkUtm(ctx, own.id, [{ campaign: "One" }], []),
        setLinkUtm(ctx, own.id, [{ campaign: "Two" }], []),
      ]);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(
        results.filter((result) => !result.ok && result.error === "conflict"),
      ).toHaveLength(1);
      expect(
        await db
          .collection(physicalNames.campaigns)
          .countDocuments({ workspaceId: ctx.workspace._id }),
      ).toBe(1);
      expect(
        await webhookOutbox(db).countDocuments({
          workspaceId: ctx.workspace._id,
        }),
      ).toBe(2);
    });
  },
);
