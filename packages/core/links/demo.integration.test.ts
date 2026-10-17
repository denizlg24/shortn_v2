import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { collection } from "@shortn/db";
import { MongoClient, type Db } from "mongodb";
import { createDemoLink, demoLifetimeMs, demoMaxClicks } from "./demo";
import { decide } from "./decide";
import { mongoLinkLoader } from "./loader";

const mongoUrl = process.env.MONGO_TEST_URL;
const secrets = { legacy: new TextEncoder().encode("x".repeat(32)) };
const deps = (db: Db, now: Date) => ({
  db,
  linkDomain: "shortn.at",
  ownHosts: ["shortn.at", "app.shortn.at"],
  // No network in tests: domain-age lookups fail and score nothing.
  scan: { fetch: async () => new Response(null, { status: 404 }) },
  now,
});

(mongoUrl ? describe : describe.skip)("marketing demo links", () => {
  let client: MongoClient, db: Db;
  beforeAll(async () => {
    if (!/^mongodb:\/\/(localhost|127\.0\.0\.1):/.test(mongoUrl!))
      throw new Error("Demo tests require loopback services");
    client = await new MongoClient(mongoUrl!).connect();
    db = client.db(`shortn_demo_${crypto.randomUUID().replaceAll("-", "")}`);
  });
  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
  });

  test("a demo link redirects uncounted by analytics, capped, and expires after 24 h", async () => {
    const now = new Date("2026-10-17T12:00:00Z");
    const created = await createDemoLink(deps(db, now), {
      url: "https://example.com/spring",
    });
    if (!created.ok) throw new Error(created.error);
    expect(created.value.key).toMatch(/^[2-9a-zA-Z]{8}$/);
    expect(created.value.expiresAt.getTime() - now.getTime()).toBe(
      demoLifetimeMs,
    );
    const stored = await collection(db, "links").findOne({
      key: created.value.key,
    });
    expect(stored).toMatchObject({
      domain: "shortn.at",
      demo: true,
      longUrl: "https://example.com/spring",
      safetyStatus: "safe",
    });
    expect(stored?.workspaceId).toBeUndefined();

    const link = await mongoLinkLoader(db, "shortn.at")(
      "shortn.at",
      created.value.key,
    );
    expect(link).toMatchObject({ kind: "link", untracked: true });
    const input = {
      link,
      key: created.value.key,
      origin: "https://shortn.at",
      locale: "en" as const,
      secrets,
      clickCount: async () => 0,
    };
    const live = await decide({ ...input, now: now.getTime() + 1000 });
    expect(live).toMatchObject({
      type: "redirect",
      location: "https://example.com/spring",
      untrackedCount: { linkId: stored!._id.toHexString() },
    });
    expect(live.track).toBeUndefined();

    const capped = await decide({
      ...input,
      now: now.getTime() + 1000,
      clickCount: async () => demoMaxClicks,
    });
    expect(capped.type).toBe("unavailable");

    const expired = await decide({
      ...input,
      now: now.getTime() + demoLifetimeMs + 1,
    });
    expect(expired).toMatchObject({ type: "unavailable", reason: "expired" });
    // The document stays, so the key is never handed out again.
    expect(
      await collection(db, "links").countDocuments({ key: created.value.key }),
    ).toBe(1);
  });

  test("refuses invalid, self-referencing and unsafe destinations", async () => {
    const now = new Date();
    for (const url of ["notaurl", "ftp://example.com/x", "https://localhost/x"])
      expect(await createDemoLink(deps(db, now), { url })).toMatchObject({
        ok: false,
        error: "invalid_url",
      });
    for (const url of [
      "https://shortn.at/abc",
      "https://app.shortn.at/login",
      "http://203.0.113.9/x.exe",
    ])
      expect(await createDemoLink(deps(db, now), { url })).toMatchObject({
        ok: false,
        error: "blocked",
      });
  });
});
