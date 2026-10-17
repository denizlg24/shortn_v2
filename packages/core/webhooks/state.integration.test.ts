import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { Redis } from "ioredis";
import { physicalNames, desiredIndexes } from "@shortn/db";
import { keys } from "@shortn/redis";
import { ensurePersonalWorkspace } from "../workspaces/service";
import type { ServiceContext } from "../workspaces/context";
import { createLink, updateLink, scanAndPersistLink } from "../links/service";
import { reportLink } from "../links/public";
import { createTag, updateTag, deleteTag } from "../tags/service";
import {
  assignDomainLink,
  removeDomain,
  moveDomainLinks,
} from "../domains/service";
import { bioOutboxCollection } from "../bio/publishing";
import { webhookOutbox } from "./events";
const mongoUrl = process.env.MONGO_TEST_URL,
  redisUrl = process.env.REDIS_TEST_URL;
(mongoUrl && redisUrl ? describe : describe.skip)(
  "link state webhook producers",
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
        `shortn_state_events_${crypto.randomUUID().replaceAll("-", "")}`,
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
    async function context(): Promise<ServiceContext> {
      const userId = new ObjectId().toHexString();
      const workspace = await ensurePersonalWorkspace(db, {
        id: userId,
        name: "Events",
        sub: `auth|${userId}`,
      });
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
        events: ["link.created", "link.updated"],
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
      });
      if (!result.ok) throw new Error(result.error);
      return result.value;
    }
    async function domain(ctx: ServiceContext) {
      const addon = crypto.randomUUID(),
        hostname = `${crypto.randomUUID().slice(0, 8)}.example.test`;
      await db.collection(physicalNames.domain_addons).insertOne({
        workspaceId: ctx.workspace._id,
        polarSubscriptionId: addon,
        status: "active",
      });
      const id = (
        await db.collection(physicalNames.domains).insertOne({
          workspaceId: ctx.workspace._id,
          hostname,
          kind: "links",
          status: "active",
          hostnameStatus: "active",
          sslStatus: "active",
          addonSubscriptionId: addon,
        })
      ).insertedId;
      return { id, hostname };
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
    const stored = (id: string) =>
      db.collection(physicalNames.links).findOne({ _id: new ObjectId(id) });
    test("tag rename/delete walks a thousand links, includes trash/canonical-only references and excludes foreign workspaces", async () => {
      const ctx = await context(),
        foreign = await context(),
        tag = await createTag(ctx, "Old");
      if (!tag.ok) throw new Error(tag.error);
      const tagId = new ObjectId(tag.value.id);
      const docs = Array.from({ length: 1001 }, (_, i) => ({
        workspaceId: ctx.workspace._id,
        urlCode: `tag-${ctx.workspace._id}-${i}`,
        longUrl: "https://example.org/tagged",
        tags: [{ _id: tagId, tagName: "Old" }],
        tagIds: [tagId],
        ...(i % 2 ? { deletedAt: new Date() } : {}),
      }));
      await db.collection(physicalNames.links).insertMany(docs);
      await db.collection(physicalNames.links).insertOne({
        workspaceId: ctx.workspace._id,
        urlCode: "canonical-tags",
        tagIds: [tagId],
      });
      const foreignId = (
        await db.collection(physicalNames.links).insertOne({
          workspaceId: foreign.workspace._id,
          tags: [{ _id: tagId, tagName: "Old" }],
        })
      ).insertedId;
      expect((await updateTag(ctx, tag.value.id, "New")).ok).toBe(true);
      expect(
        await webhookOutbox(db).countDocuments({
          workspaceId: ctx.workspace._id,
        }),
      ).toBe(1002);
      await updateTag(ctx, tag.value.id, "New");
      expect(
        await webhookOutbox(db).countDocuments({
          workspaceId: ctx.workspace._id,
        }),
      ).toBe(1002);
      expect((await deleteTag(ctx, tag.value.id)).ok).toBe(true);
      expect(
        await db
          .collection(physicalNames.links)
          .countDocuments({ workspaceId: ctx.workspace._id, tagIds: tagId }),
      ).toBe(0);
      expect(
        await webhookOutbox(db).countDocuments({
          workspaceId: ctx.workspace._id,
        }),
      ).toBe(2004);
      expect(
        (await db.collection(physicalNames.links).findOne({ _id: foreignId }))
          ?.tags[0].tagName,
      ).toBe("Old");
    }, 30000);
    test("tag outbox failure rolls back tag metadata and all link references", async () => {
      const ctx = await context(),
        own = await link(ctx),
        tag = await createTag(ctx, "Rollback");
      if (!tag.ok) throw new Error(tag.error);
      const tagId = new ObjectId(tag.value.id);
      await db.collection(physicalNames.links).updateOne(
        { _id: new ObjectId(own.id) },
        {
          $set: {
            tags: [{ _id: tagId, tagName: "Rollback" }],
            tagIds: [tagId],
          },
        },
      );
      await rejectEvents(ctx);
      try {
        await expect(updateTag(ctx, tag.value.id, "Failed")).rejects.toThrow();
        await expect(deleteTag(ctx, tag.value.id)).rejects.toThrow();
        expect(
          (await db.collection(physicalNames.tags).findOne({ _id: tagId }))
            ?.name,
        ).toBe("Rollback");
        expect((await stored(own.id))?.tags[0].tagName).toBe("Rollback");
      } finally {
        await allowEvents();
      }
    });
    test("domain assignment, removal and recovery emit one transition each and invalidate both domains and aliases", async () => {
      const ctx = await context(),
        own = await link(ctx),
        target = await domain(ctx),
        alias = `alias-${ctx.workspace._id}`;
      await db
        .collection(physicalNames.links)
        .updateOne(
          { _id: new ObjectId(own.id) },
          { $set: { previousKeys: [alias] } },
        );
      const pageId = (
        await db.collection(physicalNames.bio_pages).insertOne({
          workspaceId: ctx.workspace._id,
          publishedContent: { blocks: [{ linkId: own.id }] },
        })
      ).insertedId;
      for (const host of [ctx.linkDomain, target.hostname])
        for (const key of [own.key, alias])
          await redis.set(keys.link(host, key), "stale");
      await rejectEvents(ctx);
      try {
        await expect(
          assignDomainLink(ctx, String(target.id), own.id),
        ).rejects.toThrow();
        expect((await stored(own.id))?.domain).toBe(ctx.linkDomain);
        expect(
          await db
            .collection(bioOutboxCollection)
            .findOne({ bioPageId: pageId }),
        ).toBeNull();
      } finally {
        await allowEvents();
      }
      expect((await assignDomainLink(ctx, String(target.id), own.id)).ok).toBe(
        true,
      );
      for (const host of [ctx.linkDomain, target.hostname])
        for (const key of [own.key, alias])
          expect(await redis.get(keys.link(host, key))).toBeNull();
      expect(
        await db.collection(bioOutboxCollection).findOne({ bioPageId: pageId }),
      ).not.toBeNull();
      await assignDomainLink(ctx, String(target.id), own.id);
      expect(
        await webhookOutbox(db).countDocuments({
          workspaceId: ctx.workspace._id,
        }),
      ).toBe(2);
      await rejectEvents(ctx);
      try {
        await expect(removeDomain(ctx, String(target.id))).rejects.toThrow();
        expect((await stored(own.id))?.domainInactive).toBe(false);
        expect(
          (
            await db
              .collection(physicalNames.domains)
              .findOne({ _id: target.id })
          )?.status,
        ).toBe("active");
      } finally {
        await allowEvents();
      }
      await removeDomain(ctx, String(target.id));
      await removeDomain(ctx, String(target.id));
      expect(
        await webhookOutbox(db).countDocuments({
          workspaceId: ctx.workspace._id,
        }),
      ).toBe(3);
      await rejectEvents(ctx);
      try {
        await expect(moveDomainLinks(ctx, String(target.id))).rejects.toThrow();
        expect((await stored(own.id))?.domain).toBe(target.hostname);
      } finally {
        await allowEvents();
      }
      expect(await moveDomainLinks(ctx, String(target.id))).toMatchObject({
        ok: true,
        value: { moved: [own.key], conflicts: [] },
      });
      expect(
        await webhookOutbox(db).countDocuments({
          workspaceId: ctx.workspace._id,
        }),
      ).toBe(4);
    });
    test("domain operations reject reserved alias collisions, foreign links and trashed links", async () => {
      const ctx = await context(),
        own = await link(ctx),
        target = await domain(ctx),
        foreign = await context(),
        foreignLink = await link(foreign);
      const alias = `reserved-${ctx.workspace._id}`;
      await db
        .collection(physicalNames.links)
        .updateOne(
          { _id: new ObjectId(own.id) },
          { $set: { previousKeys: [alias] } },
        );
      await db.collection(physicalNames.links).insertOne({
        workspaceId: foreign.workspace._id,
        key: alias,
        domain: target.hostname,
      });
      expect(
        await assignDomainLink(ctx, String(target.id), own.id),
      ).toMatchObject({ ok: false, error: "key_taken" });
      expect(
        await assignDomainLink(ctx, String(target.id), foreignLink.id),
      ).toMatchObject({ ok: false, error: "not_found" });
      await db
        .collection(physicalNames.links)
        .updateOne(
          { _id: new ObjectId(own.id) },
          { $set: { deletedAt: new Date() } },
        );
      expect(
        await assignDomainLink(ctx, String(target.id), own.id),
      ).toMatchObject({ ok: false, error: "not_found" });
    });
    const malicious = {
      webRiskApiKey: "fixture",
      fetch: async (url: string) =>
        Response.json(
          url.includes("webrisk.googleapis.com")
            ? { threat: { threatTypes: ["MALWARE"] } }
            : {
                events: [
                  { eventAction: "registration", eventDate: "2000-01-01" },
                ],
              },
        ),
    };
    test("safety transitions and outbox writes commit together; identical rescans do not duplicate events", async () => {
      const ctx = await context(),
        own = await link(ctx);
      await rejectEvents(ctx);
      try {
        await expect(
          scanAndPersistLink(ctx, new ObjectId(own.id), malicious),
        ).rejects.toThrow();
        expect((await stored(own.id))?.disabled).toBe(false);
      } finally {
        await allowEvents();
      }
      await scanAndPersistLink(ctx, new ObjectId(own.id), malicious);
      expect((await stored(own.id))?.disabled).toBe(true);
      await scanAndPersistLink(ctx, new ObjectId(own.id), malicious);
      expect(
        await webhookOutbox(db).countDocuments({
          workspaceId: ctx.workspace._id,
        }),
      ).toBe(2);
    });
    test("a provider response cannot overwrite a changed destination or a fresh password", async () => {
      const ctx = await context(),
        own = await link(ctx);
      await scanAndPersistLink(ctx, new ObjectId(own.id), {
        ...malicious,
        fetch: async (url) => {
          if (url.includes("webrisk.googleapis.com"))
            await updateLink(ctx, own.id, {
              url: "https://example.org/changed",
            });
          return malicious.fetch(url);
        },
      });
      expect((await stored(own.id))?.disabled).toBe(false);
      expect((await stored(own.id))?.destination).toBe(
        "https://example.org/changed",
      );
      let hash: unknown;
      await scanAndPersistLink(ctx, new ObjectId(own.id), {
        ...malicious,
        fetch: async (url) => {
          if (url.includes("webrisk.googleapis.com")) {
            await updateLink(ctx, own.id, { password: "fresh-password" });
            hash = (await stored(own.id))?.password.hash;
          }
          return malicious.fetch(url);
        },
      });
      expect(typeof hash).toBe("string");
      expect((await stored(own.id))?.passwordHash).toBe(hash);
      expect((await stored(own.id))?.password.hash).toBe(hash);
      expect((await stored(own.id))?.disabled).toBe(true);
      expect(
        JSON.stringify(
          await webhookOutbox(db)
            .find({ workspaceId: ctx.workspace._id })
            .toArray(),
        ),
      ).not.toContain("fresh-password");
    });
    test("report threshold rolls back on outbox failure and emits no reporter data", async () => {
      const ctx = await context(),
        own = await link(ctx);
      const deps = {
        db,
        counters: redis,
        cache: redis,
        linkDomain: ctx.linkDomain,
      };
      const report = (who: string) =>
        reportLink(deps, {
          key: own.key,
          reason: "spam",
          details: "private report details",
          ipHash: `${ctx.workspace._id}-${who}`,
        });
      await report("one");
      await report("two");
      await rejectEvents(ctx);
      try {
        await expect(report("three")).rejects.toThrow();
        expect((await stored(own.id))?.reportCount).toBe(2);
        expect((await stored(own.id))?.disabled).toBe(false);
      } finally {
        await allowEvents();
      }
      await report("three");
      await report("three");
      expect((await stored(own.id))?.reportCount).toBe(3);
      expect((await stored(own.id))?.safetyStatus).toBe("blocked");
      const events = await webhookOutbox(db)
        .find({ workspaceId: ctx.workspace._id })
        .toArray();
      expect(events).toHaveLength(2);
      expect(JSON.stringify(events)).not.toContain("private report details");
      expect(JSON.stringify(events)).not.toContain(
        `${ctx.workspace._id}-three`,
      );
    });
    test("concurrent reporters serialize the threshold and count duplicate identities once", async () => {
      const ctx = await context(),
        own = await link(ctx),
        deps = {
          db,
          counters: redis,
          cache: redis,
          linkDomain: ctx.linkDomain,
        };
      await Promise.all(
        ["a", "b", "c", "a"].map((who) =>
          reportLink(deps, {
            key: own.key,
            reason: "spam",
            ipHash: `${ctx.workspace._id}-${who}`,
          }),
        ),
      );
      expect((await stored(own.id))?.reportCount).toBe(3);
      expect((await stored(own.id))?.disabled).toBe(true);
      expect(
        await webhookOutbox(db).countDocuments({
          workspaceId: ctx.workspace._id,
        }),
      ).toBe(2);
    });
  },
);
