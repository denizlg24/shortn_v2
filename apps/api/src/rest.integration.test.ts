import { loadEntitlements } from "@shortn/billing";
import { createShortnClient } from "../client";
import { bioContentSchema } from "@shortn/core/bio-content";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { collection, physicalNames, desiredIndexes } from "@shortn/db";
import {
  queryAnalytics,
  createApiKey,
  createLink,
  deleteLinks,
  createQr,
  revokeApiKey,
  ensurePersonalWorkspace,
  type ServiceContext,
  type ApiScope,
} from "@shortn/core";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { Redis } from "ioredis";
import { z } from "zod";
import { createRestApi } from "./rest";

const mongoUrl = process.env.MONGO_TEST_URL;
const redisUrl = process.env.REDIS_TEST_URL;
const pepper = "p6-http-test-pepper-".repeat(3);
const linkResponse = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
});
(mongoUrl && redisUrl ? describe : describe.skip)(
  "REST links contract with Mongo and Redis",
  () => {
    let client: MongoClient,
      db: Db,
      cache: Redis,
      ctx: ServiceContext,
      app: ReturnType<typeof createRestApi>;
    const keyIds: string[] = [];
    const unexpectedErrors: unknown[] = [];
    async function key(scopes: ApiScope[]) {
      const result = await createApiKey(
        ctx,
        { name: "Contract", scopes },
        pepper,
      );
      if (!result.ok) throw new Error(result.error);
      keyIds.push(result.value.key.id);
      return result.value;
    }
    function request(path: string, secret?: string, init: RequestInit = {}) {
      const headers = new Headers(init.headers);
      if (secret) headers.set("Authorization", `Bearer ${secret}`);
      return app.request(path, { ...init, headers });
    }
    function post(url: string, idempotency?: string): RequestInit {
      return {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idempotency ? { "Idempotency-Key": idempotency } : {}),
        },
        body: JSON.stringify({ url }),
      };
    }
    beforeAll(async () => {
      if (
        !/^mongodb:\/\/(localhost|127\.0\.0\.1):/.test(mongoUrl!) ||
        !/^redis:\/\/(localhost|127\.0\.0\.1):/.test(redisUrl!)
      )
        throw new Error(
          "REST integration tests require loopback Mongo and Redis",
        );
      client = await new MongoClient(mongoUrl!).connect();
      db = client.db(
        `shortn_p6_rest_test_${crypto.randomUUID().replaceAll("-", "")}`,
      );
      cache = new Redis(redisUrl!);
      const userId = new ObjectId().toHexString();
      const workspace = await ensurePersonalWorkspace(db, {
        id: userId,
        name: "HTTP",
      });
      await collection(db, "workspaces").updateOne(
        { _id: workspace._id },
        { $set: { platformFeatures: { api: true } } },
      );
      ctx = {
        db,
        workspace,
        actor: { userId, role: "owner" },
        cache,
        linkDomain: "shortn.at",
      };
      app = createRestApi({
        db,
        cache,
        durable: cache,
        pepper,
        linkDomain: "shortn.at",
        rolloutPercent: 0,
        clientIp: () => "192.0.2.1",
        log: (_message, error) => {
          unexpectedErrors.push(error);
        },
      });
    });
    afterAll(async () => {
      for (const id of keyIds) {
        await cache.del(`api:rate:${id}`, `apikey:last-used:${id}`);
        let cursor = "0";
        do {
          const [next, keys] = await cache.scan(
            cursor,
            "MATCH",
            `api:idempotency:${id}:*`,
            "COUNT",
            100,
          );
          cursor = next;
          if (keys.length) await cache.del(...keys);
        } while (cursor !== "0");
      }
      cache?.disconnect();
      await db?.dropDatabase();
      await client?.close();
      expect(unexpectedErrors).toEqual([]);
    });
    test("every OpenAPI operation rejects missing or unrelated bearer scopes", async () => {
      // This independent policy inventory must exactly cover the public contract.
      // Resource lifecycle tests below verify successful operations and live roles;
      // this matrix ensures additions cannot silently miss the scope boundary.
      const policy: Partial<Record<ApiScope, string[]>> = {
        "links:read": [
          "GET /v1/links",
          "GET /v1/links/{id}",
          "GET /v1/links/by-key",
          "GET /v1/links/by-key/{domain}/{key}",
        ],
        "links:write": [
          "POST /v1/links",
          "PATCH /v1/links/{id}",
          "DELETE /v1/links/{id}",
          "POST /v1/links/{id}/restore",
          "POST /v1/links/bulk",
        ],
        "workspace:read": ["GET /v1/workspace", "GET /v1/workspace/usage"],
        "campaigns:read": ["GET /v1/campaigns", "GET /v1/campaigns/{id}"],
        "campaigns:write": [
          "POST /v1/campaigns",
          "PATCH /v1/campaigns/{id}",
          "DELETE /v1/campaigns/{id}",
        ],
        "qr:read": [
          "GET /v1/qr-codes",
          "GET /v1/qr-codes/{id}",
          "POST /v1/qr-codes/export",
          "GET /v1/qr-codes/{id}/export",
          "GET /v1/qr-exports/{id}",
          "GET /v1/qr-exports/zip/{id}",
        ],
        "qr:write": [
          "POST /v1/qr-codes",
          "PATCH /v1/qr-codes/{id}",
          "DELETE /v1/qr-codes/{id}",
        ],
        "tags:read": ["GET /v1/tags", "GET /v1/tags/{id}"],
        "tags:write": [
          "POST /v1/tags",
          "PATCH /v1/tags/{id}",
          "DELETE /v1/tags/{id}",
        ],
        "analytics:read": ["GET /v1/analytics", "GET /v1/links/{id}/analytics"],
        "domains:read": ["GET /v1/domains", "GET /v1/domains/{id}/status"],
        "domains:write": ["POST /v1/domains", "DELETE /v1/domains/{id}"],
        "bio:read": ["GET /v1/bio-pages", "GET /v1/bio-pages/{id}"],
        "bio:write": [
          "POST /v1/bio-pages",
          "PATCH /v1/bio-pages/{id}",
          "POST /v1/bio-pages/{id}/publish",
        ],
        "webhooks:read": [
          "GET /v1/webhooks",
          "GET /v1/webhooks/{id}",
          "GET /v1/webhooks/{id}/deliveries",
        ],
        "webhooks:write": [
          "POST /v1/webhooks",
          "PATCH /v1/webhooks/{id}",
          "DELETE /v1/webhooks/{id}",
          "POST /v1/webhooks/{id}/test",
          "POST /v1/webhooks/{id}/deliveries/{deliveryId}/redeliver",
        ],
      };
      const spec = z
        .object({
          paths: z.record(z.string(), z.record(z.string(), z.unknown())),
        })
        .parse(await (await request("/openapi.json")).json());
      const operations = Object.entries(spec.paths).flatMap(([path, methods]) =>
        Object.keys(methods)
          .filter((method) =>
            ["get", "post", "patch", "delete", "put", "head"].includes(method),
          )
          .map((method) => `${method.toUpperCase()} ${path}`),
      );
      expect(Object.values(policy).flat().sort()).toEqual(operations.sort());
      const id = new ObjectId().toHexString();
      for (const [required, cases] of Object.entries(policy)) {
        const unrelated = await key([
            required === "workspace:read" ? "links:read" : "workspace:read",
          ]),
          allowed = await key([required as ApiScope]);
        for (const operation of cases) {
          const separator = operation.indexOf(" ");
          const method = operation.slice(0, separator),
            template = operation.slice(separator + 1);
          let path = template!
            .replaceAll("{id}", id)
            .replaceAll("{deliveryId}", id)
            .replaceAll("{domain}", "shortn.at")
            .replaceAll("{key}", "scope-contract");
          if (path === "/v1/links/by-key") path += "?key=scope-contract";
          if (path.endsWith("/analytics"))
            path += "?from=2026-10-01T00:00:00Z&to=2026-10-02T00:00:00Z";
          const init: RequestInit = {
            method,
            ...(["POST", "PATCH", "PUT"].includes(method!)
              ? { headers: { "Content-Type": "application/json" }, body: "{}" }
              : {}),
          };
          expect(
            (await request(path, undefined, init)).status,
            `${operation}: missing bearer`,
          ).toBe(401);
          const denied = await request(path, unrelated.secret, init);
          expect(denied.status, `${operation}: unrelated scope`).toBe(403);
          expect((await denied.json()).code, operation).toBe(
            "insufficient_scope",
          );
          const permitted = await request(path, allowed.secret, init);
          expect(
            permitted.status,
            `${operation}: expected scope reaches the handler`,
          ).not.toBe(401);
          const text = await permitted.text();
          expect(text ? JSON.parse(text).code : undefined, operation).not.toBe(
            "insufficient_scope",
          );
        }
      }
    });
    test("link rule writes validate, round-trip through Mongo/cache, replace/clear and isolate workspaces", async () => {
      const userId = new ObjectId().toHexString();
      const workspace = await ensurePersonalWorkspace(db, {
        id: userId,
        name: "Rule API",
      });
      await collection(db, "workspaces").updateOne(
        { _id: workspace._id },
        { $set: { platformFeatures: { api: true } } },
      );
      const ruleCtx: ServiceContext = {
        ...ctx,
        workspace,
        actor: { userId, role: "owner" },
      };
      const result = await createApiKey(
        ruleCtx,
        { name: "Rules", scopes: ["links:read", "links:write"] },
        pepper,
      );
      if (!result.ok) throw new Error(result.error);
      keyIds.push(result.value.key.id);
      const secret = result.value.secret;
      const send = (method: string, body: unknown): RequestInit => ({
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const rules = {
        deepLink: { ios: "youtube://watch?v=123", fallback: "web" },
        maxClicks: 10,
        activeFrom: new Date(Date.now() + 60000).toISOString(),
        expiresAt: new Date(Date.now() + 120000).toISOString(),
        forwardQuery: true,
        utm: { source: "configured" },
        permanent: true,
      };
      for (const invalid of [
        { ...rules, expiresAt: rules.activeFrom },
        { expiredUrl: "http://127.0.0.1/private" },
        { maxClicks: -1 },
        {
          deepLink: {
            ios: "youtube://x",
            fallback: "store",
            store: { ios: "not-a-url" },
          },
        },
      ])
        expect(
          (
            await request(
              "/v1/links",
              secret,
              send("POST", { url: "https://example.com", rules: invalid }),
            )
          ).status,
        ).toBe(400);
      expect(
        await collection(db, "links").countDocuments({
          workspaceId: workspace._id,
        }),
      ).toBe(0);
      const created = await request(
        "/v1/links",
        secret,
        send("POST", { url: "https://example.com/rules", rules }),
      );
      expect(created.status).toBe(201);
      const body = (await created.json()) as {
        id: string;
        key: string;
        rules: typeof rules;
      };
      expect(body.rules).toEqual(rules);
      const stored = await collection(db, "links").findOne({
        _id: new ObjectId(body.id),
      });
      expect(stored!.rules!.activeFrom).toBeInstanceOf(Date);
      await collection(db, "links").updateOne(
        { _id: new ObjectId(body.id) },
        { $set: { requiresInterstitial: false, safetyStatus: "safe" } },
      );
      const { mongoLinkLoader } = await import("../../redirect/src/resolver");
      const { decide, decodeCachedLink, encodeCachedLink } =
        await import("@shortn/core");
      const loaded = decodeCachedLink(
        encodeCachedLink(await mongoLinkLoader(db)("shortn.at", body.key)),
      );
      const decision = await decide({
        link: loaded,
        key: body.key,
        origin: "https://shortn.at",
        locale: "en",
        secrets: { legacy: new Uint8Array(32) },
      });
      expect(decision).toMatchObject({
        type: "unavailable",
        reason: "scheduled",
      });
      const replacement = {
        expiresAt: new Date(0).toISOString(),
        expiredUrl: "https://example.com/ended",
      };
      const patched = await request(
        `/v1/links/${body.id}`,
        secret,
        send("PATCH", { rules: replacement }),
      );
      expect(patched.status).toBe(200);
      expect(((await patched.json()) as { rules: unknown }).rules).toEqual(
        replacement,
      );
      expect(
        (await collection(db, "links").findOne({ _id: new ObjectId(body.id) }))!
          .rules!.activeFrom,
      ).toBeUndefined();
      const foreign = await key(["links:write"]);
      expect(
        (
          await request(
            `/v1/links/${body.id}`,
            foreign.secret,
            send("PATCH", { rules: null }),
          )
        ).status,
      ).toBe(404);
      const cleared = await request(
        `/v1/links/${body.id}`,
        secret,
        send("PATCH", { rules: null }),
      );
      expect(cleared.status).toBe(200);
      expect(
        ((await cleared.json()) as { rules?: unknown }).rules,
      ).toBeUndefined();
      expect(
        (await collection(db, "links").findOne({ _id: new ObjectId(body.id) }))!
          .rules,
      ).toBeUndefined();
    });
    test("social preview API validates, replaces and clears metadata with tenant isolation", async () => {
      const userId = new ObjectId().toHexString(),
        workspace = await ensurePersonalWorkspace(db, {
          id: userId,
          name: "OG API",
        });
      await collection(db, "workspaces").updateOne(
        { _id: workspace._id },
        { $set: { platformFeatures: { api: true } } },
      );
      const result = await createApiKey(
        { ...ctx, workspace, actor: { userId, role: "owner" } },
        { name: "Previews", scopes: ["links:read", "links:write"] },
        pepper,
      );
      if (!result.ok) throw new Error(result.error);
      keyIds.push(result.value.key.id);
      const secret = result.value.secret;
      const send = (method: string, body: unknown): RequestInit => ({
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      for (const og of [
        {},
        { title: "x".repeat(201) },
        { image: "http://127.0.0.1/image" },
        { image: "not-a-url" },
        { image: "https://user:pass@example.com/x" },
      ])
        expect(
          (
            await request(
              "/v1/links",
              secret,
              send("POST", { url: "https://example.com", og }),
            )
          ).status,
        ).toBe(400);
      const created = await request(
        "/v1/links",
        secret,
        send("POST", {
          url: "https://example.com",
          og: { title: " Title ", image: "https://images.example.com/one.png" },
        }),
      );
      expect(created.status).toBe(201);
      const body = (await created.json()) as { id: string; og: unknown };
      expect(body.og).toEqual({
        title: "Title",
        image: "https://images.example.com/one.png",
      });
      const patched = await request(
        `/v1/links/${body.id}`,
        secret,
        send("PATCH", { og: { description: "New description" } }),
      );
      expect(patched.status).toBe(200);
      expect(((await patched.json()) as { og: unknown }).og).toEqual({
        description: "New description",
      });
      const foreign = await key(["links:write"]);
      expect(
        (
          await request(
            `/v1/links/${body.id}`,
            foreign.secret,
            send("PATCH", { og: null }),
          )
        ).status,
      ).toBe(404);
      const cleared = await request(
        `/v1/links/${body.id}`,
        secret,
        send("PATCH", { og: null }),
      );
      expect(cleared.status).toBe(200);
      expect(await cleared.json()).not.toHaveProperty("og");
    });
    test("link health is read-only, serialized and isolated through the REST link view", async () => {
      const userId = new ObjectId().toHexString(),
        workspace = await ensurePersonalWorkspace(db, {
          id: userId,
          name: "Health API",
        });
      await collection(db, "workspaces").updateOne(
        { _id: workspace._id },
        { $set: { platformFeatures: { api: true } } },
      );
      const result = await createApiKey(
        { ...ctx, workspace, actor: { userId, role: "owner" } },
        { name: "Health", scopes: ["links:read", "links:write"] },
        pepper,
      );
      if (!result.ok) throw new Error(result.error);
      keyIds.push(result.value.key.id);
      const secret = result.value.secret;
      const response = await request("/v1/links", secret, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/health" }),
      });
      expect(response.status).toBe(201);
      const body = (await response.json()) as {
        id: string;
        health: { flagged: boolean; checks: unknown[] };
      };
      expect(body.health.flagged).toBe(false);
      expect(body.health.checks).toEqual([]);
      const at = new Date();
      await collection(db, "links").updateOne(
        { _id: new ObjectId(body.id) },
        {
          $set: {
            "health.completedAt": at,
            "health.checks": [
              {
                url: "https://example.com/health",
                status: "http_error",
                httpStatus: 404,
                checkedAt: at,
                streak: 2,
                failingSince: at,
              },
            ],
          },
        },
      );
      const read = await request(`/v1/links/${body.id}`, secret);
      expect(read.status).toBe(200);
      const value = (await read.json()) as {
        health: {
          flagged: boolean;
          checks: { checkedAt: string; failingSince: string }[];
        };
      };
      expect(value.health.flagged).toBe(true);
      expect(value.health.checks[0]!.checkedAt).toBe(at.toISOString());
      expect(value.health.checks[0]!.failingSince).toBe(at.toISOString());
      expect(
        (
          await request(`/v1/links/${body.id}`, secret, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ health: { flagged: false } }),
          })
        ).status,
      ).toBe(400);
      const foreign = await key(["links:read"]);
      expect(
        (await request(`/v1/links/${body.id}`, foreign.secret)).status,
      ).toBe(404);
    });
    test("bulk creation enforces bounds, scopes, atomic quota errors and idempotent replay", async () => {
      const userId = new ObjectId().toHexString();
      const workspace = await ensurePersonalWorkspace(db, {
        id: userId,
        name: "Bulk API",
      });
      await collection(db, "workspaces").updateOne(
        { _id: workspace._id },
        { $set: { platformFeatures: { api: true } } },
      );
      const bulkCtx: ServiceContext = {
        ...ctx,
        workspace,
        actor: { userId, role: "owner" },
      };
      const created = await createApiKey(
        bulkCtx,
        { name: "Bulk", scopes: ["links:write"] },
        pepper,
      );
      if (!created.ok) throw new Error(created.error);
      keyIds.push(created.value.key.id);
      const secret = created.value.secret;
      const limit = (await loadEntitlements(db, workspace._id)).limits.links!;
      const readonly = await createApiKey(
        bulkCtx,
        { name: "Read", scopes: ["links:read"] },
        pepper,
      );
      if (!readonly.ok) throw new Error(readonly.error);
      keyIds.push(readonly.value.key.id);
      const body = {
        links: [
          {
            url: "https://example.com/bulk-first",
            title: "First",
            tags: ["Bulk"],
          },
          {
            url: "https://example.com/bulk-second",
            title: "Second",
            tags: ["Bulk"],
          },
        ],
      };
      const send = (payload: unknown, idempotency?: string): RequestInit => ({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idempotency ? { "Idempotency-Key": idempotency } : {}),
        },
        body: JSON.stringify(payload),
      });
      expect(
        (await request("/v1/links/bulk", readonly.value.secret, send(body)))
          .status,
      ).toBe(403);
      for (const links of [
        [],
        Array.from({ length: 1001 }, () => ({ url: "https://example.com" })),
      ])
        expect(
          (await request("/v1/links/bulk", secret, send({ links }))).status,
        ).toBe(400);
      const invalid = await request(
        "/v1/links/bulk",
        secret,
        send({ links: [body.links[0], { url: "javascript:alert(1)" }] }),
      );
      expect(invalid.status).toBe(400);
      expect(await invalid.json()).toMatchObject({
        code: "invalid_url",
        context: { index: 1 },
      });
      expect(
        await collection(db, "links").countDocuments({
          workspaceId: workspace._id,
        }),
      ).toBe(0);
      expect(
        await collection(db, "tags").countDocuments({
          workspaceId: workspace._id,
        }),
      ).toBe(0);
      const idempotency = crypto.randomUUID();
      const first = await request(
        "/v1/links/bulk",
        secret,
        send(body, idempotency),
      );
      expect(first.status).toBe(201);
      const response = await first.text();
      expect(JSON.parse(response)).toMatchObject({
        count: 2,
        items: [{ title: "First" }, { title: "Second" }],
      });
      const replay = await request(
        "/v1/links/bulk",
        secret,
        send(body, idempotency),
      );
      expect(replay.status).toBe(201);
      expect(replay.headers.get("Idempotency-Replayed")).toBe("true");
      expect(await replay.text()).toBe(response);
      expect(
        await collection(db, "links").countDocuments({
          workspaceId: workspace._id,
        }),
      ).toBe(2);
      expect(
        await collection(db, "tags").countDocuments({
          workspaceId: workspace._id,
        }),
      ).toBe(1);
      expect(
        (
          await request(
            "/v1/links/bulk",
            secret,
            send({ links: [body.links[0]] }, idempotency),
          )
        ).status,
      ).toBe(409);
      const quota = await request(
        "/v1/links/bulk",
        secret,
        send({
          links: Array.from({ length: limit - 1 }, () => ({
            ...body.links[0],
            tags: ["No orphan quota"],
          })),
        }),
      );
      expect(quota.status).toBe(409);
      expect(await quota.json()).toMatchObject({
        code: "limit_reached",
        context: { used: 2, limit, requested: limit - 1 },
      });
      expect(
        await collection(db, "links").countDocuments({
          workspaceId: workspace._id,
        }),
      ).toBe(2);
      expect(
        await collection(db, "tags").countDocuments({
          workspaceId: workspace._id,
        }),
      ).toBe(1);
      await collection(db, "workspaces").updateOne(
        { _id: workspace._id },
        { $set: { platformFeatures: { api: false } } },
      );
      expect(
        (await request("/v1/links/bulk", secret, send(body, idempotency)))
          .status,
      ).toBe(404);
    });
    test("link expansions are page-bounded, scoped, tenant-isolated and resolve legacy references", async () => {
      const legacySub = ctx.workspace.legacySub ?? ctx.actor.userId;
      await collection(db, "workspaces").updateOne(
        { _id: ctx.workspace._id },
        { $set: { legacySub } },
      );
      const token = await key(["links:read", "tags:read", "campaigns:read"]);
      const limited = await key(["links:read"]);
      const tagId = new ObjectId(),
        legacyTagId = new ObjectId(),
        mergedTagId = new ObjectId();
      const campaignId = new ObjectId(),
        secondCampaignId = new ObjectId(),
        foreignTagId = new ObjectId(),
        foreignCampaignId = new ObjectId();
      const foreignWorkspace = new ObjectId(),
        now = new Date();
      await collection(db, "tags").insertMany([
        {
          _id: tagId,
          workspaceId: ctx.workspace._id,
          name: "Current tag",
          id: "tag-old",
          createdAt: now,
          createdBy: ctx.actor.userId,
        },
        {
          _id: legacyTagId,
          sub: legacySub,
          tagName: "Legacy tag",
          id: "tag-new",
          legacyIds: ["tag-merged"],
          createdAt: now,
        },
        {
          _id: mergedTagId,
          workspaceId: ctx.workspace._id,
          name: "Merged tag",
          mergedInto: legacyTagId,
        },
        {
          _id: foreignTagId,
          workspaceId: foreignWorkspace,
          name: "Foreign tag",
          sub: legacySub,
        },
      ]);
      await collection(db, "campaigns").insertMany([
        {
          _id: campaignId,
          workspaceId: ctx.workspace._id,
          title: "Current campaign",
          description: "Full details",
          links: Array.from({ length: 1001 }, () => new ObjectId()),
          createdAt: now,
        },
        {
          _id: secondCampaignId,
          sub: legacySub,
          title: "Legacy campaign",
          links: [],
          createdAt: now,
        },
        {
          _id: foreignCampaignId,
          workspaceId: foreignWorkspace,
          title: "Foreign campaign",
          sub: legacySub,
        },
      ]);
      const ids = Array.from({ length: 201 }, () => new ObjectId());
      const prefix = `expand-${crypto.randomUUID().slice(0, 8)}`;
      await collection(db, "links").insertMany(
        ids.map((_id, index) => ({
          _id,
          workspaceId: ctx.workspace._id,
          urlCode: `${prefix}-${index}`,
          longUrl: "https://example.com/expanded",
          title: prefix,
          date: now,
          tags: [
            { _id: tagId, id: "tag-old", name: "Stale label" },
            { id: "tag-merged", tagName: "Old merged label" },
            { _id: mergedTagId, name: "Merged tag" },
            { _id: foreignTagId, name: "Foreign tag" },
            { _id: new ObjectId(), name: "Deleted tag" },
          ],
          utmLinks: [
            { campaign: { _id: campaignId, title: "Stale campaign label" } },
            { campaign: { _id: campaignId, title: "Duplicate variant" } },
            { campaign: { title: "Legacy campaign" } },
            { campaign: { _id: foreignCampaignId, title: "Current campaign" } },
            { campaign: { _id: new ObjectId(), title: "Legacy campaign" } },
          ],
        })),
      );
      try {
        const url = `/v1/links?search=${prefix}&limit=200&expand=tags,campaign`;
        expect((await request(url, limited.secret)).status).toBe(403);
        for (const expand of ["unknown", "tags,", "tags,,campaign"])
          expect(
            (await request(`/v1/links?expand=${expand}`, token.secret)).status,
          ).toBe(400);
        const first = await request(url, token.secret);
        expect(first.status).toBe(200);
        const page = (await first.json()) as {
          items: Array<{
            id: string;
            tags: unknown[];
            expanded: {
              tags: Array<{ id: string; name: string; createdAt: string }>;
              campaign: Array<{
                id: string;
                title: string;
                description: string | null;
                linkCount: number;
              }>;
            };
          }>;
          nextCursor: string;
        };
        expect(page.items).toHaveLength(200);
        expect(page.nextCursor).toBeTruthy();
        for (const link of page.items) {
          expect(link.expanded.tags.map((tag) => tag.id)).toEqual([
            String(tagId),
            String(legacyTagId),
          ]);
          expect(link.expanded.tags[0]!.name).toBe("Current tag");
          expect(link.expanded.tags[0]!.createdAt).toBe(now.toISOString());
          expect(link.expanded.campaign.map((campaign) => campaign.id)).toEqual(
            [String(campaignId), String(secondCampaignId)],
          );
          expect(link.expanded.campaign[0]!.description).toBe("Full details");
          expect(link.expanded.campaign[0]!.linkCount).toBe(1001);
        }
        const last = await request(
          `${url}&cursor=${page.nextCursor}`,
          token.secret,
        );
        expect(
          ((await last.json()) as { items: unknown[] }).items,
        ).toHaveLength(1);
        const id = page.items[0]!.id;
        const raw = await collection(db, "links").findOne({
          _id: new ObjectId(id),
        });
        for (const path of [
          `/v1/links/${id}`,
          `/v1/links/by-key?key=${raw!.urlCode}`,
          `/v1/links/by-key/shortn.at/${raw!.urlCode}`,
        ]) {
          expect(
            (
              await request(
                path + (path.includes("?") ? "&" : "?") + "expand=campaign",
                limited.secret,
              )
            ).status,
          ).toBe(403);
          const expanded = await request(
            path + (path.includes("?") ? "&" : "?") + "expand=campaign",
            token.secret,
          );
          expect(expanded.status).toBe(200);
          const body = (await expanded.json()) as {
            expanded: { campaign: unknown[]; tags?: unknown[] };
          };
          expect(body.expanded.campaign).toHaveLength(2);
          expect(body.expanded.tags).toBeUndefined();
          const compact = await request(path, limited.secret);
          expect(compact.status).toBe(200);
          expect(
            ((await compact.json()) as { expanded?: unknown }).expanded,
          ).toBeUndefined();
        }
        // A link carrying a foreign legacy sub never permits expanding a resource assigned to another workspace.
        expect(
          (
            await request(
              `/v1/links/${new ObjectId()}?expand=tags,campaign`,
              token.secret,
            )
          ).status,
        ).toBe(404);
      } finally {
        if (!ctx.workspace.legacySub)
          await collection(db, "workspaces").updateOne(
            { _id: ctx.workspace._id },
            { $unset: { legacySub: "" } },
          );

        await collection(db, "links").deleteMany({ _id: { $in: ids } });
        await collection(db, "tags").deleteMany({
          _id: { $in: [tagId, legacyTagId, mergedTagId, foreignTagId] },
        });
        await collection(db, "campaigns").deleteMany({
          _id: { $in: [campaignId, secondCampaignId, foreignCampaignId] },
        });
      }
    });
    test("cookies never authorize REST; flags default off and revoked keys stop", async () => {
      const noAuth = await request("/v1/links", undefined, {
        headers: { Cookie: "shortn_auth_session=pretend" },
      });
      expect(noAuth.status).toBe(401);
      expect(noAuth.headers.get("Content-Type")).toContain(
        "application/problem+json",
      );
      const created = await key(["links:read"]);
      await collection(db, "workspaces").updateOne(
        { _id: ctx.workspace._id },
        { $unset: { platformFeatures: "" } },
      );
      expect((await request("/v1/links", created.secret)).status).toBe(404);
      await collection(db, "workspaces").updateOne(
        { _id: ctx.workspace._id },
        { $set: { platformFeatures: { api: true } } },
      );
      expect((await request("/v1/links", created.secret)).status).toBe(200);
      await revokeApiKey(ctx, created.key.id);
      expect((await request("/v1/links", created.secret)).status).toBe(401);
    });
    test("POST idempotency replays exactly once and rejects a conflicting payload", async () => {
      const created = await key(["links:read", "links:write"]);
      const first = await request(
        "/v1/links",
        created.secret,
        post("https://example.com/one", "create-once"),
      );
      expect(first.status).toBe(201);
      const value = linkResponse.parse(await first.json());
      const retry = await request(
        "/v1/links",
        created.secret,
        post("https://example.com/one", "create-once"),
      );
      expect(retry.status).toBe(201);
      expect(linkResponse.parse(await retry.json()).id).toBe(value.id);
      expect(retry.headers.get("Idempotency-Replayed")).toBe("true");
      expect(retry.headers.get("Location")).toBe(first.headers.get("Location"));
      expect(
        (
          await request(
            "/v1/links",
            created.secret,
            post("https://example.com/two", "create-once"),
          )
        ).status,
      ).toBe(409);
      expect(
        await collection(db, "links").countDocuments({
          workspaceId: ctx.workspace._id,
        }),
      ).toBe(1);
      const ttlKeys = await cache.keys(`api:idempotency:${created.key.id}:*`);
      expect(await cache.ttl(ttlKeys[0]!)).toBeGreaterThan(86_390);
    });
    test("concurrent retries and pending records cannot duplicate a mutation", async () => {
      const created = await key(["links:write"]);
      const before = await collection(db, "links").countDocuments({
        workspaceId: ctx.workspace._id,
      });
      const responses = await Promise.all(
        Array.from({ length: 6 }, () =>
          request(
            "/v1/links",
            created.secret,
            post("https://example.com/concurrent", "concurrent"),
          ),
        ),
      );
      expect(responses.some((response) => response.status === 201)).toBe(true);
      for (const response of responses)
        expect([201, 409]).toContain(response.status);
      expect(
        await collection(db, "links").countDocuments({
          workspaceId: ctx.workspace._id,
        }),
      ).toBe(before + 1);
      const retry = await request(
        "/v1/links",
        created.secret,
        post("https://example.com/concurrent", "concurrent"),
      );
      expect(retry.status).toBe(201);
      expect(retry.headers.get("Idempotency-Replayed")).toBe("true");
      const filter = {
        workspaceId: ctx.workspace._id,
        userId: ctx.actor.userId,
      };
      await collection(db, "workspace_members").updateOne(filter, {
        $set: { role: "viewer" },
      });
      expect(
        (
          await request(
            "/v1/links",
            created.secret,
            post("https://example.com/concurrent", "concurrent"),
          )
        ).status,
      ).toBe(403);
      await collection(db, "workspace_members").updateOne(filter, {
        $set: { role: "owner" },
      });
    });

    test("scopes and current membership constrain each implemented endpoint", async () => {
      const writer = await key(["links:write"]),
        reader = await key(["links:read"]),
        unrelated = await key(["analytics:read"]);
      expect((await request("/v1/links", writer.secret)).status).toBe(403);
      expect(
        (
          await request(
            "/v1/links",
            reader.secret,
            post("https://example.com/denied"),
          )
        ).status,
      ).toBe(403);
      expect((await request("/v1/links", unrelated.secret)).status).toBe(403);
      const create = await request(
        "/v1/links",
        writer.secret,
        post("https://example.com/scope"),
      );
      const value = linkResponse.parse(await create.json());
      expect(
        (await request(`/v1/links/${value.id}`, reader.secret)).status,
      ).toBe(200);
      expect(
        (await request(`/v1/links/${value.id}`, writer.secret)).status,
      ).toBe(403);
      const patch = {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Edited" }),
      };
      expect(
        (await request(`/v1/links/${value.id}`, reader.secret, patch)).status,
      ).toBe(403);
      expect(
        (await request(`/v1/links/${value.id}`, writer.secret, patch)).status,
      ).toBe(200);
      const filter = {
        workspaceId: ctx.workspace._id,
        userId: ctx.actor.userId,
      };
      await collection(db, "workspace_members").updateOne(filter, {
        $set: { role: "viewer" },
      });
      expect(
        (
          await request(
            "/v1/links",
            writer.secret,
            post("https://example.com/denied-viewer"),
          )
        ).status,
      ).toBe(403);
      expect(
        (await request(`/v1/links/${value.id}`, writer.secret, patch)).status,
      ).toBe(403);
      await collection(db, "workspace_members").updateOne(filter, {
        $set: { role: "owner" },
      });
      const otherWorkspace = await ensurePersonalWorkspace(db, {
        id: new ObjectId().toHexString(),
        name: "Other",
      });
      await collection(db, "workspaces").updateOne(
        { _id: otherWorkspace._id },
        { $set: { platformFeatures: { api: true } } },
      );
      const other = await createApiKey(
        {
          ...ctx,
          workspace: otherWorkspace,
          actor: { userId: otherWorkspace.ownerUserId, role: "owner" },
        },
        { name: "Other", scopes: ["links:read", "links:write"] },
        pepper,
      );
      if (!other.ok) throw new Error(other.error);
      keyIds.push(other.value.key.id);
      expect(
        (await request(`/v1/links/${value.id}`, other.value.secret)).status,
      ).toBe(404);
      expect(
        (await request(`/v1/links/${value.id}`, other.value.secret, patch))
          .status,
      ).toBe(404);
    });
    test("by-key lookup is domain-qualified, workspace-scoped, and supports legacy root links", async () => {
      const reader = await key(["links:read"]),
        writer = await key(["links:write"]);
      const created = await createLink(ctx, {
        url: "https://example.com/by-key",
      });
      if (!created.ok) throw new Error(created.error);
      const link = created.value;
      const path = `/v1/links/by-key?key=${encodeURIComponent(link.key)}`;
      expect((await request(path, writer.secret)).status).toBe(403);
      expect(
        linkResponse.parse(await (await request(path, reader.secret)).json())
          .id,
      ).toBe(link.id);
      expect(
        (await request(`${path}&domain=elsewhere.example`, reader.secret))
          .status,
      ).toBe(404);
      expect(
        (await request("/v1/links/by-key?key=invalid!", reader.secret)).status,
      ).toBe(400);
      expect((await request("/v1/links/by-key", reader.secret)).status).toBe(
        400,
      );
      const original = await collection(db, "links").findOne({
        _id: new ObjectId(link.id),
      });
      if (!original) throw new Error("missing link");
      const customId = new ObjectId();
      await collection(db, "links").insertOne({
        ...original,
        _id: customId,
        domain: "custom.example",
        key: link.key,
        urlCode: link.key,
      });
      expect(
        linkResponse.parse(
          await (
            await request(`${path}&domain=custom.example`, reader.secret)
          ).json(),
        ).id,
      ).toBe(customId.toHexString());
      await collection(db, "links").updateOne(
        { _id: original._id },
        { $unset: { domain: "", key: "" } },
      );
      expect(
        linkResponse.parse(await (await request(path, reader.secret)).json())
          .id,
      ).toBe(link.id);
      const other = await ensurePersonalWorkspace(db, {
        id: new ObjectId().toHexString(),
        name: "Lookup isolation",
      });
      const foreign = await createLink(
        {
          ...ctx,
          workspace: other,
          actor: { userId: other.ownerUserId, role: "owner" },
        },
        { url: "https://example.com/foreign-key" },
      );
      if (!foreign.ok) throw new Error(foreign.error);
      expect(
        (
          await request(
            `/v1/links/by-key?key=${foreign.value.key}`,
            reader.secret,
          )
        ).status,
      ).toBe(404);
    });
    test("workspace and usage reads enforce scope and live roles without exposing private metadata", async () => {
      const allowed = await key(["workspace:read"]),
        denied = await key(["links:read"]);
      const metric = z.object({
        consumed: z.number(),
        limit: z.number().nullable(),
        remaining: z.number().nullable(),
      });
      const usageSchema = z.object({
        period: z.object({ start: z.iso.datetime(), end: z.iso.datetime() }),
        links: metric,
        qrCodes: metric,
        bioPages: metric,
      });
      for (const path of ["/v1/workspace", "/v1/workspace/usage"]) {
        expect((await request(path)).status).toBe(401);
        expect((await request(path, denied.secret)).status).toBe(403);
        expect((await request(path, allowed.secret)).status).toBe(200);
      }
      const workspace = z
        .object({
          id: z.string(),
          name: z.string(),
          role: z.string(),
          plan: z.string(),
          createdAt: z.iso.datetime(),
        })
        .parse(await (await request("/v1/workspace", allowed.secret)).json());
      expect(workspace.id).toBe(ctx.workspace._id.toHexString());
      expect(workspace.plan).toBe("free");
      const raw = await (await request("/v1/workspace", allowed.secret)).text();
      expect(raw).not.toContain("ownerUserId");
      expect(raw).not.toContain("platformFeatures");
      const before = usageSchema.parse(
        await (await request("/v1/workspace/usage", allowed.secret)).json(),
      );
      expect(before.links.limit).toBe(5);
      expect(before.links.remaining).toBe(
        Math.max(0, 5 - before.links.consumed),
      );
      const other = await ensurePersonalWorkspace(db, {
        id: new ObjectId().toHexString(),
        name: "Usage isolation",
      });
      const foreign = await createLink(
        {
          ...ctx,
          workspace: other,
          actor: { userId: other.ownerUserId, role: "owner" },
        },
        { url: "https://example.com/foreign-usage" },
      );
      expect(foreign.ok).toBe(true);
      const after = usageSchema.parse(
        await (await request("/v1/workspace/usage", allowed.secret)).json(),
      );
      expect(after).toEqual(before);
      const filter = {
        workspaceId: ctx.workspace._id,
        userId: ctx.actor.userId,
      };
      try {
        await collection(db, "workspace_members").updateOne(filter, {
          $set: { role: "viewer" },
        });
        expect(
          z
            .object({ role: z.string() })
            .parse(
              await (await request("/v1/workspace", allowed.secret)).json(),
            ).role,
        ).toBe("viewer");
        expect(
          (await request("/v1/workspace/usage", allowed.secret)).status,
        ).toBe(200);
      } finally {
        await collection(db, "workspace_members").updateOne(filter, {
          $set: { role: "owner" },
        });
      }
      await revokeApiKey(ctx, allowed.key.id);
      expect(
        (await request("/v1/workspace/usage", allowed.secret)).status,
      ).toBe(401);
    });
    test("pagination and validation are bounded and OpenAPI lists implemented contracts", async () => {
      const created = await key(["links:read", "links:write"]);
      const first = await request("/v1/links?limit=1", created.secret);
      const pageSchema = z.object({
        items: z.array(linkResponse),
        nextCursor: z.string(),
      });
      const page = pageSchema.parse(await first.json());
      const next = await request(
        `/v1/links?limit=1&cursor=${page.nextCursor}`,
        created.secret,
      );
      expect(
        z.object({ items: z.array(linkResponse) }).parse(await next.json())
          .items[0]?.id,
      ).not.toBe(page.items[0]?.id);
      expect(
        (await request("/v1/links?limit=201", created.secret)).status,
      ).toBe(400);
      expect(
        (await request("/v1/links?cursor=bad", created.secret)).status,
      ).toBe(400);
      expect(
        (
          await request("/v1/links", created.secret, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{",
          })
        ).status,
      ).toBe(400);
      const spec = z
        .object({
          openapi: z.string(),
          paths: z.record(z.string(), z.record(z.string(), z.unknown())),
        })
        .parse(await (await request("/openapi.json")).json());
      expect(spec.openapi).toBe("3.1.0");
      expect(Object.keys(spec.paths["/v1/tags"]!)).toEqual(["get", "post"]);
      expect(Object.keys(spec.paths["/v1/tags/{id}"]!).sort()).toEqual([
        "delete",
        "get",
        "patch",
      ]);
      expect(Object.keys(spec.paths["/v1/qr-codes"]!)).toEqual(["get", "post"]);
      expect(Object.keys(spec.paths["/v1/qr-codes/{id}"]!).sort()).toEqual([
        "delete",
        "get",
        "patch",
      ]);
      expect(Object.keys(spec.paths["/v1/links"]!)).toEqual(["get", "post"]);
      expect(Object.keys(spec.paths["/v1/links/{id}"]!).sort()).toEqual([
        "delete",
        "get",
        "patch",
      ]);
      expect(Object.keys(spec.paths["/v1/links/{id}/restore"]!)).toEqual([
        "post",
      ]);
      expect(
        Object.keys(spec.paths["/v1/links/by-key/{domain}/{key}"]!),
      ).toEqual(["get"]);
      expect(Object.keys(spec.paths["/v1/links/by-key"]!)).toEqual(["get"]);
      expect(Object.keys(spec.paths["/v1/workspace"]!)).toEqual(["get"]);
      expect(Object.keys(spec.paths["/v1/workspace/usage"]!)).toEqual(["get"]);
      expect(Object.keys(spec.paths["/v1/campaigns"]!)).toEqual([
        "get",
        "post",
      ]);
      expect(Object.keys(spec.paths["/v1/campaigns/{id}"]!)).toEqual([
        "get",
        "patch",
        "delete",
      ]);
      expect((await request("/docs")).status).toBe(200);
    });
    test("campaign CRUD intersects live roles/scopes and checks permissions before replay", async () => {
      const owner = await key(["campaigns:read", "campaigns:write"]),
        reader = await key(["campaigns:read"]);
      const send = (title: string, token?: string): RequestInit => ({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Idempotency-Key": token } : {}),
        },
        body: JSON.stringify({ title }),
      });
      expect(
        (await request("/v1/campaigns", reader.secret, send("Denied"))).status,
      ).toBe(403);
      expect(
        (await request("/v1/campaigns", owner.secret, send("Free plan")))
          .status,
      ).toBe(403);
      const subscriptionId = new ObjectId();
      await collection(db, "subscriptions").insertOne({
        _id: subscriptionId,
        workspaceId: ctx.workspace._id,
        polarSubscriptionId: crypto.randomUUID(),
        polarCustomerId: "local",
        productId: "local",
        status: "active",
        plan: "plus",
        currentPeriodStart: new Date(Date.now() - 86_400_000),
        currentPeriodEnd: new Date(Date.now() + 29 * 86_400_000),
        cancelAtPeriodEnd: false,
      });
      const memberFilter = {
        workspaceId: ctx.workspace._id,
        userId: ctx.actor.userId,
      };
      try {
        const response = await request(
          "/v1/campaigns",
          owner.secret,
          send("API campaign", "campaign-create"),
        );
        expect(response.status).toBe(201);
        const schema = z.object({
          id: z.string(),
          title: z.string(),
          description: z.string().nullable(),
          linkCount: z.number(),
          utmDefaults: z.object({ sources: z.array(z.string()) }),
        });
        const created = schema.parse(await response.json()),
          path = `/v1/campaigns/${created.id}`;
        expect(response.headers.get("Location")).toBe(path);
        const replay = await request(
          "/v1/campaigns",
          owner.secret,
          send("API campaign", "campaign-create"),
        );
        expect(replay.headers.get("Idempotency-Replayed")).toBe("true");
        expect(schema.parse(await replay.json()).id).toBe(created.id);
        expect((await request(path, reader.secret)).status).toBe(200);
        expect(
          (await request("/v1/campaigns", owner.secret, send("API campaign")))
            .status,
        ).toBe(409);
        await collection(db, "api_keys").updateOne(
          { _id: new ObjectId(owner.key.id) },
          { $set: { scopes: ["campaigns:read"] } },
        );
        expect(
          (
            await request(
              "/v1/campaigns",
              owner.secret,
              send("API campaign", "campaign-create"),
            )
          ).status,
        ).toBe(403);
        await collection(db, "api_keys").updateOne(
          { _id: new ObjectId(owner.key.id) },
          { $set: { scopes: ["campaigns:read", "campaigns:write"] } },
        );

        const patch: RequestInit = {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: "Updated",
            utmDefaults: {
              sources: ["NEWSLETTER", "newsletter"],
              mediums: [],
              terms: [],
              contents: [],
            },
          }),
        };
        expect((await request(path, reader.secret, patch)).status).toBe(403);
        const updated = schema.parse(
          await (await request(path, owner.secret, patch)).json(),
        );
        expect(updated.description).toBe("Updated");
        expect(updated.utmDefaults.sources).toEqual(["newsletter"]);
        await collection(db, "workspace_members").updateOne(memberFilter, {
          $set: { role: "viewer" },
        });
        expect(
          (
            await request(
              "/v1/campaigns",
              owner.secret,
              send("API campaign", "campaign-create"),
            )
          ).status,
        ).toBe(403);
        expect((await request(path, owner.secret, patch)).status).toBe(403);
        expect(
          (await request(path, owner.secret, { method: "DELETE" })).status,
        ).toBe(403);
        expect((await request(path, owner.secret)).status).toBe(200);
        await collection(db, "workspace_members").updateOne(memberFilter, {
          $set: { role: "owner" },
        });
        const other = await ensurePersonalWorkspace(db, {
          id: new ObjectId().toHexString(),
          name: "Campaign isolation",
        });
        const foreignId = new ObjectId();
        await collection(db, "campaigns").insertOne({
          _id: foreignId,
          workspaceId: other._id,
          title: "Foreign campaign",
          links: [],
        });
        expect(
          (await request(`/v1/campaigns/${foreignId}`, owner.secret)).status,
        ).toBe(404);
        expect(
          (await request(`/v1/campaigns/${foreignId}`, owner.secret, patch))
            .status,
        ).toBe(404);
        expect(
          (
            await request(`/v1/campaigns/${foreignId}`, owner.secret, {
              method: "DELETE",
            })
          ).status,
        ).toBe(204);
        expect(
          await collection(db, "campaigns").countDocuments({ _id: foreignId }),
        ).toBe(1);
        expect(
          (await request(path, owner.secret, { method: "DELETE" })).status,
        ).toBe(204);
        expect((await request(path, owner.secret)).status).toBe(404);
      } finally {
        await collection(db, "workspace_members").updateOne(memberFilter, {
          $set: { role: "owner" },
        });
        await collection(db, "subscriptions").deleteOne({
          _id: subscriptionId,
        });
      }
    });
    test("campaign listing stays bounded for a thousand-record library and treats search literally", async () => {
      const reader = await key(["campaigns:read"]);
      const ids = Array.from({ length: 1001 }, () => new ObjectId());
      await collection(db, "campaigns").insertMany(
        ids.map((_id, i) => ({
          _id,
          workspaceId: ctx.workspace._id,
          title: i === 1000 ? "Large [launch]" : `Large campaign ${i}`,
          links:
            i === 1000
              ? Array.from({ length: 2000 }, () => new ObjectId())
              : [],
        })),
      );
      const pageSchema = z.object({
        items: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            linkCount: z.number(),
          }),
        ),
        total: z.number().nullable(),
        nextCursor: z.string().nullable(),
      });
      try {
        const firstResponse = await request(
          "/v1/campaigns?limit=25",
          reader.secret,
        );
        const raw = await firstResponse.text(),
          first = pageSchema.parse(JSON.parse(raw));
        expect(first.items).toHaveLength(25);
        expect(first.total).toBe(1001);
        expect(first.items[0]?.linkCount).toBe(2000);
        expect(raw).not.toContain('"links":');
        expect(raw.length).toBeLessThan(10_000);
        const second = pageSchema.parse(
          await (
            await request(
              `/v1/campaigns?limit=25&cursor=${first.nextCursor}`,
              reader.secret,
            )
          ).json(),
        );
        expect(second.items).toHaveLength(25);
        expect(second.total).toBeNull();
        expect(
          second.items.some((item) =>
            first.items.some((previous) => previous.id === item.id),
          ),
        ).toBe(false);
        const search = pageSchema.parse(
          await (
            await request("/v1/campaigns?search=%5Blaunch%5D", reader.secret)
          ).json(),
        );
        expect(search.items.map((item) => item.title)).toEqual([
          "Large [launch]",
        ]);
        expect(
          (await request("/v1/campaigns?limit=201", reader.secret)).status,
        ).toBe(400);
        expect(
          (await request("/v1/campaigns?cursor=bad", reader.secret)).status,
        ).toBe(400);
      } finally {
        await collection(db, "campaigns").deleteMany({ _id: { $in: ids } });
      }
    });
    test("link deletion, trash browsing, and restore enforce live authorization before replay", async () => {
      const workspace = await ensurePersonalWorkspace(db, {
        id: new ObjectId().toHexString(),
        name: "REST trash",
      });
      await collection(db, "workspaces").updateOne(
        { _id: workspace._id },
        { $set: { platformFeatures: { api: true } } },
      );
      const local = {
        ...ctx,
        workspace,
        actor: { userId: workspace.ownerUserId, role: "owner" as const },
      };
      async function localKey(scopes: ApiScope[]) {
        const result = await createApiKey(
          local,
          { name: "Trash contract", scopes },
          pepper,
        );
        if (!result.ok) throw new Error(result.error);
        keyIds.push(result.value.key.id);
        return result.value;
      }
      const owner = await localKey(["links:read", "links:write"]),
        reader = await localKey(["links:read"]);
      const made = await createLink(local, {
        url: "https://example.com/trash",
      });
      if (!made.ok) throw new Error(made.error);
      const link = made.value,
        path = `/v1/links/${link.id}`,
        restorePath = `${path}/restore`;
      expect(
        (await request(`/v1/links/by-key/shortn.at/${link.key}`, reader.secret))
          .status,
      ).toBe(200);
      expect(
        (await request(path, reader.secret, { method: "DELETE" })).status,
      ).toBe(403);
      expect(
        (await request(path, owner.secret, { method: "DELETE" })).status,
      ).toBe(204);
      expect((await request(path, owner.secret)).status).toBe(404);
      expect(
        (await request(`/v1/links/by-key/shortn.at/${link.key}`, reader.secret))
          .status,
      ).toBe(404);
      const page = z
        .object({
          items: z.array(
            z.object({
              id: z.string(),
              deletedAt: z.iso.datetime(),
              restoreUntil: z.iso.datetime(),
            }),
          ),
        })
        .parse(
          await (await request("/v1/links?trash=true", reader.secret)).json(),
        );
      expect(page.items.map((item) => item.id)).toEqual([link.id]);
      expect(
        new Date(page.items[0]!.restoreUntil).getTime() -
          new Date(page.items[0]!.deletedAt).getTime(),
      ).toBe(30 * 86_400_000);
      expect(
        z
          .object({ items: z.array(z.unknown()) })
          .parse(await (await request("/v1/links", reader.secret)).json())
          .items,
      ).toEqual([]);
      const restore: RequestInit = {
        method: "POST",
        headers: { "Idempotency-Key": "restore-link" },
      };
      expect((await request(restorePath, reader.secret, restore)).status).toBe(
        403,
      );
      expect((await request(restorePath, owner.secret, restore)).status).toBe(
        200,
      );
      expect(
        (await request(restorePath, owner.secret, restore)).headers.get(
          "Idempotency-Replayed",
        ),
      ).toBe("true");
      const member = {
        workspaceId: workspace._id,
        userId: workspace.ownerUserId,
      };
      await collection(db, "workspace_members").updateOne(member, {
        $set: { role: "viewer" },
      });
      expect((await request(restorePath, owner.secret, restore)).status).toBe(
        403,
      );
      await collection(db, "workspace_members").updateOne(member, {
        $set: { role: "member" },
      });
      await collection(db, "links").updateOne(
        { _id: new ObjectId(link.id) },
        { $set: { createdBy: "another-user" } },
      );
      expect((await request(restorePath, owner.secret, restore)).status).toBe(
        403,
      );
      await collection(db, "workspace_members").updateOne(member, {
        $set: { role: "owner" },
      });
      await collection(db, "api_keys").updateOne(
        { _id: new ObjectId(owner.key.id) },
        { $set: { scopes: ["links:read"] } },
      );
      expect((await request(restorePath, owner.secret, restore)).status).toBe(
        403,
      );
      await collection(db, "api_keys").updateOne(
        { _id: new ObjectId(owner.key.id) },
        { $set: { scopes: ["links:read", "links:write"] } },
      );
      await collection(db, "links").updateOne(
        { _id: new ObjectId(link.id) },
        { $set: { deletedAt: new Date(Date.now() - 30 * 86_400_000) } },
      );
      expect(
        (await request(restorePath, owner.secret, { method: "POST" })).status,
      ).toBe(404);
      expect(
        (
          await request(
            `${path}/restore`,
            (await key(["links:write"])).secret,
            { method: "POST" },
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await request(path, (await key(["links:write"])).secret, {
            method: "DELETE",
          })
        ).status,
      ).toBe(204);
      expect(
        await collection(db, "links").countDocuments({
          _id: new ObjectId(link.id),
        }),
      ).toBe(1);
    });
    test("analytics shares core semantics with scope-only keys, live roles, retention and tenant isolation", async () => {
      const { local } = await qrFixture();
      const own = await createLink(local, {
        url: "https://example.com/analytics",
      });
      const { local: foreign } = await qrFixture();
      const other = await createLink(foreign, {
        url: "https://example.com/foreign-analytics",
      });
      if (!own.ok || !other.ok) throw new Error("analytics fixture");
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + 86400000);
      const event = (
        workspaceId: ObjectId,
        linkId: string,
        kind: string,
        country: string,
        ipHash: string,
      ) => ({
        ts: new Date(start.getTime() + 3600000),
        m: { workspaceId, linkId: new ObjectId(linkId), kind },
        country,
        device: "mobile",
        ipHash,
      });
      await db
        .collection(physicalNames.click_events)
        .insertMany([
          event(local.workspace._id, own.value.id, "click", "PT", "a"),
          event(local.workspace._id, own.value.id, "scan", "ES", "b"),
          event(foreign.workspace._id, other.value.id, "click", "PT", "c"),
        ]);
      const token = await createApiKey(
        local,
        { name: "Analytics", scopes: ["analytics:read"] },
        pepper,
      );
      if (!token.ok) throw new Error(token.error);
      keyIds.push(token.value.key.id);
      const secret = token.value.secret;
      const query = `?from=${start.toISOString()}&to=${end.toISOString()}&groupBy=country&timezone=Europe/Lisbon`;
      const workspaceResponse = await request(`/v1/analytics${query}`, secret);
      expect(workspaceResponse.status).toBe(200);
      const shape = z.object({
        totals: z.object({
          clicks: z.number(),
          scans: z.number(),
          uniques: z.number(),
        }),
        breakdowns: z.record(
          z.string(),
          z.array(
            z.object({
              value: z.string(),
              clicks: z.number(),
              scans: z.number(),
            }),
          ),
        ),
        gated: z.array(z.string()),
        series: z.array(z.object({ t: z.iso.datetime() })),
        range: z.object({ clampedFrom: z.string().nullable() }),
      });
      const body = shape.parse(await workspaceResponse.json());
      expect(body.totals).toEqual({ clicks: 1, scans: 1, uniques: 2 });
      expect(body.breakdowns.country).toEqual(
        [
          { value: "ES", clicks: 0, scans: 1 },
          { value: "PT", clicks: 1, scans: 0 },
        ].sort((a, b) => b.clicks - a.clicks),
      );
      expect(body.series.length).toBeLessThanOrEqual(2);
      const shared = await queryAnalytics(local, {
        from: start.toISOString(),
        to: end.toISOString(),
        timezone: "Europe/Lisbon",
        dimensions: ["country"],
      });
      expect(shared.ok).toBe(true);
      if (shared.ok) expect(shape.parse(shared.value)).toEqual(body);
      for (const filters of [
        { link: "invalid" },
        { kind: "invalid" },
        { rawIp: "x" },
      ])
        expect(
          await queryAnalytics(local, {
            from: start.toISOString(),
            to: end.toISOString(),
            filters,
          }),
        ).toEqual({ ok: false, error: "invalid_input" });
      const bounded = await request(
        `/v1/analytics?from=${start.toISOString()}&to=${new Date(start.getTime() + 100 * 86400000).toISOString()}&interval=hour`,
        secret,
      );
      expect(bounded.status).toBe(400);
      const spec = z
        .object({
          paths: z.record(
            z.string(),
            z.object({
              get: z
                .object({
                  parameters: z
                    .array(z.object({ name: z.string() }))
                    .default([]),
                })
                .optional(),
            }),
          ),
        })
        .parse(await (await request("/openapi.json")).json());
      for (const path of ["/v1/analytics", "/v1/links/{id}/analytics"]) {
        const params = spec.paths[path]?.get?.parameters.map((p) => p.name);
        expect(params).toContain("groupBy");
        expect(params).toContain("country");
        expect(params).toContain("timezone");
      }

      const linkPath = `/v1/links/${own.value.id}/analytics${query}`;
      expect((await request(linkPath, secret)).status).toBe(200);
      const filtered = shape.parse(
        await (
          await request(`/v1/analytics${query}&country=PT`, secret)
        ).json(),
      );
      expect(filtered.totals).toEqual({ clicks: 1, scans: 0, uniques: 1 });
      const narrowed = shape.parse(
        await (
          await request(`${linkPath}&kind=scan&link=${other.value.id}`, secret)
        ).json(),
      );
      expect(narrowed.totals.clicks + narrowed.totals.scans).toBe(0);
      expect(
        (await request(`/v1/links/${other.value.id}/analytics${query}`, secret))
          .status,
      ).toBe(404);
      expect(
        (
          await request(
            `/v1/analytics${query}`,
            (await key(["links:read"])).secret,
          )
        ).status,
      ).toBe(403);
      expect(
        (await request(linkPath, (await key(["links:read"])).secret)).status,
      ).toBe(403);
      await collection(db, "workspace_members").updateOne(
        { workspaceId: local.workspace._id, userId: local.actor.userId },
        { $set: { role: "viewer" } },
      );
      expect((await request(linkPath, secret)).status).toBe(200);
      await collection(db, "subscriptions").deleteMany({
        workspaceId: local.workspace._id,
      });
      const free = shape.parse(
        await (await request(`/v1/analytics${query}`, secret)).json(),
      );
      expect(free.gated).toEqual(["country"]);
      expect(free.breakdowns.country).toBeUndefined();
      const oldQuery = `?from=2020-01-01T00:00:00Z&to=2020-01-02T00:00:00Z`;
      const old = shape.parse(
        await (await request(`/v1/analytics${oldQuery}`, secret)).json(),
      );
      expect(old.range.clampedFrom).not.toBeNull();
      expect(old.totals).toEqual({ clicks: 0, scans: 0, uniques: 0 });
      expect(old.series).toEqual([]);
      for (const suffix of [
        "&timezone=NoSuchZone",
        "&interval=minute",
        "&groupBy=rawIp",
        "&kind=other",
        "&link=bad",
        "&limit=1001",
      ]) {
        const response = await request(
          `/v1/analytics${query}${suffix}`,
          secret,
        );
        expect(response.status).toBe(400);
        expect(response.headers.get("Content-Type")).toContain(
          "application/problem+json",
        );
      }
      expect(
        (
          await request(
            `/v1/analytics?from=${end.toISOString()}&to=${start.toISOString()}`,
            secret,
          )
        ).status,
      ).toBe(400);
      expect(
        (
          await request(
            `/v1/analytics?from=2020-01-01T00:00:00Z&to=2099-01-01T00:00:00Z&interval=hour`,
            secret,
          )
        ).status,
      ).toBe(400);
      await revokeApiKey(local, token.value.key.id);
      expect((await request(linkPath, secret)).status).toBe(401);
    });
    test("domain REST intersects owner permissions and scopes before replay, respects rollout and isolates paginated status", async () => {
      const { local, makeKey } = await qrFixture();
      await db
        .collection(physicalNames.domains)
        .createIndexes(desiredIndexes[physicalNames.domains]!);
      const writer = await makeKey(["domains:write"]);
      const reader = await makeKey(["domains:read"]);
      const both = await makeKey(["domains:read", "domains:write"]);
      const denied = await makeKey(["links:read"]);
      const domainApp = (enabled: boolean) =>
        createRestApi({
          db,
          cache,
          durable: cache,
          pepper,
          linkDomain: "shortn.at",
          rolloutPercent: 0,
          domainWrites: enabled,
          clientIp: () => "192.0.2.1",
          log: (_message, error) => {
            unexpectedErrors.push(error);
          },
        });
      const enabled = domainApp(true),
        disabled = domainApp(false);
      const domainRequest = (
        path: string,
        secret: string,
        init: RequestInit = {},
        target = enabled,
      ) => {
        const headers = new Headers(init.headers);
        headers.set("Authorization", `Bearer ${secret}`);
        return target.request(path, { ...init, headers });
      };
      const create = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "domain-create",
        },
        body: JSON.stringify({ hostname: "API.Example.com", kind: "links" }),
      };
      expect(
        (await domainRequest("/v1/domains", writer.secret, create, disabled))
          .status,
      ).toBe(403);
      expect(
        (await domainRequest("/v1/domains", reader.secret, create)).status,
      ).toBe(403);
      expect((await domainRequest("/v1/domains", denied.secret)).status).toBe(
        403,
      );
      expect((await domainRequest("/v1/domains", writer.secret)).status).toBe(
        403,
      );
      // The paid plan alone does not include a hostname slot.
      expect(
        (
          await domainRequest("/v1/domains", writer.secret, {
            ...create,
            headers: { "Content-Type": "application/json" },
          })
        ).status,
      ).toBe(403);
      await db.collection(physicalNames.domain_addons).insertOne({
        workspaceId: local.workspace._id,
        polarSubscriptionId: crypto.randomUUID(),
        status: "active",
      });
      const created = await domainRequest("/v1/domains", writer.secret, create);
      expect(created.status).toBe(201);
      const id = z.object({ id: z.string() }).parse(await created.json()).id;
      expect(created.headers.get("Location")).toBe(`/v1/domains/${id}/status`);
      const replay = await domainRequest("/v1/domains", writer.secret, create);
      expect(replay.status).toBe(201);
      expect(replay.headers.get("Idempotency-Replayed")).toBe("true");
      expect(
        await db
          .collection(physicalNames.domains)
          .countDocuments({ workspaceId: local.workspace._id }),
      ).toBe(1);

      for (const body of [
        { hostname: "shortn.at", kind: "links" },
        { hostname: "https://example.com", kind: "links" },
        {
          hostname: "bad.example.com",
          kind: "bio",
          bioPageId: new ObjectId().toHexString(),
        },
        {
          hostname: "bad.example.com",
          kind: "links",
          rootRedirect: "javascript:alert(1)",
        },
      ]) {
        expect(
          (
            await domainRequest("/v1/domains", writer.secret, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            })
          ).status,
        ).toBe(400);
      }
      expect(
        await db
          .collection(physicalNames.domains)
          .countDocuments({ workspaceId: local.workspace._id }),
      ).toBe(1);
      await db.collection(physicalNames.domain_addons).insertOne({
        workspaceId: local.workspace._id,
        polarSubscriptionId: crypto.randomUUID(),
        status: "active",
      });
      expect(
        (
          await domainRequest("/v1/domains", writer.secret, {
            ...create,
            headers: { "Content-Type": "application/json" },
          })
        ).status,
      ).toBe(409);
      const foreignWriter = await key(["domains:write"]);
      expect(
        (
          await domainRequest(`/v1/domains/${id}`, foreignWriter.secret, {
            method: "DELETE",
          })
        ).status,
      ).toBe(404);
      const memberQuery = {
        workspaceId: local.workspace._id,
        userId: local.actor.userId,
      };
      await collection(db, "workspace_members").updateOne(memberQuery, {
        $set: { role: "admin" },
      });
      expect(
        (await domainRequest("/v1/domains", writer.secret, create)).status,
      ).toBe(403);
      expect(
        (
          await domainRequest(`/v1/domains/${id}`, both.secret, {
            method: "DELETE",
          })
        ).status,
      ).toBe(403);
      await collection(db, "workspace_members").updateOne(memberQuery, {
        $set: { role: "viewer" },
      });
      const status = await domainRequest(
        `/v1/domains/${id}/status`,
        reader.secret,
      );
      expect(status.status).toBe(200);
      const statusBody = z
        .object({
          id: z.string(),
          hostname: z.string(),
          status: z.string(),
          createdAt: z.iso.datetime(),
        })
        .parse(await status.json());
      expect(statusBody.hostname).toBe("api.example.com");
      expect(statusBody.status).toBe("pending");
      expect(
        (await domainRequest(`/v1/domains/${id}/status`, writer.secret)).status,
      ).toBe(403);
      expect(
        (
          await request(
            `/v1/domains/${id}/status`,
            (await key(["domains:read"])).secret,
          )
        ).status,
      ).toBe(404);
      await collection(db, "workspace_members").updateOne(memberQuery, {
        $set: { role: "owner" },
      });
      expect(
        (await domainRequest("/v1/domains", writer.secret, create, disabled))
          .status,
      ).toBe(403);
      const before = await domainRequest(
        `/v1/domains/${id}/status`,
        both.secret,
      );
      expect(await before.text()).not.toContain("addonSubscriptionId");
      expect(
        (
          await domainRequest(`/v1/domains/${id}`, reader.secret, {
            method: "DELETE",
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await domainRequest(
            `/v1/domains/${id}`,
            writer.secret,
            { method: "DELETE" },
            disabled,
          )
        ).status,
      ).toBe(204);
      const removed = z
        .object({ status: z.string(), removing: z.boolean() })
        .parse(
          await (
            await domainRequest(`/v1/domains/${id}/status`, reader.secret)
          ).json(),
        );
      expect(removed).toEqual({ status: "disabled", removing: true });
      await db.collection(physicalNames.domains).insertMany(
        Array.from({ length: 1001 }, (_, i) => ({
          workspaceId: local.workspace._id,
          hostname: `library-${i}.example.com`,
          kind: "links",
          status: "pending",
          createdAt: new Date(),
        })),
      );
      const literal = new ObjectId();
      await db.collection(physicalNames.domains).insertMany([
        {
          _id: literal,
          workspaceId: local.workspace._id,
          hostname: "literal[abc].example.com",
          kind: "links",
          status: "pending",
        },
        {
          workspaceId: ctx.workspace._id,
          hostname: "foreign.example.com",
          kind: "links",
          status: "pending",
        },
      ]);
      const pageSchema = z.object({
        items: z.array(z.object({ id: z.string(), hostname: z.string() })),
        nextCursor: z.string().nullable(),
      });
      const first = pageSchema.parse(
        await (
          await domainRequest("/v1/domains?limit=25", reader.secret)
        ).json(),
      );
      expect(first.items).toHaveLength(25);
      expect(
        first.items.some((d) => d.hostname === "foreign.example.com"),
      ).toBe(false);
      const second = pageSchema.parse(
        await (
          await domainRequest(
            `/v1/domains?limit=25&cursor=${first.nextCursor}`,
            reader.secret,
          )
        ).json(),
      );
      expect(second.items).toHaveLength(25);
      expect(
        second.items.some((d) =>
          first.items.some((prior) => prior.id === d.id),
        ),
      ).toBe(false);
      const search = pageSchema.parse(
        await (
          await domainRequest("/v1/domains?search=%5Babc%5D", reader.secret)
        ).json(),
      );
      expect(search.items.map((d) => d.id)).toEqual([literal.toHexString()]);
      expect(
        (await domainRequest("/v1/domains?limit=201", reader.secret)).status,
      ).toBe(400);
      expect(
        (await domainRequest("/v1/domains?cursor=bad", reader.secret)).status,
      ).toBe(400);
      await revokeApiKey(local, reader.key.id);
      expect(
        (await domainRequest(`/v1/domains/${id}/status`, reader.secret)).status,
      ).toBe(401);
    });
    test("bio REST shares draft validation and publication, protects revisions and tenant boundaries, and paginates large libraries", async () => {
      const { local, makeKey } = await qrFixture();
      await db
        .collection(physicalNames.bio_pages)
        .createIndexes(desiredIndexes[physicalNames.bio_pages]!);
      await db
        .collection(physicalNames.bio_page_versions)
        .createIndexes(desiredIndexes[physicalNames.bio_page_versions]!);
      await db
        .collection(physicalNames.bio_delivery_jobs)
        .createIndexes(desiredIndexes[physicalNames.bio_delivery_jobs]!);
      const writer = await makeKey(["bio:write"]),
        reader = await makeKey(["bio:read"]),
        both = await makeKey(["bio:*"]);
      const denied = await makeKey(["links:read"]);
      const json = (
        body: unknown,
        method = "POST",
        idempotency?: string,
      ): RequestInit => ({
        method,
        headers: {
          "Content-Type": "application/json",
          ...(idempotency ? { "Idempotency-Key": idempotency } : {}),
        },
        body: JSON.stringify(body),
      });
      const input = { slug: "bio-http", title: "Bio [literal]" };
      expect(
        (await request("/v1/bio-pages", reader.secret, json(input))).status,
      ).toBe(403);
      expect((await request("/v1/bio-pages", writer.secret)).status).toBe(403);
      expect((await request("/v1/bio-pages", denied.secret)).status).toBe(403);
      const created = await request(
        "/v1/bio-pages",
        writer.secret,
        json(input, "POST", "bio-create"),
      );
      expect(created.status).toBe(201);
      const summary = z.object({
        id: z.string(),
        slug: z.string(),
        title: z.string(),
        updatedAt: z.iso.datetime(),
        linkCount: z.number(),
      });
      const page = summary.parse(await created.json());
      const path = `/v1/bio-pages/${page.id}`;
      expect(created.headers.get("Location")).toBe(path);
      expect(
        (
          await request(
            "/v1/bio-pages",
            writer.secret,
            json(input, "POST", "bio-create"),
          )
        ).status,
      ).toBe(201);
      expect(
        await db
          .collection(physicalNames.bio_pages)
          .countDocuments({ workspaceId: local.workspace._id }),
      ).toBe(1);
      expect(
        (await request("/v1/bio-pages", writer.secret, json(input))).status,
      ).toBe(409);
      const draftSchema = z.object({
        id: z.string(),
        revision: z.number(),
        publishedRevision: z.number(),
        published: z.boolean(),
        content: bioContentSchema,
      });
      const initial = draftSchema.parse(
        await (await request(path, reader.secret)).json(),
      );
      expect(initial.revision).toBe(0);
      expect(initial.published).toBe(false);
      const typed = createShortnClient({
        apiKey: reader.secret,
        baseUrl: "http://localhost",
        fetch: async (request) => app.request(request),
      });
      const typedDraft = await typed.GET("/v1/bio-pages/{id}", {
        params: { path: { id: page.id } },
      });
      expect(typedDraft.response.status).toBe(200);
      expect(typedDraft.data?.revision).toBe(initial.revision);
      expect(bioContentSchema.parse(typedDraft.data?.content)).toEqual(
        initial.content,
      );

      expect((await request(path, writer.secret)).status).toBe(403);
      const firstContent = {
        ...initial.content,
        locale: "pt",
        hideBranding: true,
        seo: {
          ...initial.content.seo,
          title: "SEO title",
          description: "Keep this",
          noindex: true,
        },
      };
      expect(
        (
          await request(
            path,
            reader.secret,
            json({ revision: 0, content: firstContent }, "PATCH"),
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await request(
            path,
            writer.secret,
            json({ revision: 0, content: firstContent }, "PATCH"),
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await request(
            path,
            writer.secret,
            json({ revision: 0, content: { locale: "es" } }, "PATCH"),
          )
        ).status,
      ).toBe(409);
      const second = await request(
        path,
        writer.secret,
        json(
          {
            revision: 1,
            content: {
              theme: { density: "compact" },
              seo: { title: "Changed" },
            },
          },
          "PATCH",
        ),
      );
      expect(second.status).toBe(200);
      const draft = draftSchema.parse(
        await (await request(path, reader.secret)).json(),
      );
      expect(draft.revision).toBe(2);
      expect(draft.content.locale).toBe("pt");
      expect(draft.content.hideBranding).toBe(true);
      expect(draft.content.seo).toEqual({
        ...firstContent.seo,
        title: "Changed",
      });
      expect(draft.content.theme).toEqual({
        ...initial.content.theme,
        density: "compact",
      });
      expect(draft.published).toBe(false);
      for (const content of [
        {},
        { unknown: true },
        { blocks: [] },
        {
          blocks: [
            ...draft.content.blocks,
            {
              id: "unsafe",
              type: "image",
              url: "javascript:alert(1)",
              alt: "",
            },
          ],
        },
      ])
        expect(
          (
            await request(
              path,
              writer.secret,
              json({ revision: 2, content }, "PATCH"),
            )
          ).status,
        ).toBe(400);
      const ownLink = await createLink(local, {
        url: "https://example.com/bio-owned",
      });
      const { local: foreign, makeKey: foreignKey } = await qrFixture();
      const foreignLink = await createLink(foreign, {
        url: "https://example.com/bio-foreign",
      });
      if (!ownLink.ok || !foreignLink.ok) throw new Error("bio links fixture");
      const linkBlock = (id: string) => ({
        id: "owned-link",
        type: "link",
        linkId: id,
        title: "Visit",
      });
      expect(
        (
          await request(
            "/v1/bio-pages",
            writer.secret,
            json({ slug: "foreign-attachment", linkId: foreignLink.value.id }),
          )
        ).status,
      ).toBe(400);
      expect(
        (
          await request(
            path,
            writer.secret,
            json(
              {
                revision: 2,
                content: {
                  blocks: [
                    ...draft.content.blocks,
                    linkBlock(foreignLink.value.id),
                  ],
                },
              },
              "PATCH",
            ),
          )
        ).status,
      ).toBe(400);
      const attached = await request(
        path,
        writer.secret,
        json(
          {
            revision: 2,
            content: {
              blocks: [...draft.content.blocks, linkBlock(ownLink.value.id)],
            },
          },
          "PATCH",
        ),
      );
      expect(attached.status).toBe(200);
      const publication = json({ revision: 3 }, "POST", "bio-publish");
      expect(
        (await request(`${path}/publish`, reader.secret, publication)).status,
      ).toBe(403);
      expect(
        (await request(`${path}/publish`, writer.secret, json({ revision: 2 })))
          .status,
      ).toBe(409);
      expect(
        (await request(`${path}/publish`, writer.secret, publication)).status,
      ).toBe(200);
      expect(
        (
          await request(`${path}/publish`, writer.secret, publication)
        ).headers.get("Idempotency-Replayed"),
      ).toBe("true");
      const published = draftSchema.parse(
        await (await request(path, reader.secret)).json(),
      );
      expect(published.published).toBe(true);
      expect(published.publishedRevision).toBe(3);
      expect(
        await db
          .collection(physicalNames.bio_page_versions)
          .countDocuments({ bioPageId: new ObjectId(page.id) }),
      ).toBe(1);
      expect(
        await db
          .collection(physicalNames.bio_delivery_jobs)
          .countDocuments({ bioPageId: new ObjectId(page.id) }),
      ).toBe(1);
      const foreignRead = await foreignKey(["bio:read", "bio:write"]);
      expect((await request(path, foreignRead.secret)).status).toBe(404);
      expect(
        (
          await request(
            path,
            foreignRead.secret,
            json({ revision: 3, content: { locale: "es" } }, "PATCH"),
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await request(
            `${path}/publish`,
            foreignRead.secret,
            json({ revision: 3 }),
          )
        ).status,
      ).toBe(404);
      await collection(db, "api_keys").updateOne(
        { _id: new ObjectId(writer.key.id) },
        { $set: { scopes: ["bio:read"] } },
      );
      expect(
        (
          await request(
            "/v1/bio-pages",
            writer.secret,
            json(input, "POST", "bio-create"),
          )
        ).status,
      ).toBe(403);
      expect(
        (await request(`${path}/publish`, writer.secret, publication)).status,
      ).toBe(403);
      await collection(db, "api_keys").updateOne(
        { _id: new ObjectId(writer.key.id) },
        { $set: { scopes: ["bio:write"] } },
      );
      const concurrentCreate = await request(
        "/v1/bio-pages",
        writer.secret,
        json({ slug: "bio-concurrent" }),
      );
      expect(concurrentCreate.status).toBe(201);
      const concurrentId = summary.parse(await concurrentCreate.json()).id;
      const concurrentPath = `/v1/bio-pages/${concurrentId}`;
      const saves = await Promise.all(
        ["pt", "es"].map((locale) =>
          request(
            concurrentPath,
            writer.secret,
            json({ revision: 0, content: { locale } }, "PATCH"),
          ),
        ),
      );
      expect(saves.map((r) => r.status).sort()).toEqual([200, 409]);
      const concurrentDraft = draftSchema.parse(
        await (await request(concurrentPath, reader.secret)).json(),
      );
      expect(concurrentDraft.revision).toBe(1);
      expect(["pt", "es"]).toContain(concurrentDraft.content.locale);
      const member = {
        workspaceId: local.workspace._id,
        userId: local.actor.userId,
      };
      await collection(db, "workspace_members").updateOne(member, {
        $set: { role: "viewer" },
      });
      expect((await request(path, both.secret)).status).toBe(200);
      expect(
        (
          await request(
            "/v1/bio-pages",
            writer.secret,
            json(input, "POST", "bio-create"),
          )
        ).status,
      ).toBe(403);
      expect(
        (await request(`${path}/publish`, writer.secret, publication)).status,
      ).toBe(403);
      expect(
        (
          await request(
            path,
            writer.secret,
            json({ revision: 3, content: { locale: "es" } }, "PATCH"),
          )
        ).status,
      ).toBe(403);
      await collection(db, "workspace_members").updateOne(member, {
        $set: { role: "owner" },
      });
      // A downgrade preserves the current publication but refuses premium draft changes.
      await collection(db, "subscriptions").deleteMany({
        workspaceId: local.workspace._id,
      });
      await cache.del(`api:rate:${writer.key.id}`);
      expect(
        (
          await request(
            path,
            writer.secret,
            json({ revision: 3, content: { locale: "es" } }, "PATCH"),
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await request(
            "/v1/bio-pages",
            writer.secret,
            json({ slug: "over-quota" }),
          )
        ).status,
      ).toBe(409);
      expect(
        draftSchema.parse(await (await request(path, reader.secret)).json())
          .revision,
      ).toBe(3);
      const storedPublication = await db
        .collection(physicalNames.bio_pages)
        .findOne({ _id: new ObjectId(page.id) });
      expect(
        bioContentSchema.parse(storedPublication?.publishedContent),
      ).toEqual(published.content);
      const legacyOwner = `bio|${crypto.randomUUID()}`;
      await collection(db, "workspaces").updateOne(
        { _id: local.workspace._id },
        { $set: { legacySub: legacyOwner } },
      );
      await db.collection(physicalNames.bio_pages).insertMany(
        Array.from({ length: 1001 }, (_, i) => ({
          workspaceId: local.workspace._id,
          slug: `bio-library-${i}`,
          title: `Library ${i}`,
          links:
            i === 0
              ? Array.from({ length: 2000 }, () => ({ link: new ObjectId() }))
              : [],
          updatedAt: new Date(),
        })),
      );
      const legacyId = new ObjectId();
      await db.collection(physicalNames.bio_pages).insertMany([
        {
          _id: legacyId,
          userId: legacyOwner,
          slug: "legacy-bio",
          title: "Legacy [literal]",
          links: [],
        },
        {
          workspaceId: foreign.workspace._id,
          userId: legacyOwner,
          slug: "foreign-bio",
          title: "Foreign [literal]",
          links: [],
        },
      ]);
      const listSchema = z.object({
        items: z.array(summary),
        nextCursor: z.string().nullable(),
      });
      const first = listSchema.parse(
        await (await request("/v1/bio-pages?limit=25", reader.secret)).json(),
      );
      const next = listSchema.parse(
        await (
          await request(
            `/v1/bio-pages?limit=25&cursor=${first.nextCursor}`,
            reader.secret,
          )
        ).json(),
      );
      expect(first.items).toHaveLength(25);
      expect(next.items).toHaveLength(25);
      expect(
        next.items.some((item) =>
          first.items.some((prior) => prior.id === item.id),
        ),
      ).toBe(false);
      const found = listSchema.parse(
        await (
          await request("/v1/bio-pages?search=%5Bliteral%5D", reader.secret)
        ).json(),
      );
      expect(found.items.map((p) => p.id).sort()).toEqual(
        [page.id, legacyId.toHexString()].sort(),
      );
      expect(found.items.find((item) => item.id === page.id)?.linkCount).toBe(
        1,
      );
      const large = await request(
        "/v1/bio-pages?search=bio-library-0",
        reader.secret,
      );
      const raw = await large.text();
      expect(raw.length).toBeLessThan(1000);
      expect(listSchema.parse(JSON.parse(raw)).items[0]?.linkCount).toBe(2000);
      expect(raw).not.toContain("publishedContent");
      expect(raw).not.toContain("workspaceId");
      expect(
        (await request("/v1/bio-pages?limit=201", reader.secret)).status,
      ).toBe(400);
      expect(
        (await request("/v1/bio-pages?cursor=bad", reader.secret)).status,
      ).toBe(400);
      await revokeApiKey(local, reader.key.id);
      expect((await request(path, reader.secret)).status).toBe(401);
    });
    test("webhook REST protects metadata, encrypted secrets, durable tests and redelivery with live roles and scopes", async () => {
      const { local, makeKey } = await qrFixture();
      await collection(db, "workspaces").updateOne(
        { _id: local.workspace._id },
        { $set: { "platformFeatures.webhooks": true } },
      );
      const encryptionKey = "webhook-http-encryption-key-".repeat(3);
      const hookApp = (enabled: boolean) =>
        createRestApi({
          db,
          cache,
          durable: cache,
          pepper,
          linkDomain: "shortn.at",
          rolloutPercent: 0,
          webhooksEnabled: enabled,
          webhookSecretKey: encryptionKey,
          clientIp: () => "192.0.2.1",
          log: (_message, error) => unexpectedErrors.push(error),
        });
      const enabled = hookApp(true),
        disabled = hookApp(false);
      const call = (
        path: string,
        secret: string,
        init: RequestInit = {},
        target = enabled,
      ) => {
        const headers = new Headers(init.headers);
        headers.set("Authorization", `Bearer ${secret}`);
        return target.request(path, { ...init, headers });
      };
      const json = (
        body: unknown,
        method = "POST",
        idempotency?: string,
      ): RequestInit => ({
        method,
        headers: {
          "Content-Type": "application/json",
          ...(idempotency ? { "Idempotency-Key": idempotency } : {}),
        },
        body: JSON.stringify(body),
      });
      const writer = await makeKey(["webhooks:write"]),
        reader = await makeKey(["webhooks:read"]),
        both = await makeKey(["webhooks:*"]),
        denied = await makeKey(["links:read"]);
      const payload = {
        name: "HTTP [literal]",
        url: "https://receiver.example/hook",
        events: ["link.created", "link.clicked"],
      };
      const create = json(payload, "POST", "webhook-create");
      expect(
        (await call("/v1/webhooks", writer.secret, create, disabled)).status,
      ).toBe(403);
      expect((await call("/v1/webhooks", reader.secret, create)).status).toBe(
        403,
      );
      expect((await call("/v1/webhooks", writer.secret)).status).toBe(403);
      expect((await call("/v1/webhooks", denied.secret)).status).toBe(403);
      const created = await call("/v1/webhooks", writer.secret, create);
      expect(created.status).toBe(201);
      const hook = z
        .object({
          id: z.string(),
          secret: z.string(),
          createdAt: z.iso.datetime(),
        })
        .parse(await created.json());
      const path = `/v1/webhooks/${hook.id}`;
      expect(created.headers.get("Location")).toBe(path);
      const replay = await call("/v1/webhooks", writer.secret, create);
      expect(replay.status).toBe(201);
      expect(
        z.object({ secret: z.string() }).parse(await replay.json()).secret,
      ).toBe(hook.secret);
      const mutationKey = await makeKey(["links:read", "links:write"]);
      const mutationBody = json(
        {
          url: "https://example.com/automatic-event",
          password: "not-in-event",
        },
        "POST",
        "automatic-link",
      );
      const mutation = await call(
        "/v1/links",
        mutationKey.secret,
        mutationBody,
      );
      expect(mutation.status).toBe(201);
      const mutationId = z
        .object({ id: z.string() })
        .parse(await mutation.json()).id;
      expect(
        (await call("/v1/links", mutationKey.secret, mutationBody)).status,
      ).toBe(201);
      expect(
        (
          await call(
            "/v1/links",
            writer.secret,
            json({ url: "https://example.com/forbidden-event" }),
          )
        ).status,
      ).toBe(403);
      const automatic = await db
        .collection(physicalNames.webhook_events)
        .find({ workspaceId: local.workspace._id })
        .toArray();
      expect(automatic).toHaveLength(1);
      expect(automatic[0]?.event).toMatchObject({
        type: "link.created",
        data: { id: mutationId },
      });
      expect(JSON.stringify(automatic)).not.toContain("not-in-event");
      const cached = await cache.keys(`api:idempotency:${writer.key.id}:*`);
      expect(cached).toHaveLength(1);
      expect(await cache.get(cached[0]!)).not.toContain(hook.secret);
      const stored = await db
        .collection(physicalNames.webhook_endpoints)
        .findOne({ _id: new ObjectId(hook.id) });
      expect(JSON.stringify(stored)).not.toContain(hook.secret);
      const metadata = await call(path, reader.secret);
      expect(metadata.status).toBe(200);
      expect(await metadata.text()).not.toContain("secret");
      expect((await call(path, writer.secret)).status).toBe(403);
      for (const url of [
        "http://receiver.example",
        "https://user:pass@receiver.example",
        "https://receiver.example/#fragment",
        "https://localhost",
      ])
        expect(
          (await call("/v1/webhooks", writer.secret, json({ ...payload, url })))
            .status,
        ).toBe(400);
      expect(
        (await call(path, reader.secret, json({ name: "Changed" }, "PATCH")))
          .status,
      ).toBe(403);
      expect(
        (
          await call(
            path,
            writer.secret,
            json({ name: "Changed [literal]" }, "PATCH"),
          )
        ).status,
      ).toBe(200);
      expect(
        (await call(`${path}/test`, reader.secret, { method: "POST" })).status,
      ).toBe(403);
      const testing = {
        method: "POST",
        headers: { "Idempotency-Key": "webhook-test" },
      };
      const queued = await call(`${path}/test`, writer.secret, testing);
      expect(queued.status).toBe(202);
      const delivery = z
        .object({ id: z.string(), eventId: z.string() })
        .parse(await queued.json());
      const replayTest = await call(`${path}/test`, writer.secret, testing);
      expect(replayTest.status).toBe(202);
      expect(
        z.object({ id: z.string() }).parse(await replayTest.json()).id,
      ).toBe(delivery.id);
      expect(
        await db
          .collection(physicalNames.webhook_deliveries)
          .countDocuments({ webhookId: new ObjectId(hook.id) }),
      ).toBe(1);
      const expiredDeliveryId = new ObjectId();
      const originalDelivery = await db
        .collection(physicalNames.webhook_deliveries)
        .findOne({ _id: new ObjectId(delivery.id) });
      await db.collection(physicalNames.webhook_deliveries).insertOne({
        ...originalDelivery,
        _id: expiredDeliveryId,
        createdAt: new Date(0),
        expiresAt: new Date(0),
        retryUntil: new Date(0),
      });
      expect(
        (
          await call(
            `${path}/deliveries/${expiredDeliveryId}/redeliver`,
            writer.secret,
            { method: "POST" },
          )
        ).status,
      ).toBe(404);
      const logPath = `${path}/deliveries`;
      expect((await call(logPath, writer.secret)).status).toBe(403);
      const log = z
        .object({
          items: z.array(
            z.object({
              id: z.string(),
              status: z.string(),
              attempts: z.number(),
            }),
          ),
          nextCursor: z.string().nullable(),
        })
        .parse(await (await call(logPath, reader.secret)).json());
      expect(log.items).toHaveLength(1);
      expect(log.items[0]).toEqual({
        id: delivery.id,
        status: "pending",
        attempts: 0,
      });
      const redeliver = `${logPath}/${delivery.id}/redeliver`;
      expect(
        (await call(redeliver, reader.secret, { method: "POST" })).status,
      ).toBe(403);
      const again = await call(redeliver, writer.secret, {
        method: "POST",
        headers: { "Idempotency-Key": "redeliver" },
      });
      expect(again.status).toBe(202);
      const next = z
        .object({ id: z.string(), eventId: z.string() })
        .parse(await again.json());
      expect(next.id).not.toBe(delivery.id);
      expect(next.eventId).toBe(delivery.eventId);
      const member = {
        workspaceId: local.workspace._id,
        userId: local.actor.userId,
      };
      await collection(db, "workspace_members").updateOne(member, {
        $set: { role: "member" },
      });
      expect((await call(path, both.secret)).status).toBe(403);
      expect((await call("/v1/webhooks", writer.secret, create)).status).toBe(
        403,
      );
      expect((await call(`${path}/test`, writer.secret, testing)).status).toBe(
        403,
      );
      await collection(db, "workspace_members").updateOne(member, {
        $set: { role: "admin" },
      });
      expect((await call(path, both.secret)).status).toBe(200);
      await collection(db, "api_keys").updateOne(
        { _id: new ObjectId(writer.key.id) },
        { $set: { scopes: ["webhooks:read"] } },
      );
      expect((await call("/v1/webhooks", writer.secret, create)).status).toBe(
        403,
      );
      expect((await call(`${path}/test`, writer.secret, testing)).status).toBe(
        403,
      );
      await collection(db, "api_keys").updateOne(
        { _id: new ObjectId(writer.key.id) },
        { $set: { scopes: ["webhooks:write"] } },
      );
      const { local: foreign, makeKey: foreignKey } = await qrFixture();
      await collection(db, "workspaces").updateOne(
        { _id: foreign.workspace._id },
        { $set: { "platformFeatures.webhooks": true } },
      );
      const foreignToken = await foreignKey(["webhooks:*"]);
      for (const foreignPath of [path, logPath])
        expect((await call(foreignPath, foreignToken.secret)).status).toBe(404);
      for (const foreignPath of [`${path}/test`, redeliver])
        expect(
          (await call(foreignPath, foreignToken.secret, { method: "POST" }))
            .status,
        ).toBe(404);
      expect(
        (await call(path, foreignToken.secret, { method: "DELETE" })).status,
      ).toBe(404);
      const template = await db
        .collection(physicalNames.webhook_endpoints)
        .findOne({ _id: new ObjectId(hook.id) });
      const { _id: _ignored, ...fields } = template!;
      void _ignored;
      await db.collection(physicalNames.webhook_endpoints).insertMany(
        Array.from({ length: 1001 }, (_, i) => ({
          ...fields,
          name: `Endpoint ${i}`,
          url: `https://receiver.example/${i}`,
        })),
      );
      const pageSchema = z.object({
        items: z.array(z.object({ id: z.string() })),
        nextCursor: z.string().nullable(),
      });
      const first = pageSchema.parse(
        await (await call("/v1/webhooks?limit=25", reader.secret)).json(),
      );
      const second = pageSchema.parse(
        await (
          await call(
            `/v1/webhooks?limit=25&cursor=${first.nextCursor}`,
            reader.secret,
          )
        ).json(),
      );
      expect(first.items).toHaveLength(25);
      expect(second.items).toHaveLength(25);
      expect(
        second.items.some((d) =>
          first.items.some((prior) => d.id === prior.id),
        ),
      ).toBe(false);
      const searched = pageSchema.parse(
        await (
          await call("/v1/webhooks?search=%5Bliteral%5D", reader.secret)
        ).json(),
      );
      expect(searched.items.map((d) => d.id)).toEqual([hook.id]);
      expect((await call("/v1/webhooks?limit=201", reader.secret)).status).toBe(
        400,
      );
      expect(
        (await call(path, writer.secret, json({ enabled: false }, "PATCH")))
          .status,
      ).toBe(200);
      expect(
        (await call(`${path}/test`, writer.secret, { method: "POST" })).status,
      ).toBe(409);
      await collection(db, "workspaces").updateOne(
        { _id: local.workspace._id },
        { $set: { "platformFeatures.webhooks": false } },
      );
      expect((await call("/v1/webhooks", writer.secret, create)).status).toBe(
        403,
      );
      expect(
        (await call(path, reader.secret, { method: "DELETE" }, disabled))
          .status,
      ).toBe(403);
      expect(
        (await call(path, writer.secret, { method: "DELETE" }, disabled))
          .status,
      ).toBe(204);
      expect((await call(path, reader.secret)).status).toBe(404);
    });
    async function qrFixture(pro = true) {
      const actor = {
        userId: new ObjectId().toHexString(),
        role: "owner" as const,
      };
      const workspace = await ensurePersonalWorkspace(db, {
        id: actor.userId,
        name: "QR HTTP",
      });
      await collection(db, "workspaces").updateOne(
        { _id: workspace._id },
        { $set: { platformFeatures: { api: true } } },
      );
      if (pro)
        await collection(db, "subscriptions").insertOne({
          _id: new ObjectId(),
          workspaceId: workspace._id,
          polarSubscriptionId: crypto.randomUUID(),
          polarCustomerId: "local",
          productId: "local",
          status: "active",
          plan: "pro",
          currentPeriodStart: new Date(Date.now() - 86400000),
          currentPeriodEnd: new Date(Date.now() + 29 * 86400000),
          cancelAtPeriodEnd: false,
        });
      const local: ServiceContext = { ...ctx, actor, workspace };
      const makeKey = async (scopes: ApiScope[]) => {
        const result = await createApiKey(
          local,
          { name: "QR contract", scopes },
          pepper,
        );
        if (!result.ok) throw new Error(result.error);
        keyIds.push(result.value.key.id);
        return result.value;
      };
      return { local, makeKey };
    }
    test("QR CRUD enforces current scopes and roles before idempotent replay and preserves tenant isolation", async () => {
      const { local, makeKey } = await qrFixture();
      const writer = await makeKey(["qr:*"]),
        reader = await makeKey(["qr:read"]),
        unrelated = await makeKey(["links:write"]);
      expect(
        (
          await request(
            "/v1/qr-codes",
            reader.secret,
            post("https://example.com/qr"),
          )
        ).status,
      ).toBe(403);
      expect((await request("/v1/qr-codes", unrelated.secret)).status).toBe(
        403,
      );
      const response = await request(
        "/v1/qr-codes",
        writer.secret,
        post("https://example.com/qr", "qr-create"),
      );
      expect(response.status).toBe(201);
      const qr = z
        .object({
          id: z.string(),
          key: z.string(),
          shortUrl: z.string(),
          createdAt: z.string(),
          design: z.object({ data: z.string() }),
        })
        .parse(await response.json());
      expect(qr.design.data).toBe(qr.shortUrl);
      expect(new Date(qr.createdAt).toISOString()).toBe(qr.createdAt);
      expect(response.headers.get("Location")).toBe(`/v1/qr-codes/${qr.id}`);
      const replay = await request(
        "/v1/qr-codes",
        writer.secret,
        post("https://example.com/qr", "qr-create"),
      );
      expect(replay.status).toBe(201);
      expect(replay.headers.get("Idempotency-Replayed")).toBe("true");
      expect(z.object({ id: z.string() }).parse(await replay.json()).id).toBe(
        qr.id,
      );
      expect(
        (await request(`/v1/qr-codes/${qr.id}`, reader.secret)).status,
      ).toBe(200);
      const patch = {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com/edited",
          title: "Edited",
        }),
      };
      expect(
        (await request(`/v1/qr-codes/${qr.id}`, reader.secret, patch)).status,
      ).toBe(403);
      expect(
        (await request(`/v1/qr-codes/${qr.id}`, writer.secret, patch)).status,
      ).toBe(200);
      expect(
        await collection(db, "links").findOne({
          workspaceId: local.workspace._id,
          urlCode: qr.key,
        }),
      ).toMatchObject({ longUrl: "https://example.com/edited" });
      await collection(db, "workspace_members").updateOne(
        { workspaceId: local.workspace._id, userId: local.actor.userId },
        { $set: { role: "viewer" } },
      );
      expect(
        (await request(`/v1/qr-codes/${qr.id}`, writer.secret)).status,
      ).toBe(200);
      expect(
        (
          await request(
            "/v1/qr-codes",
            writer.secret,
            post("https://example.com/qr", "qr-create"),
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await request(`/v1/qr-codes/${qr.id}`, writer.secret, {
            method: "DELETE",
          })
        ).status,
      ).toBe(403);
      await collection(db, "workspace_members").updateOne(
        { workspaceId: local.workspace._id, userId: local.actor.userId },
        { $set: { role: "owner" } },
      );
      await collection(db, "api_keys").updateOne(
        { _id: new ObjectId(writer.key.id) },
        { $set: { scopes: ["qr:read"] } },
      );
      expect(
        (
          await request(
            "/v1/qr-codes",
            writer.secret,
            post("https://example.com/qr", "qr-create"),
          )
        ).status,
      ).toBe(403);
      await collection(db, "api_keys").updateOne(
        { _id: new ObjectId(writer.key.id) },
        { $set: { scopes: ["qr:*"] } },
      );
      const foreign = await qrFixture(),
        foreignKey = await foreign.makeKey(["qr:*"]);
      expect(
        (await request(`/v1/qr-codes/${qr.id}`, foreignKey.secret)).status,
      ).toBe(404);
      expect(
        (await request(`/v1/qr-codes/${qr.id}`, foreignKey.secret, patch))
          .status,
      ).toBe(404);
      expect(
        (
          await request(`/v1/qr-codes/${qr.id}`, foreignKey.secret, {
            method: "DELETE",
          })
        ).status,
      ).toBe(204);
      expect(
        await collection(db, "qr_codes").countDocuments({
          _id: new ObjectId(qr.id),
        }),
      ).toBe(1);
      await collection(db, "qr_codes").updateOne(
        { _id: new ObjectId(qr.id) },
        { $set: { createdBy: new ObjectId().toHexString() } },
      );
      await collection(db, "workspace_members").updateOne(
        { workspaceId: local.workspace._id, userId: local.actor.userId },
        { $set: { role: "member" } },
      );
      expect(
        (
          await request(`/v1/qr-codes/${qr.id}`, writer.secret, {
            method: "DELETE",
          })
        ).status,
      ).toBe(403);
      await collection(db, "workspace_members").updateOne(
        { workspaceId: local.workspace._id, userId: local.actor.userId },
        { $set: { role: "owner" } },
      );
      expect(
        (
          await request(`/v1/qr-codes/${qr.id}`, writer.secret, {
            method: "DELETE",
          })
        ).status,
      ).toBe(204);
      expect(
        (await request(`/v1/qr-codes/${qr.id}`, reader.secret)).status,
      ).toBe(404);
      expect(
        await collection(db, "links").countDocuments({
          workspaceId: local.workspace._id,
          urlCode: qr.key,
        }),
      ).toBe(0);
    });
    test("QR attachment requires link-write scope, respects trash and never edits tombstones", async () => {
      const { local, makeKey } = await qrFixture();
      const qrOnly = await makeKey(["qr:*"]),
        combined = await makeKey(["qr:*", "links:write"]);
      const created = await createLink(local, {
        url: "https://example.com/attached",
      });
      if (!created.ok) throw new Error(created.error);
      const payload = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "qr-attach",
        },
        body: JSON.stringify({
          url: "https://example.com/qr",
          attachToLinkId: created.value.id,
        }),
      };
      expect(
        (await request("/v1/qr-codes", qrOnly.secret, payload)).status,
      ).toBe(403);
      const response = await request("/v1/qr-codes", combined.secret, payload);
      expect(response.status).toBe(201);
      const qr = z
        .object({ id: z.string(), publicId: z.string() })
        .parse(await response.json());
      expect(
        await collection(db, "links").findOne({
          _id: new ObjectId(created.value.id),
        }),
      ).toMatchObject({ qrCodeId: qr.publicId });
      await collection(db, "api_keys").updateOne(
        { _id: new ObjectId(combined.key.id) },
        { $set: { scopes: ["qr:*"] } },
      );
      expect(
        (await request("/v1/qr-codes", combined.secret, payload)).status,
      ).toBe(403);
      await collection(db, "api_keys").updateOne(
        { _id: new ObjectId(combined.key.id) },
        { $set: { scopes: ["qr:*", "links:write"] } },
      );
      const patch = {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com/updated",
          applyToLink: true,
        }),
      };
      expect(
        (await request(`/v1/qr-codes/${qr.id}`, qrOnly.secret, patch)).status,
      ).toBe(403);
      expect(
        (await request(`/v1/qr-codes/${qr.id}`, combined.secret, patch)).status,
      ).toBe(200);
      await deleteLinks(local, [created.value.id]);
      expect(
        (
          await request("/v1/qr-codes", combined.secret, {
            ...payload,
            headers: { "Content-Type": "application/json" },
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await request(`/v1/qr-codes/${qr.id}`, combined.secret, {
            ...patch,
            body: JSON.stringify({
              url: "https://example.com/after-trash",
              applyToLink: true,
            }),
          })
        ).status,
      ).toBe(200);
      expect(
        await collection(db, "links").findOne({
          _id: new ObjectId(created.value.id),
        }),
      ).toMatchObject({
        longUrl: "https://example.com/updated",
        deletedAt: expect.any(Date),
      });
      expect(
        (
          await request(`/v1/qr-codes/${qr.id}`, qrOnly.secret, {
            method: "DELETE",
          })
        ).status,
      ).toBe(204);
      expect(
        await collection(db, "links").countDocuments({
          _id: new ObjectId(created.value.id),
        }),
      ).toBe(1);
    });
    test("QR cursor pages are bounded, searchable by literal terms and tags, with quota and design gates", async () => {
      const { local, makeKey } = await qrFixture();
      const reader = await makeKey(["qr:read"]);
      await collection(db, "qr_codes").insertMany(
        Array.from({ length: 1001 }, (_, index) => ({
          _id: new ObjectId(),
          workspaceId: local.workspace._id,
          title: index < 2 ? "literal.*" : `QR ${index}`,
          qrCodeId: `qr-${index}`,
          longUrl: "https://example.com/qr",
          date: new Date(),
          tags: [{ tagName: index % 2 ? "Odd" : "Even" }],
          options: {
            data: "https://shortn.at/test",
            dotsOptions: { type: "square", color: "#123456" },
          },
        })),
      );
      const schema = z.object({
        data: z.array(z.object({ id: z.string() })),
        nextCursor: z.string().nullable(),
        total: z.number().nullable(),
      });
      const first = schema.parse(
        await (await request("/v1/qr-codes?limit=25", reader.secret)).json(),
      );
      expect(first.total).toBe(1001);
      expect(first.data).toHaveLength(25);
      expect(first.nextCursor).not.toBeNull();
      const second = schema.parse(
        await (
          await request(
            `/v1/qr-codes?limit=25&cursor=${first.nextCursor}`,
            reader.secret,
          )
        ).json(),
      );
      expect(second.total).toBeNull();
      expect(second.data).toHaveLength(25);
      expect(
        second.data.some((qr) => first.data.some((item) => item.id === qr.id)),
      ).toBe(false);
      const literal = schema.parse(
        await (
          await request("/v1/qr-codes?search=literal.*", reader.secret)
        ).json(),
      );
      expect(literal.total).toBe(2);
      expect(
        schema.parse(
          await (
            await request("/v1/qr-codes?tag=Odd&limit=1", reader.secret)
          ).json(),
        ).total,
      ).toBe(500);
      expect(
        (await request("/v1/qr-codes?cursor=invalid", reader.secret)).status,
      ).toBe(400);
      expect(
        (await request("/v1/qr-codes?limit=201", reader.secret)).status,
      ).toBe(400);
      const free = await qrFixture(false),
        freeKey = await free.makeKey(["qr:*"]);
      const logo = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com/qr",
          design: { image: "https://example.com/logo.png" },
        }),
      };
      expect((await request("/v1/qr-codes", freeKey.secret, logo)).status).toBe(
        403,
      );
      for (let i = 0; i < 5; i++)
        expect(
          (
            await request(
              "/v1/qr-codes",
              freeKey.secret,
              post("https://example.com/qr"),
            )
          ).status,
        ).toBe(201);
      expect(
        (
          await request(
            "/v1/qr-codes",
            freeKey.secret,
            post("https://example.com/qr"),
          )
        ).status,
      ).toBe(409);
      expect(
        await collection(db, "qr_codes").countDocuments({
          workspaceId: free.local.workspace._id,
        }),
      ).toBe(5);
      expect(
        await collection(db, "links").countDocuments({
          workspaceId: free.local.workspace._id,
        }),
      ).toBe(5);
    });
    test("tag CRUD updates large link/QR libraries transactionally, supports legacy IDs and isolates tenants", async () => {
      const { local, makeKey } = await qrFixture();
      await collection(db, "tags").createIndex(
        { workspaceId: 1, nameLower: 1 },
        {
          unique: true,
          partialFilterExpression: { nameLower: { $type: "string" } },
        },
      );
      const writer = await makeKey(["tags:read", "tags:write"]),
        reader = await makeKey(["tags:read"]);
      const write = (
        method: string,
        name: string,
        idempotency?: string,
      ): RequestInit => ({
        method,
        headers: {
          "Content-Type": "application/json",
          ...(idempotency ? { "Idempotency-Key": idempotency } : {}),
        },
        body: JSON.stringify({ name }),
      });
      expect(
        (await request("/v1/tags", reader.secret, write("POST", "Original")))
          .status,
      ).toBe(403);
      const created = await request(
        "/v1/tags",
        writer.secret,
        write("POST", " Original ", "tag-create"),
      );
      expect(created.status).toBe(201);
      const schema = z.object({
        id: z.string(),
        legacyId: z.string(),
        name: z.string(),
        createdAt: z.string(),
      });
      const tag = schema.parse(await created.json());
      expect(tag.name).toBe("Original");
      expect(new Date(tag.createdAt).toISOString()).toBe(tag.createdAt);
      expect(
        (await request("/v1/tags", writer.secret, write("POST", "original")))
          .status,
      ).toBe(409);
      const replay = await request(
        "/v1/tags",
        writer.secret,
        write("POST", " Original ", "tag-create"),
      );
      expect(replay.status).toBe(201);
      expect(replay.headers.get("Idempotency-Replayed")).toBe("true");
      expect(
        schema.parse(
          await (
            await request(`/v1/tags/${tag.legacyId}`, reader.secret)
          ).json(),
        ).id,
      ).toBe(tag.id);
      const tagId = new ObjectId(tag.id),
        alias = "legacy-tag-alias";
      await collection(db, "tags").updateOne(
        { _id: tagId },
        { $set: { legacyIds: [alias] } },
      );
      const referenced = Array.from({ length: 1001 }, (_, index) => ({
        _id: new ObjectId(),
        workspaceId: local.workspace._id,
        key: `tag-fixture-${index}`,
        urlCode: `tag-fixture-${index}`,
        longUrl: "https://example.com/tag",
        tags:
          index % 4 === 0
            ? [{ _id: tagId, tagName: "Original" }]
            : index % 4 === 1
              ? [{ id: tag.legacyId, tagName: "Original" }]
              : index % 4 === 2
                ? [{ id: alias, tagName: "Original" }]
                : [{ tagName: "Original" }],
        tagIds: [tagId],
        ...(index === 0 ? { deletedAt: new Date() } : {}),
        updatedAt: new Date(0),
      }));
      await collection(db, "links").insertMany(referenced);
      const qr = await createQr(local, {
        url: "https://example.com/tag-qr",
        tags: ["Original"],
      });
      if (!qr.ok) throw new Error(qr.error);
      const foreignWorkspaceId = new ObjectId(),
        foreignLinkId = new ObjectId(),
        unrelatedLinkId = new ObjectId();
      await collection(db, "links").insertMany([
        {
          _id: foreignLinkId,
          workspaceId: foreignWorkspaceId,
          tags: [{ _id: tagId, tagName: "Original" }],
          tagIds: [tagId],
          updatedAt: new Date(0),
        },
        {
          _id: unrelatedLinkId,
          workspaceId: local.workspace._id,
          tags: [{ tagName: "Unrelated" }],
          updatedAt: new Date(0),
        },
      ]);
      // Deliberately fail the QR reference write after the link write. The
      // transaction must roll the link changes back as well as the tag rename.
      const errorsBefore = unexpectedErrors.length;
      await db.command({
        collMod: collection(db, "qr_codes").collectionName,
        validator: { "tags.tagName": { $ne: "FailRename" } },
        validationLevel: "strict",
      });
      try {
        expect(
          (
            await request(
              `/v1/tags/${tag.id}`,
              writer.secret,
              write("PATCH", "FailRename"),
            )
          ).status,
        ).toBe(500);
        expect(unexpectedErrors.length).toBe(errorsBefore + 1);
        unexpectedErrors.pop();
        expect(
          await collection(db, "links").countDocuments({
            workspaceId: local.workspace._id,
            "tags.tagName": "Original",
          }),
        ).toBe(1001);
        expect(
          await collection(db, "tags").findOne({ _id: tagId }),
        ).toMatchObject({ name: "Original" });
      } finally {
        await db.command({
          collMod: collection(db, "qr_codes").collectionName,
          validator: {},
        });
      }
      expect(
        (
          await request(
            `/v1/tags/${alias}`,
            writer.secret,
            write("PATCH", "Renamed"),
          )
        ).status,
      ).toBe(200);
      expect(
        await collection(db, "links").countDocuments({
          workspaceId: local.workspace._id,
          "tags.tagName": "Renamed",
        }),
      ).toBe(1001);
      expect(
        await collection(db, "qr_codes").findOne({
          _id: new ObjectId(qr.value.id),
        }),
      ).toMatchObject({
        tags: [expect.objectContaining({ tagName: "Renamed" })],
      });
      expect(
        await collection(db, "links").findOne({ _id: foreignLinkId }),
      ).toMatchObject({
        tags: [{ _id: tagId, tagName: "Original" }],
        updatedAt: new Date(0),
      });
      const other = await request(
        "/v1/tags",
        writer.secret,
        write("POST", "Other"),
      );
      expect(other.status).toBe(201);
      expect(
        (
          await request(
            `/v1/tags/${tag.id}`,
            writer.secret,
            write("PATCH", "Other"),
          )
        ).status,
      ).toBe(409);
      expect(
        await collection(db, "links").countDocuments({
          workspaceId: local.workspace._id,
          "tags.tagName": "Renamed",
        }),
      ).toBe(1001);
      const foreign = await qrFixture(),
        foreignKey = await foreign.makeKey(["tags:read", "tags:write"]);
      expect(
        (await request(`/v1/tags/${tag.id}`, foreignKey.secret)).status,
      ).toBe(404);
      expect(
        (
          await request(
            `/v1/tags/${tag.id}`,
            foreignKey.secret,
            write("PATCH", "Foreign"),
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await request(`/v1/tags/${tag.id}`, foreignKey.secret, {
            method: "DELETE",
          })
        ).status,
      ).toBe(204);
      await collection(db, "workspace_members").updateOne(
        { workspaceId: local.workspace._id, userId: local.actor.userId },
        { $set: { role: "viewer" } },
      );
      expect(
        (
          await request(
            "/v1/tags",
            writer.secret,
            write("POST", " Original ", "tag-create"),
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await request(`/v1/tags/${tag.id}`, writer.secret, {
            method: "DELETE",
          })
        ).status,
      ).toBe(403);
      await collection(db, "workspace_members").updateOne(
        { workspaceId: local.workspace._id, userId: local.actor.userId },
        { $set: { role: "member" } },
      );
      expect(
        (
          await request(`/v1/tags/${tag.id}`, writer.secret, {
            method: "DELETE",
          })
        ).status,
      ).toBe(204);
      expect(
        await collection(db, "links").countDocuments({
          workspaceId: local.workspace._id,
          tagIds: tagId,
        }),
      ).toBe(0);
      expect(
        await collection(db, "links").countDocuments({
          workspaceId: local.workspace._id,
          "tags.tagName": "Renamed",
        }),
      ).toBe(0);
      expect(
        await collection(db, "links").findOne({ _id: unrelatedLinkId }),
      ).toMatchObject({
        tags: [{ tagName: "Unrelated" }],
        updatedAt: new Date(0),
      });
      expect(
        await collection(db, "qr_codes").findOne({
          _id: new ObjectId(qr.value.id),
        }),
      ).toMatchObject({ tags: [] });
      expect(
        await collection(db, "links").findOne({ _id: foreignLinkId }),
      ).toMatchObject({ tags: [{ _id: tagId, tagName: "Original" }] });
      expect((await request(`/v1/tags/${tag.id}`, reader.secret)).status).toBe(
        404,
      );
    });
    test("tag cursor pages are bounded, hide merged tags and enforce creator-based deletion", async () => {
      const { local, makeKey } = await qrFixture();
      const owner = await makeKey(["tags:read", "tags:write"]);
      await collection(db, "tags").insertMany(
        Array.from({ length: 1001 }, (_, index) => ({
          _id: new ObjectId(),
          workspaceId: local.workspace._id,
          name: index < 2 ? "literal.*" : `Tag ${index}`,
          tagName: index < 2 ? "literal.*" : `Tag ${index}`,
          createdBy: new ObjectId().toHexString(),
        })),
      );
      await collection(db, "tags").insertOne({
        _id: new ObjectId(),
        workspaceId: local.workspace._id,
        tagName: "Merged",
        mergedInto: new ObjectId(),
      });
      const schema = z.object({
        data: z.array(z.object({ id: z.string() })),
        nextCursor: z.string().nullable(),
        total: z.number().nullable(),
      });
      const first = schema.parse(
        await (await request("/v1/tags?limit=25", owner.secret)).json(),
      );
      expect(first.total).toBe(1001);
      expect(first.data).toHaveLength(25);
      expect(first.nextCursor).not.toBeNull();
      const second = schema.parse(
        await (
          await request(
            `/v1/tags?limit=25&cursor=${first.nextCursor}`,
            owner.secret,
          )
        ).json(),
      );
      expect(second.total).toBeNull();
      expect(second.data).toHaveLength(25);
      expect(
        second.data.some((tag) =>
          first.data.some((item) => item.id === tag.id),
        ),
      ).toBe(false);
      expect(
        schema.parse(
          await (
            await request("/v1/tags?search=literal.*", owner.secret)
          ).json(),
        ).total,
      ).toBe(2);
      expect(
        (await request("/v1/tags?cursor=invalid", owner.secret)).status,
      ).toBe(400);
      await collection(db, "workspace_members").updateOne(
        { workspaceId: local.workspace._id, userId: local.actor.userId },
        { $set: { role: "member" } },
      );
      expect(
        (
          await request(`/v1/tags/${first.data[0]!.id}`, owner.secret, {
            method: "DELETE",
          })
        ).status,
      ).toBe(403);
    });
    test("the sliding window emits rate headers and blocks request 31 on free", async () => {
      const created = await key(["links:read"]);
      for (let i = 0; i < 30; i++)
        expect((await request("/v1/links", created.secret)).status).toBe(200);
      const limited = await request("/v1/links", created.secret);
      expect(limited.status).toBe(429);
      expect(limited.headers.get("RateLimit-Limit")).toBe("30");
      expect(limited.headers.get("RateLimit-Remaining")).toBe("0");
      expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
    });
    test("a banned or deletion-pending creator's key gets 401 until the ban lapses", async () => {
      const created = await key(["links:read"]);
      const users = collection(db, "user");
      const _id = new ObjectId(ctx.actor.userId);
      await users.insertOne({ _id, email: "banned-creator@example.com" });
      try {
        await users.updateOne({ _id }, { $set: { banned: true } });
        expect((await request("/v1/links", created.secret)).status).toBe(401);
        await users.updateOne(
          { _id },
          {
            $unset: { banned: "" },
            $set: {
              deletion: {
                requestedAt: new Date(),
                by: "staff",
                purgeAfter: new Date(),
                state: "scheduled",
              },
            },
          },
        );
        expect((await request("/v1/links", created.secret)).status).toBe(401);
        await users.updateOne(
          { _id },
          {
            $unset: { deletion: "" },
            $set: { banned: true, banExpires: new Date(Date.now() - 1000) },
          },
        );
        await cache.del(`api:rate:${created.key.id}`);
        expect((await request("/v1/links", created.secret)).status).toBe(200);
      } finally {
        await users.deleteOne({ _id });
      }
    });
    test("a locked workspace reads but can't write; a suspended one gets 403 for everything", async () => {
      const created = await key(["links:read", "links:write", "qr:read"]);
      const workspaces = collection(db, "workspaces");
      const set = (level: "locked" | "suspended") =>
        workspaces.updateOne(
          { _id: ctx.workspace._id },
          {
            $set: {
              suspension: {
                level,
                category: "other",
                internalNote: "integration",
                by: "staff",
                at: new Date(),
              },
            },
          },
        );
      try {
        await set("locked");
        expect((await request("/v1/links", created.secret)).status).toBe(200);
        const write = await request(
          "/v1/links",
          created.secret,
          post("https://example.com/locked"),
        );
        expect(write.status).toBe(403);
        expect((await write.json()).code).toBe("workspace_locked");
        await set("suspended");
        const read = await request("/v1/links", created.secret);
        expect(read.status).toBe(403);
        expect((await read.json()).code).toBe("workspace_suspended");
      } finally {
        await workspaces.updateOne(
          { _id: ctx.workspace._id },
          { $unset: { suspension: "" } },
        );
        await cache.del(`api:rate:${created.key.id}`);
      }
      expect((await request("/v1/links", created.secret)).status).toBe(200);
    });
  },
);
