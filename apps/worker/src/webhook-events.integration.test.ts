import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { Redis } from "ioredis";
import { collection, physicalNames, desiredIndexes } from "@shortn/db";
import {
  createLink,
  updateLink,
  deleteLinks,
  restoreLinks,
  createWebhook,
  ensurePersonalWorkspace,
  webhookOutbox,
  deliveries,
  endpoints,
  createBioPage,
  readBioDraft,
  saveBioDraft,
  publishBioDraft,
  pollDomains,
  type ServiceContext,
  type DomainProvider,
} from "@shortn/core";
import { fanoutWebhookEvents } from "./webhook-events";
import { createWebhookWorker } from "./outgoing-webhooks";
const mongoUrl = process.env.MONGO_TEST_URL,
  redisUrl = process.env.REDIS_DURABLE_TEST_URL ?? process.env.REDIS_TEST_URL;
const config = {
  enabled: true,
  secretKey: "mutation-event-encryption-key-".repeat(3),
};
(mongoUrl && redisUrl ? describe : describe.skip)(
  "transactional webhook mutation events",
  () => {
    let client: MongoClient, db: Db, redis: Redis;
    beforeAll(async () => {
      if (
        !/^mongodb:\/\/(localhost|127\.0\.0\.1):/.test(mongoUrl!) ||
        !/^redis:\/\/(localhost|127\.0\.0\.1):/.test(redisUrl!)
      )
        throw new Error("Mutation event fixtures require loopback services");
      client = await new MongoClient(mongoUrl!).connect();
      db = client.db(
        `shortn_mutation_events_${crypto.randomUUID().replaceAll("-", "")}`,
      );
      redis = new Redis(redisUrl!);
      for (const key of [
        "links",
        "tags",
        "qr_codes",
        "bio_pages",
        "bio_page_versions",
        "bio_delivery_jobs",
        "webhook_endpoints",
        "webhook_events",
        "webhook_deliveries",
      ] as const)
        await db
          .collection(physicalNames[key])
          .createIndexes(desiredIndexes[physicalNames[key]]!);
    }, 30000);
    afterAll(async () => {
      redis?.disconnect();
      await db?.dropDatabase();
      await client?.close();
    });
    async function fixture(name: string, paid = true) {
      const actor = {
        userId: new ObjectId().toHexString(),
        role: "owner" as const,
      };
      const workspace = await ensurePersonalWorkspace(db, {
        id: actor.userId,
        name,
        sub: `events|${actor.userId}`,
      });
      workspace.platformFeatures = { webhooks: true };
      await collection(db, "workspaces").updateOne(
        { _id: workspace._id },
        { $set: { platformFeatures: workspace.platformFeatures } },
      );
      if (paid)
        await db.collection(physicalNames.subscriptions).insertOne({
          workspaceId: workspace._id,
          plan: "pro",
          status: "active",
          polarSubscriptionId: crypto.randomUUID(),
          currentPeriodStart: new Date(Date.now() - 86400000),
          currentPeriodEnd: new Date(Date.now() + 86400000),
          cancelAtPeriodEnd: false,
        });
      const ctx: ServiceContext = {
        db,
        workspace,
        actor,
        cache: redis,
        linkDomain: "shortn.at",
      };
      const hook = await createWebhook(
        ctx,
        {
          name,
          url: "https://receiver.example/hooks",
          events: [
            "link.created",
            "link.updated",
            "link.deleted",
            "bio.published",
            "domain.verified",
          ],
        },
        config,
      );
      if (!hook.ok) throw new Error(hook.error);
      return { ctx, hook: hook.value };
    }
    test("link lifecycle events commit once, preserve order and reach the receiver without sensitive fields", async () => {
      const { ctx, hook } = await fixture("Lifecycle");
      const created = await createLink(ctx, {
        url: "https://example.com/private",
        password: "private-password",
        passwordHint: "private-hint",
        title: "Initial",
      });
      if (!created.ok) throw new Error(created.error);
      expect(
        (await updateLink(ctx, created.value.id, { title: "Updated" })).ok,
      ).toBe(true);
      expect((await deleteLinks(ctx, [created.value.id])).ok).toBe(true);
      expect((await deleteLinks(ctx, [created.value.id])).ok).toBe(true);
      expect((await restoreLinks(ctx, [created.value.id])).ok).toBe(true);
      expect((await restoreLinks(ctx, [created.value.id])).ok).toBe(true);
      const outbox = await webhookOutbox(db)
        .find({ workspaceId: ctx.workspace._id })
        .sort({ _id: 1 })
        .toArray();
      expect(outbox.map((row) => row.event.type)).toEqual([
        "link.created",
        "link.updated",
        "link.deleted",
        "link.updated",
      ]);
      expect(outbox[0]?.event.data.title).toBe("Initial");
      expect(outbox[1]?.event.data.title).toBe("Updated");
      expect(outbox[2]?.event.data.deletedAt).not.toBeNull();
      expect(outbox[3]?.event.data.deletedAt).toBeNull();
      for (const row of outbox) {
        const json = JSON.stringify(row.event);
        for (const secret of [
          "private-password",
          "private-hint",
          "passwordHash",
          "_sync",
          "createdBy",
          "safety",
          "sub",
          "ipHash",
        ])
          expect(json).not.toContain(`"${secret}"`);
      }
      const received: string[] = [];
      const receiver = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        async fetch(request) {
          received.push(await request.text());
          return new Response(null, { status: 204 });
        },
      });
      const worker = createWebhookWorker({
        db,
        durable: redis,
        config,
        queueName: `mutation-events-${crypto.randomUUID()}`,
        log: () => {},
        send: async (_url, body, headers) =>
          (
            await fetch(`http://127.0.0.1:${receiver.port}`, {
              method: "POST",
              body,
              headers,
            })
          ).status,
      });
      try {
        await worker.pump();
        const deadline = Date.now() + 5000;
        while (
          Date.now() < deadline &&
          (await deliveries(db).countDocuments({
            webhookId: new ObjectId(hook.id),
            status: "delivered",
          })) !== 4
        )
          await Bun.sleep(20);
        expect(received).toHaveLength(4);
        expect(new Set(received.map((body) => JSON.parse(body).id)).size).toBe(
          4,
        );
        await worker.pump();
        expect(received).toHaveLength(4);
        expect(
          await webhookOutbox(db).countDocuments({
            workspaceId: ctx.workspace._id,
            completedAt: { $exists: true },
          }),
        ).toBe(4);
      } finally {
        await worker.worker.close();
        await worker.queue.obliterate({ force: true });
        await worker.close();
        await receiver.stop(true);
      }
    }, 15000);
    test("concurrent patches preserve password, destination, aliases and legacy click ownership", async () => {
      const { ctx } = await fixture("Concurrent patches");
      const made = await createLink(ctx, {
        url: "https://example.com/before",
        password: "initial-password",
      });
      if (!made.ok) throw new Error(made.error);
      const id = new ObjectId(made.value.id);
      const updates = await Promise.all([
        updateLink(ctx, made.value.id, { password: "replacement-password" }),
        updateLink(ctx, made.value.id, { url: "https://example.com/after" }),
      ]);
      expect(updates.every((result) => result.ok)).toBe(true);
      const current = await collection(db, "links").findOne({ _id: id });
      expect(current?.destination).toBe("https://example.com/after");
      expect(current?.longUrl).toBe(current?.destination);
      expect(current?.password?.hash).toBe(current?.passwordHash);
      const ownClick = new ObjectId(),
        foreignClick = new ObjectId();
      await db.collection(physicalNames.clicks).insertMany([
        {
          _id: ownClick,
          type: "click",
          urlCode: made.value.key,
          sub: ctx.workspace.legacySub,
        },
        {
          _id: foreignClick,
          type: "click",
          urlCode: made.value.key,
          sub: ctx.workspace.legacySub,
          workspaceId: new ObjectId(),
        },
      ]);
      const keys = [0, 1].map(() => `event-${crypto.randomUUID().slice(0, 8)}`);
      expect(
        (
          await Promise.all(
            keys.map((key) => updateLink(ctx, made.value.id, { key })),
          )
        ).every((result) => result.ok),
      ).toBe(true);
      const renamed = await collection(db, "links").findOne({ _id: id });
      expect(new Set(renamed?.previousKeys)).toEqual(
        new Set([
          made.value.key,
          ...keys.filter((key) => key !== renamed?.key),
        ]),
      );
      expect(
        (await db.collection(physicalNames.clicks).findOne({ _id: ownClick }))
          ?.urlCode,
      ).toBe(renamed?.key);
      expect(
        (
          await db
            .collection(physicalNames.clicks)
            .findOne({ _id: foreignClick })
        )?.urlCode,
      ).toBe(made.value.key);
    });
    test("outbox insertion failures roll back link creation, updates and deletion", async () => {
      const { ctx } = await fixture("Rollback");
      const existing = await createLink(ctx, {
        url: "https://example.com/kept",
        title: "Kept",
      });
      if (!existing.ok) throw new Error(existing.error);
      const count = await webhookOutbox(db).countDocuments({
        workspaceId: ctx.workspace._id,
      });
      await db.command({
        collMod: physicalNames.webhook_events,
        validator: { mustNotExist: { $exists: true } },
        validationLevel: "strict",
      });
      try {
        await expect(
          createLink(ctx, { url: "https://example.com/rolled-back" }),
        ).rejects.toThrow();
        await expect(
          updateLink(ctx, existing.value.id, { title: "Lost" }),
        ).rejects.toThrow();
        await expect(deleteLinks(ctx, [existing.value.id])).rejects.toThrow();
        const link = await collection(db, "links").findOne({
          _id: new ObjectId(existing.value.id),
        });
        expect(link?.title).toBe("Kept");
        expect(link?.deletedAt).toBeUndefined();
        expect(
          await collection(db, "links").countDocuments({
            workspaceId: ctx.workspace._id,
          }),
        ).toBe(1);
        expect(
          await webhookOutbox(db).countDocuments({
            workspaceId: ctx.workspace._id,
          }),
        ).toBe(count);
      } finally {
        await db.command({
          collMod: physicalNames.webhook_events,
          validator: {},
        });
      }
    });
    test("fanout checkpoints across 1,001 recipients, concurrent workers and subscription changes", async () => {
      const { ctx, hook } = await fixture("Fanout");
      const template = await endpoints(db).findOne({
        _id: new ObjectId(hook.id),
      });
      if (!template) throw new Error("Endpoint vanished");
      const { _id, ...fields } = template;
      void _id;
      await endpoints(db).insertMany(
        Array.from({ length: 1000 }, () => ({
          ...fields,
          _id: new ObjectId(),
        })),
      );
      await endpoints(db).insertMany([
        { ...fields, _id: new ObjectId(), enabled: false },
        { ...fields, _id: new ObjectId(), events: ["domain.verified"] },
        { ...fields, _id: new ObjectId(), workspaceId: new ObjectId() },
      ]);
      const created = await createLink(ctx, {
        url: "https://example.com/fanout",
      });
      if (!created.ok) throw new Error(created.error);
      const source = await webhookOutbox(db).findOne({
        workspaceId: ctx.workspace._id,
      });
      if (!source) throw new Error("Missing event");
      await endpoints(db).insertOne({
        ...fields,
        _id: new ObjectId(),
        createdAt: new Date(source.createdAt.getTime() + 10000),
      });
      await fanoutWebhookEvents(db, config);
      expect(
        await deliveries(db).countDocuments({ "event.id": source.event.id }),
      ).toBe(100);
      expect(
        (await webhookOutbox(db).findOne({ _id: source._id }))?.completedAt,
      ).toBeUndefined();
      await Promise.all([
        fanoutWebhookEvents(db, config),
        fanoutWebhookEvents(db, config),
      ]);
      for (let i = 0; i < 11; i++) await fanoutWebhookEvents(db, config);
      expect(
        await deliveries(db).countDocuments({ "event.id": source.event.id }),
      ).toBe(1001);
      expect(
        (await webhookOutbox(db).findOne({ _id: source._id }))?.completedAt,
      ).toBeInstanceOf(Date);
      await fanoutWebhookEvents(db, config);
      expect(
        await deliveries(db).countDocuments({ "event.id": source.event.id }),
      ).toBe(1001);
    }, 30000);
    test("quota refusals and unsubscribed workspaces produce no events; concurrent creates respect quota", async () => {
      const { ctx } = await fixture("Quota", false);
      const results = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          createLink(ctx, { url: `https://example.com/quota-${i}` }),
        ),
      );
      expect(results.filter((result) => result.ok)).toHaveLength(5);
      expect(
        results.filter(
          (result) => !result.ok && result.error === "limit_reached",
        ),
      ).toHaveLength(3);
      expect(
        await webhookOutbox(db).countDocuments({
          workspaceId: ctx.workspace._id,
        }),
      ).toBe(5);
      expect(
        await collection(db, "links").countDocuments({
          workspaceId: ctx.workspace._id,
        }),
      ).toBe(5);
      const { ctx: unsubscribed } = await fixture("Unsubscribed");
      await endpoints(db).deleteMany({
        workspaceId: unsubscribed.workspace._id,
      });
      expect(
        (
          await createLink(unsubscribed, {
            url: "https://example.com/unsubscribed",
          })
        ).ok,
      ).toBe(true);
      expect(
        await webhookOutbox(db).countDocuments({
          workspaceId: unsubscribed.workspace._id,
        }),
      ).toBe(0);
    });
    test("publishing a legacy public page establishes its first managed snapshot", async () => {
      const { ctx } = await fixture("Legacy publication");
      const id = new ObjectId();
      await db.collection(physicalNames.bio_pages).insertOne({
        _id: id,
        workspaceId: ctx.workspace._id,
        slug: "legacy-event-publication",
        handle: "legacy-event-publication",
        published: true,
        title: "Legacy",
        links: [],
        theme: {},
      });
      expect((await publishBioDraft(ctx, id.toHexString(), 0)).ok).toBe(true);
      const migrated = await db
        .collection(physicalNames.bio_pages)
        .findOne({ _id: id });
      expect(migrated?.publicationManaged).toBe(true);
      expect(migrated?.publishedContent).toBeDefined();
      expect(
        await db
          .collection(physicalNames.bio_page_versions)
          .countDocuments({ bioPageId: id, revision: 0 }),
      ).toBe(1);
      expect(
        await webhookOutbox(db).countDocuments({
          workspaceId: ctx.workspace._id,
          "event.type": "bio.published",
        }),
      ).toBe(1);
      expect((await publishBioDraft(ctx, id.toHexString(), 0)).ok).toBe(true);
      expect(
        await webhookOutbox(db).countDocuments({
          workspaceId: ctx.workspace._id,
        }),
      ).toBe(1);
    });
    test("bio publication and domain verification emit only their successful transitions", async () => {
      const { ctx } = await fixture("Publication");
      const page = await createBioPage(ctx, { slug: "event-publication" });
      if (!page.ok) throw new Error(page.error);
      const draft = await readBioDraft(ctx, page.value.id);
      if (!draft) throw new Error("Missing draft");
      expect(
        (await saveBioDraft(ctx, page.value.id, 0, draft.content)).ok,
      ).toBe(true);
      expect(await publishBioDraft(ctx, page.value.id, 0)).toMatchObject({
        ok: false,
        error: "conflict",
      });
      await db.command({
        collMod: physicalNames.webhook_events,
        validator: { mustNotExist: { $exists: true } },
      });
      try {
        await expect(publishBioDraft(ctx, page.value.id, 1)).rejects.toThrow();
        expect(
          (
            await db
              .collection(physicalNames.bio_pages)
              .findOne({ _id: new ObjectId(page.value.id) })
          )?.published,
        ).toBe(false);
        expect(
          await db
            .collection(physicalNames.bio_page_versions)
            .countDocuments({ bioPageId: new ObjectId(page.value.id) }),
        ).toBe(0);
      } finally {
        await db.command({
          collMod: physicalNames.webhook_events,
          validator: {},
        });
      }
      expect((await publishBioDraft(ctx, page.value.id, 1)).ok).toBe(true);
      expect((await publishBioDraft(ctx, page.value.id, 1)).ok).toBe(true);
      expect(
        await webhookOutbox(db).countDocuments({
          workspaceId: ctx.workspace._id,
          "event.type": "bio.published",
        }),
      ).toBe(1);
      const now = new Date(),
        domainId = new ObjectId(),
        addon = crypto.randomUUID();
      await db.collection(physicalNames.domain_addons).insertOne({
        workspaceId: ctx.workspace._id,
        polarSubscriptionId: addon,
        status: "active",
      });
      await db.collection(physicalNames.domains).insertOne({
        _id: domainId,
        workspaceId: ctx.workspace._id,
        hostname: "events.example.com",
        kind: "links",
        status: "pending",
        addonSubscriptionId: addon,
        createdAt: now,
        nextAttemptAt: now,
      });
      const provider: DomainProvider = {
        find: async () => ({
          id: "remote",
          status: "active",
          ssl: { status: "active" },
        }),
        add: async () => {
          throw new Error("Unexpected add");
        },
        get: async () => ({
          id: "remote",
          status: "active",
          ssl: { status: "active" },
        }),
        remove: async () => {},
      };
      await db.command({
        collMod: physicalNames.webhook_events,
        validator: { mustNotExist: { $exists: true } },
      });
      try {
        await pollDomains(db, provider, now);
        expect(
          (
            await db
              .collection(physicalNames.domains)
              .findOne({ _id: domainId })
          )?.status,
        ).toBe("pending");
        expect(
          await webhookOutbox(db).countDocuments({
            workspaceId: ctx.workspace._id,
            "event.type": "domain.verified",
          }),
        ).toBe(0);
      } finally {
        await db.command({
          collMod: physicalNames.webhook_events,
          validator: {},
        });
      }
      await pollDomains(db, provider, new Date(now.getTime() + 3600001));
      await pollDomains(db, provider, new Date(now.getTime() + 7200002));
      expect(
        await webhookOutbox(db).countDocuments({
          workspaceId: ctx.workspace._id,
          "event.type": "domain.verified",
        }),
      ).toBe(1);
      expect(
        (await db.collection(physicalNames.domains).findOne({ _id: domainId }))
          ?.status,
      ).toBe("active");
    });
  },
);
