import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { Redis } from "ioredis";
import { z } from "zod";
import { collection, desiredIndexes, physicalNames } from "@shortn/db";
import {
  apiScopes,
  createApiKey,
  createBioPage,
  createLink,
  ensurePersonalWorkspace,
  revokeApiKey,
  type ApiScope,
  type ServiceContext,
} from "@shortn/core";
import { createMcpApp } from "./mcp";

const mongo = process.env.MONGO_TEST_URL,
  redisUrl = process.env.REDIS_TEST_URL;
const origin = "http://localhost:3003",
  pepper = "synthetic-mcp-test-pepper-".repeat(3);
const data = z.object({
  structuredContent: z
    .object({
      data: z.unknown().optional(),
      error: z.object({ code: z.string() }).optional(),
    })
    .optional(),
  isError: z.boolean().optional(),
});
(mongo && redisUrl ? describe : describe.skip)(
  "MCP Streamable HTTP contract",
  () => {
    let mongoClient: MongoClient,
      db: Db,
      cache: Redis,
      ctx: ServiceContext,
      app: ReturnType<typeof createMcpApp>;
    const clients: Client[] = [],
      keys: string[] = [],
      logs: string[] = [];
    async function key(scopes: ApiScope[] = [...apiScopes]) {
      const result = await createApiKey(
        ctx,
        { name: "Synthetic MCP", scopes },
        pepper,
      );
      if (!result.ok) throw new Error(result.error);
      keys.push(result.value.key.id);
      return result.value;
    }
    async function connect(secret: string, target = app) {
      const client = new Client({
        name: "untrusted-client-name",
        version: "1.0.0",
      });
      clients.push(client);
      await client.connect(
        // SDK v1's sessionId getter includes undefined; its Transport interface
        // omits that union under exactOptionalPropertyTypes. Runtime is stateless.
        new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), {
          requestInit: { headers: { Authorization: `Bearer ${secret}` } },
          fetch: async (input, init) =>
            target.fetch(new Request(String(input), init)),
        }) as Parameters<Client["connect"]>[0],
      );
      return client;
    }
    async function call(
      client: Client,
      name: string,
      args: Record<string, unknown> = {},
    ) {
      return data.parse(await client.callTool({ name, arguments: args }));
    }
    beforeAll(async () => {
      for (const value of [mongo!, redisUrl!])
        if (!["localhost", "127.0.0.1"].includes(new URL(value).hostname))
          throw new Error("Loopback services required");
      mongoClient = await new MongoClient(mongo!).connect();
      db = mongoClient.db(
        `shortn_mcp_${crypto.randomUUID().replaceAll("-", "")}`,
      );
      cache = new Redis(redisUrl!);
      for (const name of [
        "links",
        "campaigns",
        "api_keys",
        "audit_log",
      ] as const)
        await collection(db, name).createIndexes(
          desiredIndexes[physicalNames[name]]!,
        );
      const userId = new ObjectId().toHexString();
      const workspace = await ensurePersonalWorkspace(db, {
        id: userId,
        name: "MCP contract",
      });
      await collection(db, "workspaces").updateOne(
        { _id: workspace._id },
        { $set: { platformFeatures: { mcp: true } } },
      );
      ctx = {
        db,
        cache,
        workspace,
        actor: { userId, role: "owner" },
        linkDomain: "shortn.invalid",
      };
      // Outbox subscriber only; no worker runs or external delivery is possible.
      await db.collection(physicalNames.webhook_endpoints).insertOne({
        workspaceId: workspace._id,
        enabled: true,
        events: ["link.created"],
      });
      await collection(db, "subscriptions").insertOne({
        _id: new ObjectId(),
        workspaceId: workspace._id,
        polarSubscriptionId: crypto.randomUUID(),
        polarCustomerId: "synthetic-customer",
        productId: "synthetic-product",
        status: "active",
        plan: "pro",
        currentPeriodStart: new Date(Date.now() - 86400000),
        currentPeriodEnd: new Date(Date.now() + 29 * 86400000),
        cancelAtPeriodEnd: false,
      });
      app = createMcpApp({
        db,
        cache,
        pepper,
        origin,
        linkDomain: ctx.linkDomain,
        clientIp: () => "127.0.0.1",
        log: (message) => logs.push(message),
      });
    });
    afterAll(async () => {
      await Promise.all(clients.map((client) => client.close()));
      for (const id of keys)
        await cache.del(`api:rate:${id}`, `apikey:last-used:${id}`);
      await db?.dropDatabase();
      await mongoClient?.close();
      cache?.disconnect();
    });
    test("OAuth discovery challenges and verified client audit identity coexist with API keys", async () => {
      const oauthKey = `oauth:fixture-${crypto.randomUUID()}`,
        consentId = new ObjectId().toHexString();
      const oauthApp = createMcpApp({
        db,
        cache,
        pepper,
        origin,
        linkDomain: ctx.linkDomain,
        clientIp: () => "127.0.0.1",
        log: (message) => logs.push(message),
        oauth: {
          issuer: "http://localhost:3400/api/auth",
          authenticate: async (bearer) => {
            if (bearer !== "synthetic-verified-oauth")
              return { ok: false, error: "unauthorized" };
            const workspace = (await collection(db, "workspaces").findOne({
              _id: ctx.workspace._id,
            }))!;
            return {
              ok: true,
              value: {
                keyId: oauthKey,
                scopes: [...apiScopes],
                workspace,
                actor: ctx.actor,
                oauthClientId: "verified-oauth-client",
                consentId,
              },
            };
          },
        },
      });
      try {
        const challenge = await oauthApp.request(`${origin}/mcp`, {
          method: "POST",
        });
        expect(challenge.status).toBe(401);
        expect(challenge.headers.get("WWW-Authenticate")).toContain(
          `${origin}/.well-known/oauth-protected-resource/mcp`,
        );
        const metadata = await oauthApp.request(
          `${origin}/.well-known/oauth-protected-resource/mcp`,
        );
        expect(await metadata.json()).toMatchObject({
          resource: `${origin}/mcp`,
          authorization_servers: ["http://localhost:3400/api/auth"],
        });
        const client = await connect("synthetic-verified-oauth", oauthApp);
        expect(
          (
            await call(client, "create_link", {
              url: "https://example.com/oauth-mcp",
            })
          ).isError,
        ).toBeUndefined();
        expect(
          (
            await collection(db, "audit_log").findOne({
              credentialId: consentId,
            })
          )?.actor,
        ).toBe("mcp:verified-oauth-client");
        const keyed = await connect(
          (await key(["workspace:read"])).secret,
          oauthApp,
        );
        expect((await call(keyed, "get_usage")).isError).toBeUndefined();
      } finally {
        await cache.del(`api:rate:${oauthKey}`);
      }
    });
    test("SDK connects and discovers twelve tools, two resources and two prompts", async () => {
      const client = await connect((await key()).secret);
      const tools = await client.listTools();
      expect(tools.tools).toHaveLength(12);
      expect(
        tools.tools.find((tool) => tool.name === "archive_link")?.annotations,
      ).toMatchObject({ destructiveHint: true, readOnlyHint: false });
      expect(
        (await client.listResources()).resources.map((item) => item.uri),
      ).toEqual(["shortn://analytics/summary"]);
      expect(
        (await client.listResourceTemplates()).resourceTemplates.map(
          (item) => item.uriTemplate,
        ),
      ).toEqual(["shortn://links/{key}"]);
      expect((await client.listPrompts()).prompts).toHaveLength(2);
      expect(
        (await client.getPrompt({ name: "weekly_link_report" })).messages[0]
          ?.content.type,
      ).toBe("text");
      expect(
        (
          await client.getPrompt({
            name: "create_campaign_links",
            arguments: { title: "Launch", urls: "https://example.com" },
          })
        ).messages,
      ).toHaveLength(1);
    });
    test("all tools execute shared core behavior and resources return scoped data", async () => {
      const credential = await key(),
        client = await connect(credential.secret);
      const created = await call(client, "create_link", {
        url: "https://example.com/mcp",
        key: `mcp-${crypto.randomUUID().slice(0, 8)}`,
        title: "MCP link",
        tags: ["MCP"],
        utm: { campaign: "Launch" },
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });
      const link = z
        .object({ id: z.string(), key: z.string(), shortUrl: z.string() })
        .parse(created.structuredContent?.data);
      expect(created.isError).toBeUndefined();
      expect(
        (
          await call(client, "update_link", {
            id: link.id,
            title: "Updated MCP",
          })
        ).isError,
      ).toBeUndefined();
      expect(
        (await call(client, "get_link", { id: link.id })).structuredContent
          ?.data,
      ).toMatchObject({ id: link.id, title: "Updated MCP" });
      const found = await call(client, "search_links", {
        query: "Updated MCP",
        tag: "MCP",
        limit: 1,
      });
      expect(
        z
          .object({ items: z.array(z.object({ id: z.string() })) })
          .parse(found.structuredContent?.data).items[0]?.id,
      ).toBe(link.id);
      expect(
        (
          await call(client, "get_analytics", {
            linkKey: link.key,
            range: {
              from: new Date(Date.now() - 86400000).toISOString(),
              to: new Date().toISOString(),
            },
            groupBy: "kind",
          })
        ).isError,
      ).toBeUndefined();
      expect(
        (await call(client, "create_qr_code", { linkKey: link.key }))
          .structuredContent?.data,
      ).toMatchObject({
        exportUrl: null,
        exportStatus: "disabled",
      });
      expect(
        (await call(client, "create_campaign", { title: "MCP campaign" }))
          .isError,
      ).toBeUndefined();
      expect((await call(client, "list_campaigns")).isError).toBeUndefined();
      const bio = await createBioPage(ctx, {
        slug: `mcp-${crypto.randomUUID().slice(0, 8)}`,
      });
      if (!bio.ok) throw new Error(bio.error);
      expect(
        (
          await call(client, "add_bio_link", {
            page: bio.value.id,
            url: "https://example.com/bio",
            title: "Bio MCP",
          })
        ).isError,
      ).toBeUndefined();
      expect(
        (
          await collection(db, "bio_pages").findOne({
            _id: new ObjectId(bio.value.id),
          })
        )?.links,
      ).toHaveLength(1);
      expect((await call(client, "get_usage")).isError).toBeUndefined();
      expect(
        (await client.readResource({ uri: `shortn://links/${link.key}` }))
          .contents,
      ).toHaveLength(1);
      expect(
        (await client.readResource({ uri: "shortn://analytics/summary" }))
          .contents,
      ).toHaveLength(1);
      expect(
        (await call(client, "archive_link", { id: link.id })).isError,
      ).toBeUndefined();
      expect(
        (await call(client, "get_link", { id: link.id })).structuredContent
          ?.error?.code,
      ).toBe("not_found");
      const records = await collection(db, "audit_log")
        .find({ credentialId: credential.key.id })
        .toArray();
      expect(records).toHaveLength(6);
      expect(
        records.every(
          (record) =>
            record.actor === `mcp:api-key:${credential.key.id}` &&
            record.status === "succeeded",
        ),
      ).toBe(true);
      expect(JSON.stringify(records)).not.toContain("untrusted-client-name");
      expect(JSON.stringify(records)).not.toContain(credential.secret);
      expect(JSON.stringify(records)).not.toContain("https://example.com");
    });
    test("all tools reject missing scopes before mutation; resources enforce scopes", async () => {
      const client = await connect((await key(["domains:read"])).secret);
      const args: Record<string, Record<string, unknown>> = {
        create_link: { url: "https://example.com" },
        update_link: { id: new ObjectId().toHexString() },
        archive_link: { id: new ObjectId().toHexString() },
        get_link: { key: "missing" },
        search_links: {},
        get_analytics: {
          range: { from: "2026-10-01T00:00:00Z", to: "2026-10-02T00:00:00Z" },
        },
        create_qr_code: { linkKey: "missing" },
        list_campaigns: {},
        create_campaign: { title: "Denied" },
        add_bio_link: {
          page: new ObjectId().toHexString(),
          url: "https://example.com",
        },
        get_usage: {},
      };
      const before = await collection(db, "audit_log").countDocuments();
      for (const [name, input] of Object.entries(args))
        expect(
          (await call(client, name, input)).structuredContent?.error?.code,
        ).toBe("insufficient_scope");
      expect(await collection(db, "audit_log").countDocuments()).toBe(before);
      await expect(
        client.readResource({ uri: "shortn://analytics/summary" }),
      ).rejects.toThrow("insufficient_scope");
      await expect(
        client.readResource({ uri: "shortn://links/missing" }),
      ).rejects.toThrow("insufficient_scope");
    });
    test("revocation, membership, role changes and rollout are checked on every request", async () => {
      const credential = await key(),
        client = await connect(credential.secret);
      await collection(db, "workspace_members").updateOne(
        { workspaceId: ctx.workspace._id, userId: ctx.actor.userId },
        { $set: { role: "viewer" } },
      );
      try {
        expect(
          (
            await call(client, "create_link", {
              url: "https://example.com/denied",
            })
          ).structuredContent?.error?.code,
        ).toBe("forbidden");
      } finally {
        await collection(db, "workspace_members").updateOne(
          { workspaceId: ctx.workspace._id, userId: ctx.actor.userId },
          { $set: { role: "owner" } },
        );
      }
      await collection(db, "workspaces").updateOne(
        { _id: ctx.workspace._id },
        { $set: { "platformFeatures.mcp": false } },
      );
      try {
        await expect(client.listTools()).rejects.toThrow("feature_disabled");
      } finally {
        await collection(db, "workspaces").updateOne(
          { _id: ctx.workspace._id },
          { $set: { "platformFeatures.mcp": true } },
        );
      }
      expect((await revokeApiKey(ctx, credential.key.id)).ok).toBe(true);
      await expect(client.listTools()).rejects.toThrow();
    });
    test("origin, body limits and bearer-only authentication are enforced", async () => {
      expect(
        (
          await app.request(`${origin}/mcp`, {
            method: "POST",
            headers: { Cookie: "session=fake" },
          })
        ).status,
      ).toBe(401);
      expect(
        (await app.request("http://attacker.invalid/mcp", { method: "POST" }))
          .status,
      ).toBe(403);
      expect(
        (
          await app.request(`${origin}/mcp`, {
            method: "POST",
            headers: { Origin: "https://attacker.invalid" },
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await app.request(`${origin}/mcp`, {
            method: "POST",
            body: "x".repeat(1_048_577),
          })
        ).status,
      ).toBe(413);
    });
    test("public Host validation supports TLS termination without trusting forwarded hosts", async () => {
      const credential = await key();
      const tlsApp = createMcpApp({
        db,
        cache,
        pepper,
        origin: "https://localhost:3003",
        linkDomain: ctx.linkDomain,
        clientIp: () => "127.0.0.1",
        log: (message) => logs.push(message),
      });
      const headers = {
        Authorization: `Bearer ${credential.secret}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      };
      const body = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "TLS fixture", version: "1" },
        },
      });
      expect(
        (
          await tlsApp.request(`${origin}/mcp`, {
            method: "POST",
            headers,
            body,
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await tlsApp.request("http://attacker.invalid/mcp", {
            method: "POST",
            headers: { ...headers, "X-Forwarded-Host": "localhost:3003" },
            body,
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await tlsApp.request(`${origin}/mcp`, {
            method: "POST",
            headers: { ...headers, Origin: origin },
            body,
          })
        ).status,
      ).toBe(403);
    });
    test("workspace boundaries and conditional scope intersections hold", async () => {
      const own = await createLink(ctx, {
        url: "https://example.com/private-mcp",
      });
      if (!own.ok) throw new Error(own.error);
      const otherId = new ObjectId().toHexString();
      const workspace = await ensurePersonalWorkspace(db, {
        id: otherId,
        name: "Other MCP",
      });
      await collection(db, "workspaces").updateOne(
        { _id: workspace._id },
        { $set: { platformFeatures: { mcp: true } } },
      );
      const other = await createApiKey(
        { ...ctx, workspace, actor: { userId: otherId, role: "owner" } },
        { name: "Other", scopes: [...apiScopes] },
        pepper,
      );
      if (!other.ok) throw new Error(other.error);
      keys.push(other.value.key.id);
      const client = await connect(other.value.secret);
      expect(
        (await call(client, "get_link", { id: own.value.id })).structuredContent
          ?.error?.code,
      ).toBe("not_found");
      expect(
        (
          await call(client, "update_link", {
            id: own.value.id,
            title: "Stolen",
          })
        ).structuredContent?.error?.code,
      ).toBe("not_found");
      expect(
        (await call(client, "archive_link", { id: own.value.id }))
          .structuredContent?.data,
      ).toEqual({ deleted: [] });
      expect(
        (
          await collection(db, "links").findOne({
            _id: new ObjectId(own.value.id),
          })
        )?.deletedAt,
      ).toBeUndefined();
      const conditional = await connect(
        (await key(["links:read", "analytics:read", "bio:write", "qr:write"]))
          .secret,
      );
      expect(
        (
          await call(conditional, "search_links", {
            campaign: new ObjectId().toHexString(),
          })
        ).structuredContent?.error?.code,
      ).toBe("insufficient_scope");
      expect(
        (
          await call(conditional, "add_bio_link", {
            page: new ObjectId().toHexString(),
            url: "https://example.com",
          })
        ).structuredContent?.error?.code,
      ).toBe("insufficient_scope");
      const noLinks = await connect(
        (await key(["qr:*", "analytics:read"])).secret,
      );
      expect(
        (await call(noLinks, "create_qr_code", { linkKey: own.value.key }))
          .structuredContent?.error?.code,
      ).toBe("insufficient_scope");
      expect(
        (
          await call(noLinks, "get_analytics", {
            linkKey: own.value.key,
            range: { from: "2026-10-01T00:00:00Z", to: "2026-10-02T00:00:00Z" },
          })
        ).structuredContent?.error?.code,
      ).toBe("insufficient_scope");
    });
    test("member removal, key expiry and IP restrictions deny subsequent requests", async () => {
      const credential = await key(),
        client = await connect(credential.secret);
      const members = collection(db, "workspace_members");
      const member = (await members.findOne({
        workspaceId: ctx.workspace._id,
        userId: ctx.actor.userId,
      }))!;
      await members.deleteOne({ _id: member._id });
      try {
        await expect(client.listTools()).rejects.toThrow();
      } finally {
        await members.insertOne(member);
      }
      await collection(db, "api_keys").updateOne(
        { _id: new ObjectId(credential.key.id) },
        { $set: { expiresAt: new Date(0) } },
      );
      await expect(client.listTools()).rejects.toThrow();
      const restricted = await createApiKey(
        ctx,
        { name: "IP", scopes: ["links:read"], ipAllowlist: ["127.0.0.2"] },
        pepper,
      );
      if (!restricted.ok) throw new Error(restricted.error);
      keys.push(restricted.value.key.id);
      await expect(connect(restricted.value.secret)).rejects.toThrow();
    });
    test("rate budgets are enforced under the same key namespace as REST", async () => {
      const credential = await key(),
        client = await connect(credential.secret);
      const values = Array.from({ length: 600 }, (_, index) => [
        Date.now(),
        `rest-request-${index}`,
      ]).flat();
      await cache.zadd(`api:rate:${credential.key.id}`, ...values);
      await expect(client.listTools()).rejects.toThrow("rate_limited");
    });
    test("tag analytics and campaign searches stay scoped and pagination is bounded", async () => {
      const credential = await key(),
        client = await connect(credential.secret);
      const tagged = await createLink(ctx, {
        url: "https://example.com/tagged-mcp",
        tags: ["MCP analytics"],
      });
      const decoy = await createLink(ctx, {
        url: "https://example.com/decoy-mcp",
      });
      if (!tagged.ok || !decoy.ok) throw new Error("Synthetic fixtures failed");
      const from = new Date(Date.now() - 3600000),
        ts = new Date(Date.now() - 1000);
      await db.collection(physicalNames.click_events).insertMany(
        [tagged.value.id, decoy.value.id].map((id) => ({
          ts,
          m: {
            workspaceId: ctx.workspace._id,
            linkId: new ObjectId(id),
            kind: "click",
          },
          ipHash: id,
        })),
      );
      const analytics = await call(client, "get_analytics", {
        tag: "MCP analytics",
        range: { from: from.toISOString(), to: new Date().toISOString() },
      });
      expect(analytics.structuredContent?.data).toMatchObject({
        totals: { clicks: 1 },
      });
      const campaign = z.object({ id: z.string() }).parse(
        (
          await call(client, "create_campaign", {
            title: "MCP search membership",
          })
        ).structuredContent?.data,
      );
      await collection(db, "campaigns").updateOne(
        { _id: new ObjectId(campaign.id) },
        { $set: { links: [new ObjectId(tagged.value.id)] } },
      );
      const search = await call(client, "search_links", {
        campaign: campaign.id,
        limit: 1,
      });
      expect(search.structuredContent?.data).toMatchObject({
        total: 1,
        items: [{ id: tagged.value.id }],
      });
      const first = z
        .object({
          items: z.array(z.object({ id: z.string() })),
          nextCursor: z.string(),
        })
        .parse(
          (await call(client, "search_links", { limit: 1 })).structuredContent
            ?.data,
        );
      const second = z
        .object({ items: z.array(z.object({ id: z.string() })) })
        .parse(
          (
            await call(client, "search_links", {
              limit: 1,
              cursor: first.nextCursor,
            })
          ).structuredContent?.data,
        );
      expect(first.items).toHaveLength(1);
      expect(second.items).toHaveLength(1);
      expect(second.items[0]?.id).not.toBe(first.items[0]?.id);
    });
    test("bio append failures roll back new links and webhook events; concurrent appends retain both links", async () => {
      const client = await connect((await key()).secret);
      const before = await collection(db, "links").countDocuments(),
        events = await collection(db, "webhook_events").countDocuments();
      expect(
        (
          await call(client, "add_bio_link", {
            page: new ObjectId().toHexString(),
            url: "https://example.com/orphan",
          })
        ).structuredContent?.error?.code,
      ).toBe("not_found");
      expect(await collection(db, "links").countDocuments()).toBe(before);
      expect(await collection(db, "webhook_events").countDocuments()).toBe(
        events,
      );
      const bio = await createBioPage(ctx, {
        slug: `mcp-${crypto.randomUUID().slice(0, 8)}`,
      });
      if (!bio.ok) throw new Error(bio.error);
      const results = await Promise.all(
        ["one", "two"].map((title) =>
          call(client, "add_bio_link", {
            page: bio.value.id,
            url: `https://example.com/${title}`,
            title,
          }),
        ),
      );
      expect(results.every((result) => !result.isError)).toBe(true);
      expect(
        (
          await collection(db, "bio_pages").findOne({
            _id: new ObjectId(bio.value.id),
          })
        )?.links,
      ).toHaveLength(2);
    });
    test("full bio pages roll back creation even when two appends race for the last slot", async () => {
      const client = await connect((await key()).secret);
      const link = await createLink(ctx, {
        url: "https://example.com/existing-bio",
      });
      const page = await createBioPage(ctx, {
        slug: `mcp-${crypto.randomUUID().slice(0, 8)}`,
      });
      if (!link.ok || !page.ok) throw new Error("Synthetic fixtures failed");
      await db.collection(physicalNames.bio_pages).updateOne(
        { _id: new ObjectId(page.value.id) },
        {
          $set: {
            links: Array.from({ length: 99 }, () => ({
              link: new ObjectId(link.value.id),
              addedAt: new Date(),
            })),
          },
        },
      );
      const before = await collection(db, "links").countDocuments(),
        events = await collection(db, "webhook_events").countDocuments();
      const results = await Promise.all(
        ["one", "two"].map((title) =>
          call(client, "add_bio_link", {
            page: page.value.id,
            url: `https://example.com/last-${title}`,
          }),
        ),
      );
      expect(results.filter((result) => !result.isError)).toHaveLength(1);
      expect(
        results.find((result) => result.isError)?.structuredContent?.error
          ?.code,
      ).toBe("limit_reached");
      expect(await collection(db, "links").countDocuments()).toBe(before + 1);
      expect(await collection(db, "webhook_events").countDocuments()).toBe(
        events + 1,
      );
      expect(
        (
          await collection(db, "bio_pages").findOne({
            _id: new ObjectId(page.value.id),
          })
        )?.links,
      ).toHaveLength(100);
    });
    test("bio append preserves personal legacy ownership without exposing another user's page", async () => {
      const client = await connect((await key()).secret);
      const legacySub = `mcp-legacy-${crypto.randomUUID()}`,
        page = new ObjectId(),
        foreign = new ObjectId();
      await collection(db, "workspaces").updateOne(
        { _id: ctx.workspace._id },
        { $set: { legacySub } },
      );
      await db.collection(physicalNames.bio_pages).insertMany([
        { _id: page, userId: legacySub, slug: "legacy-mcp", links: [] },
        {
          _id: foreign,
          userId: `${legacySub}-foreign`,
          slug: "foreign-mcp",
          links: [],
        },
      ]);
      try {
        expect(
          (
            await call(client, "add_bio_link", {
              page: page.toHexString(),
              url: "https://example.com/legacy-owned",
            })
          ).isError,
        ).toBeUndefined();
        expect(
          (await collection(db, "bio_pages").findOne({ _id: page }))?.links,
        ).toHaveLength(1);
        const before = await collection(db, "links").countDocuments();
        expect(
          (
            await call(client, "add_bio_link", {
              page: foreign.toHexString(),
              url: "https://example.com/legacy-foreign",
            })
          ).structuredContent?.error?.code,
        ).toBe("not_found");
        expect(await collection(db, "links").countDocuments()).toBe(before);
      } finally {
        await collection(db, "workspaces").updateOne(
          { _id: ctx.workspace._id },
          { $unset: { legacySub: "" } },
        );
      }
    });
    test("audit intent gates mutations and completion outages retain successful intent", async () => {
      const credential = await key(),
        client = await connect(credential.secret);
      const before = await collection(db, "links").countDocuments();
      await db.command({
        collMod: physicalNames.audit_log,
        validator: { $expr: { $eq: [1, 0] } },
        validationLevel: "strict",
        validationAction: "error",
      });

      try {
        expect(
          (
            await call(client, "create_link", {
              url: "https://example.com/audit-denied",
            })
          ).structuredContent?.error?.code,
        ).toBe("internal_error");
        expect(await collection(db, "links").countDocuments()).toBe(before);
      } finally {
        await db.command({ collMod: physicalNames.audit_log, validator: {} });
      }
      await db.command({
        collMod: physicalNames.audit_log,
        validator: { status: "started" },
        validationLevel: "strict",
        validationAction: "error",
      });
      try {
        expect(
          (
            await call(client, "create_link", {
              url: "https://example.com/audit-completion",
            })
          ).isError,
        ).toBeUndefined();
        expect(await collection(db, "links").countDocuments()).toBe(before + 1);
        expect(
          (
            await collection(db, "audit_log").findOne({
              credentialId: credential.key.id,
            })
          )?.status,
        ).toBe("started");
        expect(logs).toContain(
          "MCP audit completion unavailable; durable intent retained",
        );
      } finally {
        await db.command({ collMod: physicalNames.audit_log, validator: {} });
      }
    });
  },
);
