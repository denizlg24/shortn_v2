import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { physicalNames } from "@shortn/db";
import { Redis } from "ioredis";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { breakdown, timeseries, totals } from "../analytics/queries";
import {
  createCampaign,
  deleteCampaign,
  setLinkUtm,
  updateCampaign,
} from "../campaigns/service";
import { isLegacyQrBacked, toCachedLink } from "../links/cached-link";
import { createLink } from "../links/service";
import type { ServiceContext } from "../workspaces/context";
import { ensurePersonalWorkspace } from "../workspaces/service";
import { createQr, deleteQrs, getQr, updateQr } from "./service";

const mongoUrl = process.env.MONGO_TEST_URL;
const redisUrl = process.env.REDIS_TEST_URL;
const enabled = Boolean(mongoUrl && redisUrl);

(enabled ? describe : describe.skip)("QR, campaigns and analytics", () => {
  let client: MongoClient;
  let redis: Redis;
  let db: Db;

  beforeAll(async () => {
    client = await new MongoClient(mongoUrl ?? "").connect();
    redis = new Redis(redisUrl ?? "");
    db = client.db(
      `shortn_core_test_${crypto.randomUUID().replaceAll("-", "")}`,
    );
  });
  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
    redis?.disconnect();
  });

  async function context(plan?: "plus" | "pro"): Promise<ServiceContext> {
    const userId = new ObjectId().toHexString();
    const workspace = await ensurePersonalWorkspace(db, {
      id: userId,
      name: "Ana",
      sub: `authS|${crypto.randomUUID()}`,
    });
    if (plan)
      await db.collection(physicalNames.subscriptions).insertOne({
        workspaceId: workspace._id,
        polarSubscriptionId: crypto.randomUUID(),
        status: "active",
        plan,
        currentPeriodStart: new Date(Date.now() - 86_400_000),
        currentPeriodEnd: new Date(Date.now() + 86_400_000 * 29),
        cancelAtPeriodEnd: false,
      });
    return {
      db,
      workspace,
      actor: { userId, role: "owner" },
      cache: redis,
      linkDomain: "shortn.at",
    };
  }

  test("a QR code is a legacy pair: QR document plus hidden backing link", async () => {
    const ctx = await context();
    const link = await createLink(ctx, { url: "https://print.example" });
    if (!link.ok) throw new Error(link.error);
    const qr = await createQr(ctx, {
      url: "print.example/menu",
      tags: ["Print"],
      attachToLinkId: link.value.id,
    });
    if (!qr.ok) throw new Error(qr.error);
    const qrDoc = await db
      .collection(physicalNames.qr_codes)
      .findOne({ _id: new ObjectId(qr.value.id) });
    const backing = await db
      .collection(physicalNames.links)
      .findOne({ urlCode: qrDoc?.urlId });
    expect(qrDoc?.options.data).toBe(`https://shortn.at/${qrDoc?.urlId}`);
    expect(qrDoc?.attachedUrl).toBe(link.value.key);
    expect(backing?.isQrCode).toBe(true);
    expect(backing?.qrCodeId).toBe(qrDoc?.qrCodeId);
    expect(backing?.sub).toBe(ctx.workspace.legacySub);
    if (!backing || !qrDoc) throw new Error("missing");
    expect(isLegacyQrBacked({ ...backing, _id: backing._id })).toBe(true);
    expect(
      toCachedLink({ ...backing, _id: backing._id }, backing.urlCode, {
        _id: qrDoc._id,
        qrCodeId: qrDoc.qrCodeId,
      }),
    ).toMatchObject({
      kind: "link",
      status: "ok",
      qr: { publicId: qrDoc.qrCodeId },
    });
    const attached = await db
      .collection(physicalNames.links)
      .findOne({ urlCode: link.value.key });
    expect(attached?.qrCodeId).toBe(qrDoc.qrCodeId);

    expect(
      await updateQr(ctx, qr.value.id, {
        design: { image: "https://x.y/logo.png" },
      }),
    ).toMatchObject({
      error: "feature_required",
    });
    const moved = await updateQr(ctx, qr.value.id, {
      url: "https://print.example/new",
      applyToLink: true,
      title: "Menu",
    });
    expect(moved.ok).toBe(true);
    const movedBacking = await db
      .collection(physicalNames.links)
      .findOne({ _id: backing._id });
    expect(movedBacking?.longUrl).toBe("https://print.example/new");
    expect(movedBacking?.destination).toBe("https://print.example/new");
    expect(
      (
        await db
          .collection(physicalNames.links)
          .findOne({ urlCode: link.value.key })
      )?.title,
    ).toBe("Menu");

    expect((await deleteQrs(ctx, [qr.value.id])).ok).toBe(true);
    expect(
      await db
        .collection(physicalNames.links)
        .countDocuments({ _id: backing._id }),
    ).toBe(0);
    expect(
      (
        await db
          .collection(physicalNames.links)
          .findOne({ urlCode: link.value.key })
      )?.qrCodeId,
    ).toBe("");
  });

  test("editing a legacy design keeps options the editor doesn't model", async () => {
    const ctx = await context();
    const qr = await createQr(ctx, { url: "https://a.com" });
    if (!qr.ok) throw new Error(qr.error);
    const gradient = {
      type: "linear",
      colorStops: [{ offset: 0, color: "#000" }],
    };
    await db
      .collection(physicalNames.qr_codes)
      .updateOne(
        { _id: new ObjectId(qr.value.id) },
        {
          $set: {
            "options.dotsOptions": { color: "#123456", type: "dots", gradient },
            "options.width": "300",
          },
        },
      );
    const view = await getQr(ctx, qr.value.id);
    expect(view?.design.dotsOptions).toEqual({
      color: "#123456",
      type: "dots",
    });
    expect(view?.design.backgroundOptions?.color).toBe("#ffffff");
    expect(
      (
        await updateQr(ctx, qr.value.id, {
          design: { backgroundOptions: { color: "#eeeeee" } },
        })
      ).ok,
    ).toBe(true);
    const stored = await db
      .collection(physicalNames.qr_codes)
      .findOne({ _id: new ObjectId(qr.value.id) });
    expect(stored?.options.dotsOptions.gradient).toEqual(gradient);
    expect(stored?.options.width).toBe("300");
    expect(stored?.options.backgroundOptions.color).toBe("#eeeeee");
  });

  test("campaigns: UTM variants create campaigns by title; rename and delete keep links consistent", async () => {
    const free = await context();
    expect(await createCampaign(free, { title: "x" })).toMatchObject({
      error: "feature_required",
    });
    const ctx = await context("plus");
    const link = await createLink(ctx, { url: "https://news.example" });
    if (!link.ok) throw new Error(link.error);
    const set = await setLinkUtm(ctx, link.value.id, [
      { source: "newsletter", medium: "email", campaign: "Autumn" },
      { source: "facebook", medium: "social", campaign: "Autumn" },
    ]);
    expect(set.ok).toBe(true);
    const campaign = await db
      .collection(physicalNames.campaigns)
      .findOne({ title: "Autumn" });
    expect(campaign?.links).toEqual([new ObjectId(link.value.id)]);
    expect(campaign?.sub).toBe(ctx.workspace.legacySub);
    if (!campaign) throw new Error("missing");
    const renamed = await updateCampaign(ctx, campaign._id.toHexString(), {
      title: "Autumn 26",
      utmDefaults: {
        sources: [" Newsletter "],
        mediums: [],
        terms: [],
        contents: [],
      },
    });
    expect(renamed.ok && renamed.value.utmDefaults.sources).toEqual([
      "newsletter",
    ]);
    const doc = await db
      .collection(physicalNames.links)
      .findOne({ _id: new ObjectId(link.value.id) });
    expect(
      doc?.utmLinks.map(
        (u: { campaign: { title: string } }) => u.campaign.title,
      ),
    ).toEqual(["Autumn 26", "Autumn 26"]);
    expect((await deleteCampaign(ctx, campaign._id.toHexString())).ok).toBe(
      true,
    );
    const after = await db
      .collection(physicalNames.links)
      .findOne({ _id: new ObjectId(link.value.id) });
    expect(after?.utmLinks).toEqual([]);
    const emptied = await setLinkUtm(ctx, link.value.id, [
      { campaign: "Solo" },
    ]);
    expect(emptied.ok).toBe(true);
    await setLinkUtm(ctx, link.value.id, []);
    expect(
      await db
        .collection(physicalNames.campaigns)
        .countDocuments({ title: "Solo" }),
    ).toBe(0);
  });

  test("analytics aggregates clicks, scans, uniques, buckets and breakdowns", async () => {
    const ctx = await context();
    const linkId = new ObjectId();
    const base = {
      workspaceId: ctx.workspace._id,
      linkId,
      domain: "shortn.at",
      key: "k",
    };
    const at = (iso: string) => new Date(iso);
    await db.collection(physicalNames.click_events).insertMany([
      {
        ts: at("2026-10-01T10:00:00Z"),
        m: { ...base, kind: "click" },
        country: "PT",
        ipHash: "a",
        refDomain: "facebook.com",
        utm: { source: "fb" },
      },
      {
        ts: at("2026-10-01T11:00:00Z"),
        m: { ...base, kind: "click" },
        country: "PT",
        ipHash: "a",
      },
      {
        ts: at("2026-10-03T09:00:00Z"),
        m: { ...base, kind: "scan" },
        country: "ES",
        ipHash: "b",
      },
      {
        ts: at("2026-11-01T09:00:00Z"),
        m: { ...base, kind: "click" },
        country: "FR",
        ipHash: "c",
      },
    ]);
    const range = {
      from: at("2026-10-01T00:00:00Z"),
      to: at("2026-10-04T00:00:00Z"),
      timezone: "UTC",
    };
    const scope = { workspaceId: ctx.workspace._id };
    expect(await totals(db, scope, range)).toEqual({
      clicks: 2,
      scans: 1,
      uniques: 2,
    });
    const series = await timeseries(db, scope, range, "day");
    expect(series.map((p) => [p.t.slice(0, 10), p.clicks, p.scans])).toEqual([
      ["2026-10-01", 2, 0],
      ["2026-10-02", 0, 0],
      ["2026-10-03", 0, 1],
    ]);
    expect(await breakdown(db, scope, range, "country")).toEqual([
      { value: "PT", clicks: 2, scans: 0 },
      { value: "ES", clicks: 0, scans: 1 },
    ]);
    const referrers = await breakdown(db, scope, range, "referrer");
    expect(referrers.find((r) => r.value === "direct")).toMatchObject({
      clicks: 1,
      scans: 1,
    });
    expect(
      await totals(db, scope, range, { referrer: "direct" }),
    ).toMatchObject({ clicks: 1, scans: 1 });
    expect(await totals(db, scope, range, { utmSource: "fb" })).toMatchObject({
      clicks: 1,
    });
    expect((await breakdown(db, scope, range, "link"))[0]?.value).toBe(
      linkId.toHexString(),
    );
  });
});
