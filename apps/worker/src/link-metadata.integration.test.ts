import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import Redis from "ioredis";
import { collection, physicalNames } from "@shortn/db";
import {
  ensurePersonalWorkspace,
  ensureLinkMetadataIndexes,
  linkMetadataJobs,
  requestLinkMetadata,
  readLinkMetadata,
  suggestAvailableLinkKey,
  type ServiceContext,
} from "@shortn/core";
import { runLinkMetadataBatch } from "./link-metadata";
const mongo = process.env.MONGO_TEST_URL,
  durableUrl = process.env.REDIS_DURABLE_TEST_URL;
(mongo && durableUrl ? describe : describe.skip)(
  "actor-bound creation metadata jobs",
  () => {
    let client: MongoClient, db: Db, durable: Redis;
    const rateKeys: string[] = [];
    beforeAll(async () => {
      if (
        ![mongo, durableUrl].every((value) =>
          ["localhost", "127.0.0.1"].includes(new URL(value!).hostname),
        )
      )
        throw new Error("Loopback services required");
      client = await new MongoClient(mongo!).connect();
      db = client.db(
        `shortn_metadata_${crypto.randomUUID().replaceAll("-", "")}`,
      );
      durable = new Redis(durableUrl!);
      await ensureLinkMetadataIndexes(db);
    });
    afterAll(async () => {
      if (rateKeys.length) await durable.del(...rateKeys);
      await db?.dropDatabase();
      await client?.close();
      durable?.disconnect();
    });
    async function fixture(paid = true) {
      const userId = new ObjectId().toHexString(),
        workspace = await ensurePersonalWorkspace(db, {
          id: userId,
          sub: `metadata|${userId}`,
          name: "Synthetic metadata",
        });
      const ctx: ServiceContext = {
        db,
        cache: durable,
        workspace,
        actor: { userId, role: "owner" },
        linkDomain: `${workspace._id}.invalid`,
      };
      rateKeys.push(`links:metadata-rate:${workspace._id}:${userId}`);
      if (paid)
        await db
          .collection(physicalNames.subscriptions)
          .insertOne({
            workspaceId: workspace._id,
            polarSubscriptionId: crypto.randomUUID(),
            status: "active",
            plan: "pro",
            currentPeriodStart: new Date(Date.now() - 86400000),
            currentPeriodEnd: new Date(Date.now() + 86400000 * 29),
            cancelAtPeriodEnd: false,
          });
      return ctx;
    }
    test("requests deduplicate per URL/actor/workspace, stay bounded and return only a safe title/key result", async () => {
      const ctx = await fixture(),
        requested = await requestLinkMetadata(
          ctx,
          durable,
          "https://example.com/page#fragment",
        );
      if (!requested.ok) throw new Error(requested.error);
      expect(
        await requestLinkMetadata(
          ctx,
          durable,
          "https://example.com/page#other",
        ),
      ).toEqual(requested);
      expect(await readLinkMetadata(ctx, requested.value.id)).toEqual({
        ok: true,
        value: { state: "pending" },
      });
      expect(
        await linkMetadataJobs(db).countDocuments({
          workspaceId: ctx.workspace._id,
        }),
      ).toBe(1);
      await runLinkMetadataBatch(db, async (url) => {
        expect(url).toBe("https://example.com/page");
        return "Café Launch";
      });
      expect(await readLinkMetadata(ctx, requested.value.id)).toEqual({
        ok: true,
        value: { state: "ready", title: "Café Launch", key: "cafe-launch" },
      });
      const other = await fixture();
      expect(await readLinkMetadata(other, requested.value.id)).toEqual({
        ok: false,
        error: "not_found",
      });
      const secondId = new ObjectId().toHexString();
      await collection(db, "workspace_members").insertOne({
        _id: new ObjectId(),
        workspaceId: ctx.workspace._id,
        userId: secondId,
        role: "member",
        createdAt: new Date(),
      });
      expect(
        await readLinkMetadata(
          { ...ctx, actor: { userId: secondId, role: "member" } },
          requested.value.id,
        ),
      ).toEqual({ ok: false, error: "not_found" });
      const indexes = await linkMetadataJobs(db).indexes();
      expect(
        indexes.find((index) => index.name === "metadata_expiry")
          ?.expireAfterSeconds,
      ).toBe(0);
    });
    test("current membership is checked before network work and again before publishing", async () => {
      const ctx = await fixture(),
        requested = await requestLinkMetadata(
          ctx,
          durable,
          "https://example.com/role",
        );
      if (!requested.ok) throw new Error(requested.error);
      await collection(db, "workspace_members").updateOne(
        { workspaceId: ctx.workspace._id, userId: ctx.actor.userId },
        { $set: { role: "viewer" } },
      );
      let calls = 0;
      await runLinkMetadataBatch(db, async () => {
        calls++;
        return "Private?";
      });
      expect(calls).toBe(0);
      expect(await readLinkMetadata(ctx, requested.value.id)).toEqual({
        ok: false,
        error: "forbidden",
      });
      expect(
        await requestLinkMetadata(ctx, durable, "https://example.com/other"),
      ).toEqual({ ok: false, error: "forbidden" });
      const allowed = await fixture(),
        job = await requestLinkMetadata(
          allowed,
          durable,
          "https://example.com/revoke-during-fetch",
        );
      if (!job.ok) throw new Error(job.error);
      await runLinkMetadataBatch(db, async () => {
        await collection(db, "workspace_members").deleteOne({
          workspaceId: allowed.workspace._id,
          userId: allowed.actor.userId,
        });
        return "Do not publish";
      });
      const stored = await linkMetadataJobs(db).findOne({
        _id: new ObjectId(job.value.id),
      });
      expect(stored?.state).toBe("unavailable");
      expect(stored?.title).toBeUndefined();
    });
    test("ten distinct lookups/minute, invalid destinations and Redis failure cannot create unbounded jobs", async () => {
      const ctx = await fixture();
      for (const input of [
        "javascript:alert(1)",
        "http://127.0.0.1",
        "https://a:b@example.com",
        "x".repeat(2049),
        null,
      ])
        expect((await requestLinkMetadata(ctx, durable, input)).ok).toBe(false);
      for (let index = 0; index < 10; index++)
        expect(
          (
            await requestLinkMetadata(
              ctx,
              durable,
              `https://example.com/${index}`,
            )
          ).ok,
        ).toBe(true);
      expect(
        await requestLinkMetadata(
          ctx,
          durable,
          "https://example.com/over-limit",
        ),
      ).toEqual({ ok: false, error: "rate_limited" });
      expect(
        await linkMetadataJobs(db).countDocuments({
          workspaceId: ctx.workspace._id,
        }),
      ).toBe(10);
      expect(
        (await requestLinkMetadata(ctx, durable, "https://example.com/0")).ok,
      ).toBe(true);
      const broken = {
        eval: async () => {
          throw new Error("unavailable");
        },
      } as unknown as Pick<Redis, "eval">;
      expect(
        await requestLinkMetadata(
          await fixture(),
          broken,
          "https://example.com",
        ),
      ).toEqual({ ok: false, error: "unavailable" });
      // Finish only this test's pending fixtures before later lease assertions.
      await linkMetadataJobs(db).updateMany(
        { workspaceId: ctx.workspace._id },
        { $set: { state: "unavailable" } },
      );
    });
    test("expired jobs are hidden; crashed leases retry and stale completions cannot overwrite newer results", async () => {
      const ctx = await fixture(),
        result = await requestLinkMetadata(
          ctx,
          durable,
          "https://example.com/lease",
        );
      if (!result.ok) throw new Error(result.error);
      const id = new ObjectId(result.value.id);
      await linkMetadataJobs(db).updateOne(
        { _id: id },
        {
          $set: {
            state: "running",
            leaseUntil: new Date(0),
            leaseToken: "dead",
          },
        },
      );
      let release!: () => void;
      const paused = new Promise<void>((resolve) => {
        release = resolve;
      });
      let entered!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const first = runLinkMetadataBatch(db, async () => {
        entered();
        await paused;
        return "Stale title";
      });
      await started;
      await linkMetadataJobs(db).updateOne(
        { _id: id },
        { $set: { leaseUntil: new Date(0) } },
      );
      await runLinkMetadataBatch(db, async () => "Fresh title");
      release();
      await first;
      expect((await linkMetadataJobs(db).findOne({ _id: id }))?.title).toBe(
        "Fresh title",
      );
      await linkMetadataJobs(db).updateOne(
        { _id: id },
        { $set: { expiresAt: new Date(0) } },
      );
      expect(await readLinkMetadata(ctx, result.value.id)).toEqual({
        ok: false,
        error: "not_found",
      });
    });
    test("free-plan titles work without custom keys; suggestions honor reserved keys and global legacy/alias/trash collisions", async () => {
      const free = await fixture(false),
        job = await requestLinkMetadata(
          free,
          durable,
          "https://example.com/free",
        );
      if (!job.ok) throw new Error(job.error);
      await runLinkMetadataBatch(db, async () => "Free title");
      expect(await readLinkMetadata(free, job.value.id)).toEqual({
        ok: true,
        value: { state: "ready", title: "Free title", key: null },
      });
      const ctx = await fixture();
      for (const link of [
        { urlCode: "launch", sub: "foreign" },
        {
          domain: ctx.linkDomain,
          previousKeys: ["alias"],
          deletedAt: new Date(),
        },
        { domain: ctx.linkDomain, key: "trashed", deletedAt: new Date() },
      ])
        await db.collection(physicalNames.links).insertOne(link);
      expect(
        await suggestAvailableLinkKey(ctx, "https://example.com/launch"),
      ).toMatch(/^launch-[a-zA-Z0-9]+$/);
      expect(
        await suggestAvailableLinkKey(ctx, "https://example.com/alias"),
      ).toMatch(/^alias-[a-zA-Z0-9]+$/);
      expect(
        await suggestAvailableLinkKey(ctx, "https://example.com/trashed"),
      ).toMatch(/^trashed-[a-zA-Z0-9]+$/);
      expect(
        await suggestAvailableLinkKey(ctx, "https://example.com/api"),
      ).not.toBe("api");
      expect(
        await suggestAvailableLinkKey(
          ctx,
          "https://example.com/",
          "São João — Release",
        ),
      ).toBe("sao-joao-release");
      expect(
        await suggestAvailableLinkKey(
          { ...ctx, actor: { ...ctx.actor, role: "viewer" } },
          "https://example.com/a",
        ),
      ).toBeNull();
    });
    test("optional fetch failure is retryable without another job or any link mutation", async () => {
      const ctx = await fixture(),
        requested = await requestLinkMetadata(
          ctx,
          durable,
          "https://example.com/retry",
        );
      if (!requested.ok) throw new Error(requested.error);
      await runLinkMetadataBatch(db, async () => {
        throw new Error("transient");
      });
      const failed = await readLinkMetadata(ctx, requested.value.id);
      expect(failed.ok && failed.value.state).toBe("unavailable");
      expect(
        await requestLinkMetadata(ctx, durable, "https://example.com/retry"),
      ).toEqual(requested);
      await runLinkMetadataBatch(db, async () => "Recovered");
      const recovered = await readLinkMetadata(ctx, requested.value.id);
      expect(
        recovered.ok && "title" in recovered.value && recovered.value.title,
      ).toBe("Recovered");
      expect(
        await linkMetadataJobs(db).countDocuments({
          workspaceId: ctx.workspace._id,
        }),
      ).toBe(1);
      expect(
        await collection(db, "links").countDocuments({
          workspaceId: ctx.workspace._id,
        }),
      ).toBe(0);
    });
  },
);
