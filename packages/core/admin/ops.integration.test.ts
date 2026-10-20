import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { collection, desiredIndexes, physicalNames } from "@shortn/db";
import { Redis } from "ioredis";
import { MongoClient, ObjectId, type Db } from "mongodb";
import {
  activeDomain,
  pollDomains,
  removeDomain,
  type DomainProvider,
} from "../domains/service";
import {
  createWebhook,
  deliveries,
  testWebhook,
  updateWebhook,
} from "../webhooks/service";
import type { ServiceContext } from "../workspaces/context";
import { ensurePersonalWorkspace } from "../workspaces/service";
import { reverifyDomain, suspendDomain, unsuspendDomain } from "./domains";
import { cancelJob, requeueStuckJob, retryJob } from "./jobs";
import { adminDisableWebhook, adminEnableWebhook } from "./webhooks";

const mongoUrl = process.env.MONGO_TEST_URL;
const redisUrl = process.env.REDIS_TEST_URL;
const config = {
  enabled: true,
  secretKey: "webhook-test-encryption-key-".repeat(3),
};

(mongoUrl && redisUrl ? describe : describe.skip)(
  "staff operations on webhooks, domains and jobs",
  () => {
    let client: MongoClient, db: Db, redis: Redis, ctx: ServiceContext;
    const jobDeps = () => ({ db, cache: redis, linkDomain: "shortn.at" });

    beforeAll(async () => {
      client = await new MongoClient(mongoUrl!).connect();
      db = client.db(
        `shortn_admin_ops_${crypto.randomUUID().replaceAll("-", "")}`,
      );
      redis = new Redis(redisUrl!);
      for (const name of [
        physicalNames.webhook_endpoints,
        physicalNames.webhook_deliveries,
      ])
        await db.collection(name).createIndexes(desiredIndexes[name]!);
      const userId = new ObjectId().toHexString();
      const workspace = await ensurePersonalWorkspace(db, {
        id: userId,
        name: "Ops",
      });
      workspace.platformFeatures = { webhooks: true };
      await collection(db, "workspaces").updateOne(
        { _id: workspace._id },
        { $set: { platformFeatures: workspace.platformFeatures } },
      );
      await db.collection(physicalNames.subscriptions).insertOne({
        workspaceId: workspace._id,
        status: "active",
        plan: "pro",
        polarSubscriptionId: "pro",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 86_400_000),
      });
      await db.collection(physicalNames.domain_addons).insertOne({
        workspaceId: workspace._id,
        polarSubscriptionId: "addon",
        status: "active",
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

    test("an admin-disabled webhook stays off until staff lift it", async () => {
      const created = await createWebhook(
        ctx,
        {
          name: "Receiver",
          url: "https://receiver.example/hook",
          events: ["link.created"],
        },
        config,
      );
      if (!created.ok) throw new Error(created.error);
      const id = new ObjectId(created.value.id);
      const queued = await testWebhook(ctx, created.value.id, config);
      if (!queued.ok) throw new Error(queued.error);
      expect(
        await adminDisableWebhook({ db }, id, {
          by: "staff",
          reason: "Sends to a phishing collector",
        }),
      ).toMatchObject({ ok: true, value: { cancelledDeliveries: 1 } });
      expect(
        (await deliveries(db).findOne({ _id: new ObjectId(queued.value.id) }))
          ?.status,
      ).toBe("cancelled");
      expect(
        await updateWebhook(ctx, created.value.id, { enabled: true }, config),
      ).toMatchObject({ ok: false, error: "admin_disabled" });
      const renamed = await updateWebhook(
        ctx,
        created.value.id,
        { name: "Renamed" },
        config,
      );
      expect(renamed).toMatchObject({
        ok: true,
        value: {
          enabled: false,
          adminDisabled: { reason: "Sends to a phishing collector" },
        },
      });
      expect((await adminEnableWebhook({ db }, id)).ok).toBe(true);
      expect(
        await updateWebhook(ctx, created.value.id, { enabled: true }, config),
      ).toMatchObject({
        ok: true,
        value: { enabled: true, adminDisabled: null },
      });
    });

    test("a suspended domain stops serving, survives an in-flight poll and can't be removed", async () => {
      const _id = new ObjectId();
      await db.collection(physicalNames.domains).insertOne({
        _id,
        workspaceId: ctx.workspace._id,
        hostname: "go.ops.example",
        kind: "links",
        status: "pending",
        hostnameStatus: "pending",
        sslStatus: "pending",
        addonSubscriptionId: "addon",
        verification: { type: "cname" },
        createdAt: new Date(),
        nextAttemptAt: new Date(0),
      });
      const remote = {
        id: "cf-ops",
        status: "active",
        ssl: { status: "active" },
      };
      // Staff suspend while this poll holds the lease and waits on Cloudflare.
      const provider: DomainProvider = {
        find: async () => {
          await suspendDomain({ db }, _id, { by: "staff", reason: "abuse" });
          return remote;
        },
        add: async () => remote,
        get: async () => remote,
        remove: async () => {},
      };
      await pollDomains(db, provider);
      const domain = await collection(db, "domains").findOne({ _id });
      expect(domain).toMatchObject({
        status: "suspended",
        suspension: { reason: "abuse", previousStatus: "pending" },
      });
      expect(await activeDomain(db, "go.ops.example")).toBeNull();
      expect(await removeDomain(ctx, String(_id))).toMatchObject({
        ok: false,
        error: "domain_suspended",
      });
      expect(await reverifyDomain({ db }, _id)).toMatchObject({
        ok: false,
        error: "not_found",
      });
      const now = new Date();
      expect((await unsuspendDomain({ db, now: () => now }, _id)).ok).toBe(
        true,
      );
      expect(await collection(db, "domains").findOne({ _id })).toMatchObject({
        status: "pending",
        nextAttemptAt: now,
      });
      expect((await reverifyDomain({ db }, _id)).ok).toBe(true);
    });

    test("job retry, cancel and stuck-lease requeue follow each state machine", async () => {
      const exports = db.collection(physicalNames.export_jobs);
      const now = new Date();
      const deps = { ...jobDeps(), now: () => now };
      const failed = new ObjectId(),
        pending = new ObjectId(),
        stuck = new ObjectId(),
        busy = new ObjectId();
      await exports.insertMany([
        { _id: failed, state: "failed", attempts: 5, error: "boom" },
        { _id: pending, state: "pending", attempts: 0 },
        {
          _id: stuck,
          state: "running",
          leaseToken: "old",
          leaseUntil: new Date(now.getTime() - 10 * 60_000),
        },
        {
          _id: busy,
          state: "running",
          leaseToken: "live",
          leaseUntil: new Date(now.getTime() + 60_000),
        },
      ]);
      expect((await retryJob(deps, "export", String(failed))).ok).toBe(true);
      expect(await exports.findOne({ _id: failed })).toMatchObject({
        state: "pending",
        attempts: 0,
        nextAttemptAt: now,
      });
      expect((await exports.findOne({ _id: failed }))?.error).toBeUndefined();
      expect(await retryJob(deps, "export", String(pending))).toMatchObject({
        ok: false,
        error: "not_failed",
      });
      expect(
        (await cancelJob(deps, "export", String(pending), "staff")).ok,
      ).toBe(true);
      expect((await exports.findOne({ _id: pending }))?.state).toBe(
        "cancelled",
      );
      expect((await requeueStuckJob(deps, "export", String(stuck))).ok).toBe(
        true,
      );
      const requeued = await exports.findOne({ _id: stuck });
      expect(requeued).toMatchObject({ state: "pending", nextAttemptAt: now });
      expect(requeued?.leaseToken).toBeUndefined();
      expect(await requeueStuckJob(deps, "export", String(busy))).toMatchObject(
        { ok: false, error: "not_stuck" },
      );
      expect(await retryJob(deps, "import", String(failed))).toMatchObject({
        ok: false,
        error: "not_retryable",
      });
      expect(
        await cancelJob(deps, "qr_zip", String(failed), "staff"),
      ).toMatchObject({ ok: false, error: "not_cancellable" });

      await collection(db, "billing_events").insertOne({
        _id: "evt_1",
        type: "subscription.updated",
        subscriptionIds: [],
        receivedAt: now,
        attempts: 10,
        error: "dead",
        lockedUntil: new Date(now.getTime() + 60_000),
      });
      expect((await retryJob(deps, "billing_event", "evt_1")).ok).toBe(true);
      const event = await collection(db, "billing_events").findOne({
        _id: "evt_1",
      });
      expect(event?.attempts).toBe(0);
      expect(event?.lockedUntil).toBeUndefined();
    });

    test("staff cancel an import through the owner path, releasing its quota", async () => {
      const _id = new ObjectId();
      await db.collection(physicalNames.import_jobs).insertOne({
        _id,
        workspaceId: ctx.workspace._id,
        createdBy: ctx.actor.userId,
        kind: "links",
        state: "validating",
        leaseToken: "gone",
        leaseUntil: new Date(Date.now() - 10 * 60_000),
        expiresAt: new Date(Date.now() + 86_400_000),
        valid: 0,
        done: 0,
      });
      await db.collection(physicalNames.import_reservations).insertOne({
        _id,
        workspaceId: ctx.workspace._id,
        state: "active",
        remaining: 5,
      });
      expect((await requeueStuckJob(jobDeps(), "import", String(_id))).ok).toBe(
        true,
      );
      expect(
        (await db.collection(physicalNames.import_jobs).findOne({ _id }))
          ?.state,
      ).toBe("validate_pending");
      expect(
        (await cancelJob(jobDeps(), "import", String(_id), "staff")).ok,
      ).toBe(true);
      expect(
        (await db.collection(physicalNames.import_jobs).findOne({ _id }))
          ?.state,
      ).toBe("cancelled");
      expect(
        await db.collection(physicalNames.import_reservations).findOne({ _id }),
      ).toMatchObject({ state: "released", remaining: 0 });
    });
  },
);
