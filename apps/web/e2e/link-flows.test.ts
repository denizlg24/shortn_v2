import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  createLink,
  ensurePersonalWorkspace,
  type ServiceContext,
} from "@shortn/core";
import { Redis } from "ioredis";
import { MongoClient, ObjectId, type Db } from "mongodb";

// Cross-service flows (16 §4.8/4.9): the redirect service sends visitors to
// web's public pages and accepts what web issues. Needs both apps running on
// the same database, Redis and LINK_ACCESS/CONFIRMATION secrets:
//   E2E_WEB=http://localhost:3000 E2E_REDIRECT=http://localhost:3002 \
//   E2E_MONGO_URL=… E2E_MONGO_DB=… E2E_REDIS_CACHE_URL=… bun test e2e
const web = process.env.E2E_WEB;
const redirect = process.env.E2E_REDIRECT;
const mongoUrl = process.env.E2E_MONGO_URL;
const enabled = Boolean(web && redirect && mongoUrl);
if (!enabled)
  console.log(
    "SKIP e2e link flows: set E2E_WEB, E2E_REDIRECT and E2E_MONGO_URL",
  );

(enabled ? describe : describe.skip)(
  "public link flows across redirect and web",
  () => {
    let client: MongoClient;
    let redis: Redis;
    let db: Db;
    let ctx: ServiceContext;

    beforeAll(async () => {
      client = await new MongoClient(mongoUrl ?? "").connect();
      db = client.db(process.env.E2E_MONGO_DB ?? "shortn");
      redis = new Redis(
        process.env.E2E_REDIS_CACHE_URL ?? "redis://127.0.0.1:6380",
      );
      const userId = new ObjectId().toHexString();
      const workspace = await ensurePersonalWorkspace(db, {
        id: userId,
        name: "E2E",
        sub: `authS|e2e-${userId}`,
      });
      ctx = {
        db,
        workspace,
        actor: { userId, role: "owner" },
        cache: redis,
        linkDomain: process.env.E2E_LINK_DOMAIN ?? "shortn.at",
      };
    });
    afterAll(async () => {
      await db
        .collection("urlv3")
        .deleteMany({ workspaceId: ctx.workspace._id });
      await db
        .collection("subscriptions")
        .deleteMany({ workspaceId: ctx.workspace._id });
      await client?.close();
      redis?.disconnect();
    });

    const go = (url: string, init: RequestInit = {}) =>
      fetch(url, { redirect: "manual", ...init });

    test("interstitial: safety page token lets the visitor through", async () => {
      const link = await createLink(ctx, { url: "https://example.org/free" });
      if (!link.ok) throw new Error(link.error);
      const first = await go(`${redirect}/${link.value.key}`);
      expect(first.headers.get("location")).toEndWith(
        `/en/safety/${link.value.key}`,
      );
      const { token } = (await (
        await fetch(`${web}/en/safety/${link.value.key}/token`)
      ).json()) as { token: string };
      const through = await go(`${redirect}/${link.value.key}?token=${token}`);
      expect(through.headers.get("location")).toBe("https://example.org/free");
      expect((await fetch(`${web}/en/safety/${link.value.key}`)).status).toBe(
        200,
      );
    });

    test("password: web verifies and the redirect accepts web's cookie", async () => {
      await db.collection("subscriptions").insertOne({
        workspaceId: ctx.workspace._id,
        polarSubscriptionId: crypto.randomUUID(),
        status: "active",
        plan: "pro",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
        cancelAtPeriodEnd: false,
      });
      const link = await createLink(ctx, {
        url: "https://example.org/secret",
        password: "letmein",
      });
      if (!link.ok) throw new Error(link.error);
      const key = link.value.key;
      expect(
        (await go(`${redirect}/${key}`)).headers.get("location"),
      ).toEndWith(`/authenticate/${key}`);
      expect((await fetch(`${web}/authenticate/${key}`)).status).toBe(200);
      const post = (password: string) =>
        go(`${web}/authenticate/${key}/verify`, {
          method: "POST",
          body: new URLSearchParams({ password }),
          headers: {
            "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200)}`,
          },
        });
      expect((await post("nope")).headers.get("location")).toContain(
        "error=wrong_password",
      );
      const ok = await post("letmein");
      expect(ok.headers.get("location")).toBe(`/${key}`);
      const cookie = (ok.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
      expect(
        (await go(`${redirect}/${key}`, { headers: { cookie } })).headers.get(
          "location",
        ),
      ).toBe("https://example.org/secret");
    });

    test("three reports block a link", async () => {
      const link = await createLink(ctx, {
        url: "https://example.org/reported",
      });
      if (!link.ok) throw new Error(link.error);
      for (const ip of ["203.0.113.11", "203.0.113.12", "203.0.113.13"])
        await go(`${web}/en/safety/${link.value.key}/report`, {
          method: "POST",
          body: new URLSearchParams({ reason: "phishing", locale: "en" }),
          headers: { "x-forwarded-for": ip },
        });
      const { token } = (await (
        await fetch(`${web}/en/safety/${link.value.key}/token`)
      ).json()) as {
        token?: string;
      };
      expect(token).toBeUndefined();
      expect(
        (await go(`${redirect}/${link.value.key}`)).headers.get("location"),
      ).toEndWith(`/en/safety/${link.value.key}`);
    });
  },
);
