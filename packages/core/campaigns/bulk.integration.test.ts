import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { Redis } from "ioredis";
import { desiredIndexes, physicalNames, deriveLinkUtm } from "@shortn/db";
import { keys } from "@shortn/redis";
import {
  moveLinksToCampaign,
  setLinkUtm,
  updateCampaign,
  deleteCampaign,
} from "./service";
import { mongoLinkLoader } from "../links/loader";
import { ensurePersonalWorkspace } from "../workspaces/service";
import type { ServiceContext } from "../workspaces/context";
const mongo = process.env.MONGO_TEST_URL,
  cache = process.env.REDIS_TEST_URL;
(mongo && cache ? describe : describe.skip)(
  "atomic bulk campaign moves",
  () => {
    let client: MongoClient, db: Db, redis: Redis;
    const domains: string[] = [];
    beforeAll(async () => {
      if (
        ![mongo, cache].every((url) =>
          ["localhost", "127.0.0.1"].includes(new URL(url!).hostname),
        )
      )
        throw new Error("Loopback services required");
      client = await new MongoClient(mongo!).connect();
      db = client.db(
        `shortn_bulk_campaign_${crypto.randomUUID().replaceAll("-", "")}`,
      );
      redis = new Redis(cache!);
      for (const name of [
        physicalNames.links,
        physicalNames.campaigns,
        physicalNames.webhook_events,
      ])
        await db.collection(name).createIndexes(desiredIndexes[name]!);
    });
    afterAll(async () => {
      for (const domain of domains) {
        let cursor = "0";
        do {
          const [next, found] = await redis.scan(
            cursor,
            "MATCH",
            `*${domain}*`,
            "COUNT",
            1000,
          );
          cursor = next;
          if (found.length) await redis.unlink(...found);
        } while (cursor !== "0");
      }
      await db?.dropDatabase();
      await client?.close();
      redis?.disconnect();
    });
    async function fixture(count = 2, paid = true) {
      const userId = new ObjectId().toHexString(),
        workspace = await ensurePersonalWorkspace(db, {
          id: userId,
          name: "Synthetic campaigns",
          sub: `bulk|${userId}`,
        });
      const domain = `${workspace._id}.invalid`;
      domains.push(domain);
      const ctx: ServiceContext = {
        db,
        cache: redis,
        workspace,
        actor: { userId, role: "owner" },
        linkDomain: domain,
      };
      if (paid)
        await db.collection(physicalNames.subscriptions).insertOne({
          workspaceId: workspace._id,
          polarSubscriptionId: crypto.randomUUID(),
          status: "active",
          plan: "pro",
          currentPeriodStart: new Date(Date.now() - 86400000),
          currentPeriodEnd: new Date(Date.now() + 29 * 86400000),
          cancelAtPeriodEnd: false,
        });
      const old = {
          _id: new ObjectId(),
          workspaceId: workspace._id,
          title: "Old campaign",
          links: [] as ObjectId[],
        },
        target = {
          _id: new ObjectId(),
          workspaceId: workspace._id,
          title: "New campaign",
          links: [] as ObjectId[],
          utmDefaults: { sources: ["DO_NOT_APPLY_DEFAULT"] },
        };
      const rows = Array.from({ length: count }, (_, i) => ({
        _id: new ObjectId(),
        workspaceId: workspace._id,
        domain,
        urlCode: `${workspace._id}-${i}`,
        longUrl: `https://example.com/${i}`,
        title: `Link ${i}`,
        previousKeys: [`old-${workspace._id}-${i}`],
        utmLinks: [
          {
            source: "Newsletter",
            medium: "Email",
            term: "A",
            content: "B",
            campaign: { _id: old._id, title: old.title },
          },
          {
            source: "Social",
            campaign: { title: "Legacy title-only campaign" },
          },
        ],
        tags: [{ tagName: "Keep" }],
        passwordHash: "PRIVATE",
        rules: { forwardQuery: true, utm: { source: "Authored rule" } },
        _sync: { rev: 1 },
      }));
      old.links = rows.map((row) => row._id);
      await db.collection(physicalNames.links).insertMany(rows);
      await db.collection(physicalNames.campaigns).insertMany([old, target]);
      return {
        ctx,
        rows,
        ids: rows.map((row) => row._id.toHexString()),
        old,
        target,
        campaignId: String(target._id),
      };
    }
    test("moves all variants, preserves values and fields, repairs backlinks, canonical data and alias caches", async () => {
      const { ctx, rows, ids, old, target, campaignId } = await fixture();
      const cacheKeys = rows.flatMap((row) => [
        keys.link(ctx.linkDomain, row.urlCode),
        keys.link(ctx.linkDomain, row.previousKeys[0]!),
      ]);
      for (const key of cacheKeys) await redis.set(key, "old", "EX", 60);
      const result = await moveLinksToCampaign(
        ctx,
        [...ids, ids[0]!],
        campaignId,
      );
      expect(result).toEqual({
        ok: true,
        value: {
          selected: 2,
          updated: 2,
          campaign: { id: campaignId, title: target.title },
        },
      });
      const first = (await db
        .collection(physicalNames.links)
        .findOne({ _id: rows[0]!._id }))!;
      expect(first.utmLinks).toEqual(
        rows[0]!.utmLinks.map((variant) => ({
          ...variant,
          campaign: { _id: target._id, title: target.title },
        })),
      );
      expect(first.passwordHash).toBe("PRIVATE");
      expect(first.rules).toEqual(rows[0]!.rules);
      expect(first.tags).toEqual(rows[0]!.tags);
      expect(first.utmVariants).toEqual(deriveLinkUtm(first).variants);
      expect(first._sync.utmHash).toBe(deriveLinkUtm(first).hash);
      expect(
        (await db
          .collection(physicalNames.campaigns)
          .findOne({ _id: old._id }))!.links,
      ).toEqual([]);
      expect(
        (await db
          .collection(physicalNames.campaigns)
          .findOne({ _id: target._id }))!.links
          .map(String)
          .sort(),
      ).toEqual(ids.sort());
      expect(await redis.exists(...cacheKeys)).toBe(0);
      // Idempotent retry must still invalidate caches after a post-commit Redis outage.
      for (const key of cacheKeys) await redis.set(key, "old-again", "EX", 60);
      expect(await moveLinksToCampaign(ctx, ids, campaignId)).toEqual({
        ok: true,
        value: {
          selected: 2,
          updated: 0,
          campaign: { id: campaignId, title: target.title },
        },
      });
      expect(await redis.exists(...cacheKeys)).toBe(0);
      expect(
        (await db
          .collection(physicalNames.links)
          .findOne({ _id: rows[0]!._id }))!._sync.rev,
      ).toBe(2);
    });
    test("stale/foreign/hidden/QR rows and foreign target refuse before any link or membership changes", async () => {
      const { ctx, rows, ids, old, target, campaignId } = await fixture(),
        foreign = await fixture(1);
      for (const invalidIds of [
        [...ids, foreign.ids[0]!],
        [...ids, String(new ObjectId())],
      ])
        expect(await moveLinksToCampaign(ctx, invalidIds, campaignId)).toEqual({
          ok: false,
          error: "not_found",
        });
      expect(await moveLinksToCampaign(ctx, ids, foreign.campaignId)).toEqual({
        ok: false,
        error: "not_found",
      });
      for (const field of ["deletedAt", "hidden", "isQrCode"]) {
        await db
          .collection(physicalNames.links)
          .updateOne(
            { _id: rows[1]!._id },
            { $set: { [field]: field === "deletedAt" ? new Date() : true } },
          );
        expect((await moveLinksToCampaign(ctx, ids, campaignId)).ok).toBe(
          false,
        );
        await db
          .collection(physicalNames.links)
          .updateOne({ _id: rows[1]!._id }, { $unset: { [field]: "" } });
      }
      expect(
        (await db
          .collection(physicalNames.links)
          .findOne({ _id: rows[0]!._id }))!._sync.rev,
      ).toBe(1);
      expect(
        (await db
          .collection(physicalNames.campaigns)
          .findOne({ _id: old._id }))!.links,
      ).toHaveLength(2);
      expect(
        (await db
          .collection(physicalNames.campaigns)
          .findOne({ _id: target._id }))!.links,
      ).toEqual([]);
    });
    test("paid gate, viewer refusal, metadata bounds and legacy ownership", async () => {
      const free = await fixture(1, false);
      expect(
        await moveLinksToCampaign(free.ctx, free.ids, free.campaignId),
      ).toEqual({
        ok: false,
        error: "feature_required",
        detail: { feature: "campaigns" },
      });
      const { ctx, rows, ids, campaignId } = await fixture(1);
      expect(
        await moveLinksToCampaign(
          { ...ctx, actor: { ...ctx.actor, role: "viewer" } },
          ids,
          campaignId,
        ),
      ).toEqual({ ok: false, error: "forbidden" });
      for (const invalid of [[], Array(501).fill(ids[0]), ["bad"]])
        expect(await moveLinksToCampaign(ctx, invalid, campaignId)).toEqual({
          ok: false,
          error: "invalid_input",
        });
      await db.collection(physicalNames.links).updateOne(
        { _id: rows[0]!._id },
        {
          $unset: { workspaceId: "", utmLinks: "" },
          $set: { sub: ctx.workspace.legacySub },
        },
      );
      expect((await moveLinksToCampaign(ctx, ids, campaignId)).ok).toBe(true);
      expect(
        (await db
          .collection(physicalNames.links)
          .findOne({ _id: rows[0]!._id }))!.utmLinks,
      ).toHaveLength(1);
    });
    test("500 moves in 5001 rows emit exactly one event each; retries leave remaining library and event count unchanged", async () => {
      const { ctx, rows, ids, campaignId, target } = await fixture(5001);
      await db.collection(physicalNames.webhook_endpoints).insertOne({
        workspaceId: ctx.workspace._id,
        enabled: true,
        events: ["link.updated"],
      });
      const result = await moveLinksToCampaign(
        ctx,
        ids.slice(0, 500),
        campaignId,
      );
      expect(result.ok && result.value.updated).toBe(500);
      expect(
        await db.collection(physicalNames.links).countDocuments({
          workspaceId: ctx.workspace._id,
          "utmLinks.campaign._id": target._id,
        }),
      ).toBe(500);
      const events = await db
        .collection(physicalNames.webhook_events)
        .find({ workspaceId: ctx.workspace._id })
        .toArray();
      expect(events).toHaveLength(500);
      expect(JSON.stringify(events).includes("PRIVATE")).toBe(false);
      expect(
        (await moveLinksToCampaign(ctx, ids.slice(0, 500), campaignId)).ok,
      ).toBe(true);
      expect(
        await db
          .collection(physicalNames.webhook_events)
          .countDocuments({ workspaceId: ctx.workspace._id }),
      ).toBe(500);
      expect(
        (await db
          .collection(physicalNames.links)
          .findOne({ _id: rows[500]!._id }))!._sync.rev,
      ).toBe(1);
    }, 30_000);
    test("concurrent moves serialize complete membership and existing single-link rename/delete writers keep canonical UTM current", async () => {
      const { ctx, rows, ids, target, campaignId } = await fixture(20),
        second = {
          _id: new ObjectId(),
          workspaceId: ctx.workspace._id,
          title: "Other target",
          links: [],
        };
      await db.collection(physicalNames.campaigns).insertOne(second);
      expect(
        (
          await Promise.all(
            [campaignId, String(second._id)].map((id) =>
              moveLinksToCampaign(ctx, ids, id),
            ),
          )
        ).every((result) => result.ok),
      ).toBe(true);
      const links = await db
          .collection(physicalNames.links)
          .find({ workspaceId: ctx.workspace._id })
          .toArray(),
        finalId = String(links[0]!.utmLinks[0].campaign._id);
      expect(
        links.every((link) =>
          link.utmLinks.every(
            (variant: { campaign: { _id: ObjectId } }) =>
              String(variant.campaign._id) === finalId,
          ),
        ),
      ).toBe(true);
      expect(
        (await db
          .collection(physicalNames.campaigns)
          .findOne({ _id: new ObjectId(finalId) }))!.links,
      ).toHaveLength(20);
      const nonFinal = finalId === campaignId ? second._id : target._id;
      expect(
        (await db
          .collection(physicalNames.campaigns)
          .findOne({ _id: nonFinal }))!.links,
      ).toEqual([]);
      expect(
        (
          await setLinkUtm(ctx, ids[0]!, [
            { source: "Direct", campaign: "Regression" },
          ])
        ).ok,
      ).toBe(true);
      let link = (await db
        .collection(physicalNames.links)
        .findOne({ _id: rows[0]!._id }))!;
      expect(link.utmVariants).toEqual(deriveLinkUtm(link).variants);
      const regressionId = String(link.utmLinks[0].campaign._id);
      expect(
        (
          await updateCampaign(ctx, regressionId, {
            title: "Renamed regression",
          })
        ).ok,
      ).toBe(true);
      link = (await db
        .collection(physicalNames.links)
        .findOne({ _id: rows[0]!._id }))!;
      expect(link._sync.utmHash).toBe(deriveLinkUtm(link).hash);
      expect((await deleteCampaign(ctx, regressionId)).ok).toBe(true);
      link = (await db
        .collection(physicalNames.links)
        .findOne({ _id: rows[0]!._id }))!;
      expect(link.utmVariants).toEqual([]);
      expect(link._sync.utmHash).toBe(deriveLinkUtm(link).hash);
    });
    test("legacy links without an explicit domain keep the workspace redirect namespace on bulk and single-link writes", async () => {
      const { ctx, rows, ids, campaignId } = await fixture(1);
      await db
        .collection(physicalNames.links)
        .updateOne({ _id: rows[0]!._id }, { $unset: { domain: "" } });
      expect((await moveLinksToCampaign(ctx, ids, campaignId)).ok).toBe(true);
      let row = (await db
        .collection(physicalNames.links)
        .findOne({ _id: rows[0]!._id }))!;
      expect(row.domain).toBe(ctx.linkDomain);
      expect(row.urlCode).toBe(rows[0]!.urlCode);
      const load = mongoLinkLoader(db, ctx.linkDomain),
        cached = await load(ctx.linkDomain, rows[0]!.urlCode);
      expect(cached.kind).toBe("link");
      expect(cached.kind === "link" && cached.dest).toBe(rows[0]!.longUrl);
      await db
        .collection(physicalNames.links)
        .updateOne({ _id: rows[0]!._id }, { $unset: { domain: "" } });
      expect(
        (
          await setLinkUtm(ctx, ids[0]!, [
            { campaign: "Single-link regression" },
          ])
        ).ok,
      ).toBe(true);
      row = (await db
        .collection(physicalNames.links)
        .findOne({ _id: rows[0]!._id }))!;
      expect(row.domain).toBe(ctx.linkDomain);
    });
  },
);
