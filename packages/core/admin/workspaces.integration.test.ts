import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  collection,
  legacyCollectionKeys,
  physicalNames,
  syncIndexes,
} from "@shortn/db";
import {
  parseWorkspaceSuspension,
  workspaceSuspensionChannel,
  type WorkspaceSuspensionMessage,
} from "@shortn/redis";
import { Redis } from "ioredis";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { activeDomain } from "../domains/service";
import { createBioPage } from "../bio/service";
import { publishBioDraft, resolveBioDocument } from "../bio/publishing";
import { createLink } from "../links/service";
import { publicLink } from "../links/public";
import { can } from "../workspaces/authz";
import type { ServiceContext } from "../workspaces/context";
import {
  ensurePersonalWorkspace,
  workspaceContext,
} from "../workspaces/service";
import { setWorkspaceSuspension, type WorkspaceSuspension } from "./workspaces";

const mongoUrl = process.env.MONGO_TEST_URL;
const redisUrl = process.env.REDIS_TEST_URL;

(mongoUrl && redisUrl ? describe : describe.skip)(
  "workspace lock and suspension",
  () => {
    let client: MongoClient, db: Db, redis: Redis, subscriber: Redis;
    let ctx: ServiceContext, userId: string, linkKey: string;
    const messages: WorkspaceSuspensionMessage[] = [];
    const suspension = (
      level: WorkspaceSuspension["level"],
    ): WorkspaceSuspension => ({
      level,
      category: level === "locked" ? "nonpayment" : "phishing",
      internalNote: "integration",
      by: "staff",
      at: new Date(),
    });
    const deps = () => ({ db, cache: redis });
    const context = async () =>
      (await workspaceContext(db, userId, ctx.workspace.slug))!;

    beforeAll(async () => {
      client = await new MongoClient(mongoUrl!).connect();
      db = client.db(
        `shortn_admin_ws_${crypto.randomUUID().replaceAll("-", "")}`,
      );
      redis = new Redis(redisUrl!);
      subscriber = new Redis(redisUrl!);
      subscriber.on("message", (channel, payload) => {
        const message =
          channel === workspaceSuspensionChannel
            ? parseWorkspaceSuspension(payload)
            : null;
        if (message) messages.push(message);
      });
      await subscriber.subscribe(workspaceSuspensionChannel);
      for (const key of legacyCollectionKeys)
        await db.createCollection(physicalNames[key]);
      await syncIndexes(db, { log: () => {} });
      userId = new ObjectId().toHexString();
      const workspace = await ensurePersonalWorkspace(db, {
        id: userId,
        name: "Suspended",
        email: "suspended@example.com",
      });
      ctx = {
        db,
        workspace,
        actor: { userId, role: "owner" },
        cache: redis,
        linkDomain: "shortn.at",
      };
      const link = await createLink(ctx, { url: "https://example.com/a" });
      if (!link.ok) throw new Error(link.error);
      linkKey = link.value.key;
      const page = await createBioPage(ctx, { slug: "suspend-bio" });
      if (!page.ok) throw new Error(page.error);
      expect((await publishBioDraft(ctx, page.value.id, 0)).ok).toBe(true);
      await db.collection(physicalNames.bio_delivery_jobs).deleteMany({});
      await db.collection(physicalNames.subscriptions).insertOne({
        workspaceId: workspace._id,
        status: "active",
        plan: "pro",
        polarSubscriptionId: "plan",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 86_400_000),
      });
      await db.collection(physicalNames.domain_addons).insertOne({
        workspaceId: workspace._id,
        polarSubscriptionId: "addon",
        status: "active",
      });
      await db.collection(physicalNames.domains).insertOne({
        workspaceId: workspace._id,
        hostname: "go.suspend.example",
        kind: "links",
        status: "active",
        hostnameStatus: "active",
        sslStatus: "active",
        addonSubscriptionId: "addon",
        verification: { type: "cname" },
      });
    }, 30_000);
    afterAll(async () => {
      await db?.dropDatabase();
      await client?.close();
      subscriber?.disconnect();
      redis?.disconnect();
    });

    test("a lock makes the actor read-only but keeps reads, billing and delivery", async () => {
      const result = await setWorkspaceSuspension(
        deps(),
        ctx.workspace._id,
        suspension("locked"),
      );
      expect(result.ok).toBe(true);
      const locked = await context();
      expect(locked.actor.readOnly).toBe("locked");
      expect(can(locked.actor, "workspace.view")).toBe(true);
      expect(can(locked.actor, "billing.manage")).toBe(true);
      for (const action of [
        "resource.create",
        "resource.update",
        "resource.delete",
        "members.manage",
        "workspace.delete",
      ] as const)
        expect(can(locked.actor, action)).toBe(false);
      expect(
        await createLink(
          { ...ctx, ...locked },
          { url: "https://example.com/b" },
        ),
      ).toMatchObject({ ok: false, error: "forbidden" });
      expect((await publicLink(db, linkKey))?.blocked).toBe(false);
      expect(await resolveBioDocument(db, "suspend-bio")).not.toBeNull();
      expect(await activeDomain(db, "go.suspend.example")).not.toBeNull();
      // Lock doesn't change delivery, so the redirect isn't told about it.
      expect(messages).toHaveLength(0);
    });

    test("suspension stops links, bio pages and custom domains; restore brings them back", async () => {
      await setWorkspaceSuspension(
        deps(),
        ctx.workspace._id,
        suspension("suspended"),
      );
      expect((await context()).actor.readOnly).toBe("suspended");
      const blocked = await publicLink(db, linkKey);
      expect(blocked).toMatchObject({
        blocked: true,
        disabledReason: "workspace:suspended",
        destination: "",
      });
      expect(await resolveBioDocument(db, "suspend-bio")).toBeNull();
      expect(await activeDomain(db, "go.suspend.example")).toBeNull();
      expect(
        await db.collection(physicalNames.bio_delivery_jobs).countDocuments(),
      ).toBe(1);
      // The link document itself is untouched.
      expect(
        await collection(db, "links").findOne({ key: linkKey }),
      ).toMatchObject({ disabled: false });

      await setWorkspaceSuspension(deps(), ctx.workspace._id, null);
      expect((await context()).actor.readOnly).toBeUndefined();
      expect((await publicLink(db, linkKey))?.blocked).toBe(false);
      expect(await resolveBioDocument(db, "suspend-bio")).not.toBeNull();
      expect(await activeDomain(db, "go.suspend.example")).not.toBeNull();
      await Bun.sleep(100);
      expect(messages).toEqual([
        { workspaceId: ctx.workspace._id.toHexString(), suspended: true },
        { workspaceId: ctx.workspace._id.toHexString(), suspended: false },
      ]);
    });

    test("invalid input and unknown workspaces are refused", async () => {
      expect(
        await setWorkspaceSuspension(deps(), ctx.workspace._id, {
          ...suspension("suspended"),
          internalNote: "x".repeat(2001),
        }),
      ).toMatchObject({ ok: false, error: "invalid_input" });
      expect(
        await setWorkspaceSuspension(
          deps(),
          new ObjectId(),
          suspension("locked"),
        ),
      ).toMatchObject({ ok: false, error: "not_found" });
    });
  },
);
