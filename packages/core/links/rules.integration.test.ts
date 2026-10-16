import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { Redis } from "ioredis";
import { collection } from "@shortn/db";
import { createLink, getLink, scanAndPersistLink, updateLink } from "./service";
import { ensurePersonalWorkspace } from "../workspaces/service";
import type { ServiceContext } from "../workspaces/context";
import { mongoLinkLoader } from "./loader";

const mongo = process.env.MONGO_TEST_URL,
  cache = process.env.REDIS_TEST_URL;
(mongo && cache ? describe : describe.skip)("rule destination safety", () => {
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
      `shortn_rule_safety_${crypto.randomUUID().replaceAll("-", "")}`,
    );
    redis = new Redis(cache!);
  });
  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
    redis?.disconnect();
  });
  async function context(): Promise<ServiceContext> {
    const userId = new ObjectId().toHexString(),
      workspace = await ensurePersonalWorkspace(db, {
        id: userId,
        name: "Rules",
      });
    return {
      db,
      cache: redis,
      workspace,
      actor: { userId, role: "owner" },
      linkDomain: "shortn.at",
    };
  }
  test("undefined optional rules are omitted before Mongo storage and remain readable", async () => {
    const ctx = await context();
    const created = await createLink(ctx, {
      url: "https://example.com",
      rules: {
        forwardQuery: undefined,
        utm: { source: undefined, campaign: "Launch" },
      },
    });
    if (!created.ok) throw new Error(created.error);
    const stored = await collection(db, "links").findOne({
      _id: new ObjectId(created.value.id),
    });
    expect(stored!.rules).toEqual({ utm: { campaign: "Launch" } });
    expect((await getLink(ctx, created.value.id))?.rules?.utm?.campaign).toBe(
      "Launch",
    );
  });
  test("legacy edits and safety scans retain the workspace root domain and working redirect", async () => {
    const original = await context(),
      ctx = { ...original, linkDomain: `${original.workspace._id}.invalid` };
    const created = await createLink(ctx, {
      url: "https://example.com/legacy",
    });
    if (!created.ok) throw new Error(created.error);
    const id = new ObjectId(created.value.id),
      loader = mongoLinkLoader(db, ctx.linkDomain);
    await collection(db, "links").updateOne(
      { _id: id },
      { $unset: { domain: "" } },
    );
    const updated = await updateLink(ctx, created.value.id, {
      rules: { geo: [{ country: "DK", url: "https://example.com/dk" }] },
    });
    expect(updated.ok && updated.value.domain).toBe(ctx.linkDomain);
    expect((await loader(ctx.linkDomain, created.value.key)).kind).toBe("link");
    await collection(db, "links").updateOne(
      { _id: id },
      { $unset: { domain: "" } },
    );
    await scanAndPersistLink(ctx, id, {
      webRiskApiKey: "stub",
      fetch: async (input) =>
        new URL(input).hostname === "webrisk.googleapis.com"
          ? Response.json({})
          : Response.json({
              events: [
                {
                  eventAction: "registration",
                  eventDate: "2010-01-01T00:00:00Z",
                },
              ],
            }),
    });
    expect((await collection(db, "links").findOne({ _id: id }))?.domain).toBe(
      ctx.linkDomain,
    );
    expect((await loader(ctx.linkDomain, created.value.key)).kind).toBe("link");
  });
  test("deep HTTPS and store URLs enter safety scans, while app schemes stay out of HTTP fetches", async () => {
    const ctx = await context();
    const rules = {
      deepLink: {
        ios: "youtube://watch?v=123",
        android: "https://example.org/app",
        fallback: "store" as const,
        store: {
          ios: "https://apps.apple.com/app/id123",
          android: "https://play.google.com/store/apps/details?id=example",
        },
      },
    };
    const created = await createLink(ctx, {
      url: "https://example.com/web",
      rules,
    });
    if (!created.ok) throw new Error(created.error);
    const id = new ObjectId(created.value.id);
    const stored = (await collection(db, "links").findOne({ _id: id }))!;
    expect(stored.rules?.deepLink).toEqual(rules.deepLink);
    expect((await getLink(ctx, created.value.id))?.rules?.deepLink).toEqual(
      rules.deepLink,
    );
    const seen: string[] = [];
    await scanAndPersistLink(ctx, id, {
      webRiskApiKey: "stub",
      fetch: async (input) => {
        const url = new URL(input);
        if (url.hostname === "webrisk.googleapis.com") {
          seen.push(url.searchParams.get("uri")!);
          return Response.json({});
        }
        return Response.json({
          events: [
            { eventAction: "registration", eventDate: "2000-01-01T00:00:00Z" },
          ],
        });
      },
    });
    expect(seen.sort()).toEqual(
      [
        "https://example.com/web",
        "https://example.org/app",
        rules.deepLink.store.ios,
        rules.deepLink.store.android,
      ].sort(),
    );
    const result = await updateLink(ctx, created.value.id, {
      rules: {
        ...rules,
        deepLink: { ...rules.deepLink, android: "https://example.net/new-app" },
      },
    });
    expect(result.ok).toBe(true);
    expect(
      (await collection(db, "links").findOne({ _id: id }))!.safetyScan!
        .generation,
    ).not.toBe(stored.safetyScan!.generation);
  });
  test("all targeting URLs are scanned and changing one replaces the scan generation", async () => {
    const ctx = await context();
    const created = await createLink(ctx, {
      url: "https://example.com",
      rules: {
        device: [{ os: "ios", url: "https://example.org/malicious" }],
        geo: [{ country: "PT", url: "https://example.net/pt" }],
      },
    });
    if (!created.ok) throw new Error(created.error);
    const id = new ObjectId(created.value.id);
    const initial = (await collection(db, "links").findOne({ _id: id }))!
      .safetyScan!.generation;
    const seen: string[] = [];
    await scanAndPersistLink(ctx, id, {
      webRiskApiKey: "stub",
      fetch: async (input) => {
        const url = new URL(input);
        if (url.hostname !== "webrisk.googleapis.com")
          return new Response(null, { status: 404 });
        const target = url.searchParams.get("uri")!;
        seen.push(target);
        return Response.json(
          target.includes("malicious")
            ? { threat: { threatTypes: ["MALWARE"] } }
            : {},
        );
      },
    });
    expect(seen.sort()).toEqual(
      [
        "https://example.com",
        "https://example.net/pt",
        "https://example.org/malicious",
      ].sort(),
    );
    expect((await collection(db, "links").findOne({ _id: id }))!.disabled).toBe(
      true,
    );
    expect(
      (
        await updateLink(ctx, String(id), {
          rules: { geo: [{ country: "ES", url: "https://example.net/es" }] },
        })
      ).ok,
    ).toBe(true);
    const edited = (await collection(db, "links").findOne({ _id: id }))!;
    expect(edited.safetyScan!.generation).not.toBe(initial);
    expect(edited.safetyStatus).toBe("pending");
    expect(edited.disabled).toBe(true);
  });
  test("rotation destinations enter scans; weight changes preserve the existing scan generation", async () => {
    const ctx = await context(),
      rotation = [
        { url: "https://example.org/a", weight: 1 },
        { url: "https://example.org/malicious", weight: 3 },
      ];
    const created = await createLink(ctx, {
      url: "https://example.com",
      rules: { rotation },
    });
    if (!created.ok) throw new Error(created.error);
    const id = new ObjectId(created.value.id),
      original = (await collection(db, "links").findOne({ _id: id }))!
        .safetyScan!.generation;
    const seen: string[] = [];
    await scanAndPersistLink(ctx, id, {
      webRiskApiKey: "stub",
      fetch: async (input) => {
        const url = new URL(input);
        if (url.hostname !== "webrisk.googleapis.com")
          return new Response(null, { status: 404 });
        const target = url.searchParams.get("uri")!;
        seen.push(target);
        return Response.json(
          target.includes("malicious")
            ? { threat: { threatTypes: ["MALWARE"] } }
            : {},
        );
      },
    });
    expect(seen.sort()).toEqual(
      ["https://example.com", ...rotation.map((option) => option.url)].sort(),
    );
    expect((await collection(db, "links").findOne({ _id: id }))!.disabled).toBe(
      true,
    );
    expect(
      (
        await updateLink(ctx, String(id), {
          rules: {
            rotation: rotation.map((option) => ({ ...option, weight: 2 })),
          },
        })
      ).ok,
    ).toBe(true);
    expect(
      (await collection(db, "links").findOne({ _id: id }))!.safetyScan!
        .generation,
    ).toBe(original);
    expect(
      (
        await updateLink(ctx, String(id), {
          rules: { rotation: [{ url: "https://example.net/new", weight: 1 }] },
        })
      ).ok,
    ).toBe(true);
    expect(
      (await collection(db, "links").findOne({ _id: id }))!.safetyScan!
        .generation,
    ).not.toBe(original);
  });
  test("fallback destinations are scanned and their verdict protects the whole link", async () => {
    const ctx = await context();
    const created = await createLink(ctx, {
      url: "https://example.com",
      rules: { expiredUrl: "https://example.org/fallback" },
    });
    if (!created.ok) throw new Error(created.error);
    const seen: string[] = [];
    await scanAndPersistLink(ctx, new ObjectId(created.value.id), {
      webRiskApiKey: "stub",
      fetch: async (input) => {
        const url = new URL(input);
        if (url.hostname === "webrisk.googleapis.com") {
          const uri = url.searchParams.get("uri")!;
          seen.push(uri);
          return Response.json(
            uri.includes("fallback")
              ? { threat: { threatTypes: ["MALWARE"] } }
              : {},
          );
        }
        return new Response(null, { status: 404 });
      },
    });
    expect(seen).toHaveLength(2);
    const stored = await collection(db, "links").findOne({
      _id: new ObjectId(created.value.id),
    });
    expect(stored).toMatchObject({
      safetyStatus: "malicious",
      disabled: true,
      riskScore: 100,
    });
  });
  test("a scan result cannot apply after the fallback changes during provider lookup", async () => {
    const ctx = await context();
    const created = await createLink(ctx, {
      url: "https://example.com",
      rules: { expiredUrl: "https://example.org/old" },
    });
    if (!created.ok) throw new Error(created.error);
    let arrived!: () => void, release!: () => void;
    const ready = new Promise<void>((resolve) => {
        arrived = resolve;
      }),
      gate = new Promise<void>((resolve) => {
        release = resolve;
      });
    const scan = scanAndPersistLink(ctx, new ObjectId(created.value.id), {
      webRiskApiKey: "stub",
      fetch: async (input) => {
        const url = new URL(input);
        if (url.hostname !== "webrisk.googleapis.com")
          return new Response(null, { status: 404 });
        if (url.searchParams.get("uri")!.includes("/old")) {
          arrived();
          await gate;
          return Response.json({ threat: { threatTypes: ["MALWARE"] } });
        }
        return Response.json({});
      },
    });
    await ready;
    try {
      expect(
        (
          await updateLink(ctx, created.value.id, {
            rules: { expiredUrl: "https://example.org/new" },
          })
        ).ok,
      ).toBe(true);
    } finally {
      release();
    }
    await scan;
    const stored = await collection(db, "links").findOne({
      _id: new ObjectId(created.value.id),
    });
    expect(stored).toMatchObject({
      safetyStatus: "pending",
      disabled: false,
      rules: { expiredUrl: "https://example.org/new" },
    });
  });
});
