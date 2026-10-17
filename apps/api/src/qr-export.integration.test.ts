import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import Redis from "ioredis";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { collection, desiredIndexes, physicalNames } from "@shortn/db";
import {
  apiScopes,
  createApiKey,
  createLink,
  createQr,
  ensurePersonalWorkspace,
  qrExportJobs,
  qrZipJobs,
  qrZipItems,
  revokeApiKey,
  type ApiScope,
  type ServiceContext,
} from "@shortn/core";
import type { ObjectStore } from "@shortn/storage";
import { runQrExport } from "../../worker/src/qr-exports";
import { runQrZipExport } from "../../worker/src/qr-zip";
import { createRestApi } from "./rest";
import { createMcpApp } from "./mcp";
import { z } from "zod";

const mongo = process.env.MONGO_TEST_URL,
  redis = process.env.REDIS_TEST_URL;
const pepper = "synthetic-qr-api-export-pepper-".repeat(3);
(mongo && redis ? describe : describe.skip)(
  "QR export REST and MCP contracts",
  () => {
    let client: MongoClient, db: Db, cache: Redis;
    const clients: Client[] = [],
      rateKeys: string[] = [];
    beforeAll(async () => {
      for (const value of [mongo!, redis!])
        if (!["127.0.0.1", "localhost"].includes(new URL(value).hostname))
          throw new Error("Loopback fixtures required");
      client = await new MongoClient(mongo!).connect();
      db = client.db(
        `shortn_qr_http_${crypto.randomUUID().replaceAll("-", "")}`,
      );
      cache = new Redis(redis!);
      await qrExportJobs(db).createIndexes(
        desiredIndexes[physicalNames.qr_export_jobs]!,
      );
      await qrZipJobs(db).createIndexes(
        desiredIndexes[physicalNames.qr_zip_jobs]!,
      );
      await qrZipItems(db).createIndexes(
        desiredIndexes[physicalNames.qr_zip_items]!,
      );
    });
    afterAll(async () => {
      await Promise.all(clients.map((client) => client.close()));
      for (const id of rateKeys)
        await cache.del(`api:rate:${id}`, `apikey:last-used:${id}`);
      await db?.dropDatabase();
      await client?.close();
      cache?.disconnect();
    });
    async function fixture() {
      const userId = new ObjectId().toHexString();
      const workspace = await ensurePersonalWorkspace(db, {
        id: userId,
        name: "Synthetic QR HTTP",
      });
      await collection(db, "workspaces").updateOne(
        { _id: workspace._id },
        { $set: { platformFeatures: { api: true, mcp: true } } },
      );
      const ctx: ServiceContext = {
        db,
        workspace,
        cache,
        linkDomain: "shortn.at",
        actor: { userId, role: "owner" },
      };
      const qr = await createQr(ctx, {
        url: "https://example.com/synthetic",
        design: {
          shape: "circle",
          frameOptions: { style: "outline", caption: "Synthetic HTTP café" },
        },
      });
      if (!qr.ok) throw new Error(qr.error);
      const key = async (scopes: ApiScope[] = [...apiScopes]) => {
        const result = await createApiKey(
          ctx,
          { name: "Synthetic export key", scopes },
          pepper,
        );
        if (!result.ok) throw new Error(result.error);
        rateKeys.push(result.value.key.id);
        return result.value;
      };
      const objects = new Map<
        string,
        { bytes: Uint8Array; contentType: string }
      >();
      const store: ObjectStore = {
        head: async (key) => {
          const value = objects.get(key);
          return value
            ? { bytes: value.bytes.length, contentType: value.contentType }
            : null;
        },
        get: async (key) => {
          const value = objects.get(key);
          if (!value) throw new Error("No object in fixture");
          return value.bytes;
        },
        put: async (key, bytes, contentType) => {
          objects.set(key, { bytes, contentType });
        },
        sign: async (_key, seconds) =>
          `https://storage.example/synthetic-download?expires=${seconds}`,
        putStream: async (key, chunks, contentType, maximum) => {
          const pieces: Uint8Array[] = [];
          let bytes = 0;
          for await (const piece of chunks) {
            bytes += piece.length;
            if (bytes > maximum) throw new Error("archive_too_large");
            pieces.push(piece);
          }
          objects.set(key, {
            bytes: new Uint8Array(Buffer.concat(pieces)),
            contentType,
          });
          return bytes;
        },
      };
      const api = (enabled = true, sign = store.sign) =>
        createRestApi({
          db,
          cache,
          durable: cache,
          pepper,
          linkDomain: ctx.linkDomain,
          rolloutPercent: 0,
          clientIp: () => undefined,
          log: () => {},
          ...(enabled ? { qrExports: { sign } } : {}),
        });
      const request = (
        app: ReturnType<typeof api>,
        path: string,
        secret: string,
      ) =>
        app.request(path, {
          headers: { Authorization: `Bearer ${secret}` },
          redirect: "manual",
        });
      const run = (id: string) =>
        runQrExport(
          { db, store, linkDomain: ctx.linkDomain, logoOrigins: [] },
          id,
        );
      return { ctx, qr: qr.value, key, store, objects, api, request, run };
    }

    test("bulk export is a scoped idempotent read operation with progress and private ZIP delivery", async () => {
      const f = await fixture(),
        reader = await f.key(["qr:read"]),
        writer = await f.key(["qr:write"]),
        app = f.api();
      await collection(db, "workspace_members").updateOne(
        { workspaceId: f.ctx.workspace._id, userId: f.ctx.actor.userId },
        { $set: { role: "viewer" } },
      );
      const post = (
        secret: string,
        ids = [f.qr.id],
        idempotency: string = crypto.randomUUID(),
      ) =>
        app.request("/v1/qr-codes/export", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secret}`,
            "Content-Type": "application/json",
            "Idempotency-Key": idempotency,
          },
          body: JSON.stringify({ ids, format: "svg" }),
        });
      expect((await post(writer.secret)).status).toBe(403);
      expect(
        (
          await post(
            reader.secret,
            Array.from({ length: 501 }, () => f.qr.id),
          )
        ).status,
      ).toBe(400);
      const first = await post(reader.secret, [f.qr.id], "synthetic-zip-once");
      expect(first.status).toBe(202);
      const queued = await first.json();
      expect(queued.total).toBe(1);
      expect(queued.limit).toBe(500);
      expect(first.headers.get("Location")).toBe(
        `/v1/qr-exports/zip/${queued.id}`,
      );
      const replay = await post(reader.secret, [f.qr.id], "synthetic-zip-once");
      expect(replay.headers.get("Idempotency-Replayed")).toBe("true");
      expect((await replay.json()).id).toBe(queued.id);
      await runQrZipExport(
        { db, store: f.store, linkDomain: f.ctx.linkDomain, logoOrigins: [] },
        queued.id,
      );
      const status = await f.request(
        app,
        `/v1/qr-exports/zip/${queued.id}`,
        reader.secret,
      );
      expect(status.status).toBe(200);
      const completed = await status.json();
      expect(completed.state).toBe("completed");
      expect(completed.done).toBe(1);
      expect(completed.downloadUrl).toStartWith("https://storage.example/");
      expect(completed).not.toHaveProperty("objectKey");
      expect(completed).not.toHaveProperty("design");
      const foreign = await fixture(),
        foreignKey = await foreign.key(["qr:read"]);
      expect(
        (
          await f.request(
            app,
            `/v1/qr-exports/zip/${queued.id}`,
            foreignKey.secret,
          )
        ).status,
      ).toBe(404);
      await collection(db, "qr_codes").deleteOne({
        _id: new ObjectId(f.qr.id),
      });
      expect(
        (await f.request(app, `/v1/qr-exports/zip/${queued.id}`, reader.secret))
          .status,
      ).toBe(404);
      expect(
        [...f.objects.values()].some(
          (object) => object.contentType === "application/zip",
        ),
      ).toBe(true);
    });

    test("GET export queues idempotently, worker produces bytes, polling signs and ready requests redirect", async () => {
      const f = await fixture(),
        credential = await f.key(["qr:read"]),
        app = f.api();
      const path = `/v1/qr-codes/${f.qr.id}/export?format=png&size=512`;
      const first = await f.request(app, path, credential.secret);
      expect(first.status).toBe(202);
      expect(first.headers.get("Cache-Control")).toBe("private, no-store");
      const job = z
        .object({
          id: z.string(),
          state: z.literal("pending"),
          format: z.literal("png"),
          size: z.literal(512),
        })
        .parse(await first.json());
      expect(first.headers.get("Location")).toBe(`/v1/qr-exports/${job.id}`);
      const repeated = await f.request(app, path, credential.secret);
      expect((await repeated.json()).id).toBe(job.id);
      const pending = await f.request(
        app,
        `/v1/qr-exports/${job.id}`,
        credential.secret,
      );
      expect(pending.status).toBe(200);
      expect(pending.headers.get("Retry-After")).toBe("1");
      expect(await f.run(job.id)).toBe(true);
      const ready = await f.request(
        app,
        `/v1/qr-exports/${job.id}`,
        credential.secret,
      );
      const delivery = await ready.json();
      expect(delivery.state).toBe("completed");
      expect(delivery.downloadUrl).toStartWith(
        "https://storage.example/synthetic-download",
      );
      expect(delivery).not.toHaveProperty("objectKey");
      expect(delivery).not.toHaveProperty("design");
      const bytes = [...f.objects.values()][0]!;
      expect(bytes.contentType).toBe("image/png");
      expect(Buffer.from(bytes.bytes.subarray(0, 8)).toString("hex")).toBe(
        "89504e470d0a1a0a",
      );
      const redirected = await f.request(app, path, credential.secret);
      expect(redirected.status).toBe(303);
      expect(redirected.headers.get("Location")).toBe(delivery.downloadUrl);
      expect(
        await qrExportJobs(db).countDocuments({
          workspaceId: f.ctx.workspace._id,
        }),
      ).toBe(1);
    });

    test("export and job status enforce read scopes, workspace isolation, revocation, bounds and disabled gates", async () => {
      const f = await fixture(),
        foreign = await fixture(),
        reader = await f.key(["qr:read"]),
        writer = await f.key(["qr:write"]),
        other = await foreign.key(["qr:read"]),
        app = f.api();
      const path = `/v1/qr-codes/${f.qr.id}/export`;
      expect((await f.request(app, path, writer.secret)).status).toBe(403);
      expect(
        (await f.request(app, `${path}?size=8192`, reader.secret)).status,
      ).toBe(400);
      expect(
        (await f.request(app, `${path}?format=html`, reader.secret)).status,
      ).toBe(400);
      expect((await f.request(f.api(false), path, reader.secret)).status).toBe(
        404,
      );
      const job = await (await f.request(app, path, reader.secret)).json();
      expect(
        (await f.request(app, `/v1/qr-exports/${job.id}`, writer.secret))
          .status,
      ).toBe(403);
      expect(
        (await f.request(app, `/v1/qr-exports/${job.id}`, other.secret)).status,
      ).toBe(404);
      await collection(db, "workspace_members").updateOne(
        { workspaceId: f.ctx.workspace._id, userId: f.ctx.actor.userId },
        { $set: { role: "viewer" } },
      );
      expect((await f.request(app, path, reader.secret)).status).toBe(202);
      await collection(db, "workspace_members").updateOne(
        { workspaceId: f.ctx.workspace._id, userId: f.ctx.actor.userId },
        { $set: { role: "owner" } },
      );
      await revokeApiKey(f.ctx, reader.key.id);
      expect(
        (await f.request(app, `/v1/qr-exports/${job.id}`, reader.secret))
          .status,
      ).toBe(401);
    });

    test("signing failures and invalid print designs expose stable errors without private details", async () => {
      const f = await fixture(),
        credential = await f.key(["qr:read"]),
        app = f.api();
      const path = `/v1/qr-codes/${f.qr.id}/export`;
      const job = await (await f.request(app, path, credential.secret)).json();
      await f.run(job.id);
      const unavailable = await f.request(
        f.api(true, async () => {
          throw new Error("private internal S3 credential");
        }),
        `/v1/qr-exports/${job.id}`,
        credential.secret,
      );
      expect(unavailable.status).toBe(503);
      expect((await unavailable.json()).code).toBe("storage_unavailable");
      await collection(db, "qr_codes").updateOne(
        { _id: new ObjectId(f.qr.id) },
        { $set: { "options.dotsOptions.color": "#ddd" } },
      );
      const bad = await (await f.request(app, path, credential.secret)).json();
      await f.run(bad.id);
      const rejected = await f.request(app, path, credential.secret);
      expect(rejected.status).toBe(409);
      expect((await rejected.json()).context.reason).toBe("low_contrast");
      await qrExportJobs(db).updateOne(
        { _id: new ObjectId(job.id) },
        { $set: { expiresAt: new Date(0) } },
      );
      expect(
        (await f.request(app, `/v1/qr-exports/${job.id}`, credential.secret))
          .status,
      ).toBe(404);
    });

    test("MCP create returns a recoverable job, polling returns the signed artifact, and unauthorized scopes fail", async () => {
      const f = await fixture(),
        credential = await f.key(),
        restricted = await f.key(["qr:write", "links:read"]);
      const link = await createLink(f.ctx, {
        url: "https://example.com/mcp-export",
      });
      if (!link.ok) throw new Error(link.error);
      const app = createMcpApp({
        db,
        cache,
        pepper,
        linkDomain: f.ctx.linkDomain,
        origin: "http://localhost:3003",
        clientIp: () => undefined,
        log: () => {},
        qrExports: { sign: f.store.sign, waitMs: 0 },
      });
      async function connect(secret: string) {
        const client = new Client({
          name: "synthetic-qr-export",
          version: "1",
        });
        clients.push(client);
        await client.connect(
          new StreamableHTTPClientTransport(
            new URL("http://localhost:3003/mcp"),
            {
              requestInit: { headers: { Authorization: `Bearer ${secret}` } },
              fetch: async (url, init) =>
                app.fetch(new Request(String(url), init)),
            },
          ) as Parameters<Client["connect"]>[0],
        );
        return client;
      }
      const owner = await connect(credential.secret);
      const result = z
        .object({
          structuredContent: z.object({
            data: z.object({
              id: z.string(),
              exportJobId: z.string(),
              exportStatus: z.literal("pending"),
              exportUrl: z.null(),
            }),
          }),
        })
        .parse(
          await owner.callTool({
            name: "create_qr_code",
            arguments: { linkKey: link.value.key, format: "pdf" },
          }),
        );
      const created = result.structuredContent.data;
      await f.run(created.exportJobId);
      const ready = await owner.callTool({
        name: "get_qr_export",
        arguments: { id: created.exportJobId },
      });
      const content = z
        .object({
          structuredContent: z.object({
            data: z.object({
              state: z.literal("completed"),
              downloadUrl: z.string(),
            }),
          }),
        })
        .parse(ready);
      expect(content.structuredContent.data.downloadUrl).toStartWith(
        "https://storage.example/",
      );
      const denied = await (
        await connect(restricted.secret)
      ).callTool({
        name: "get_qr_export",
        arguments: { id: created.exportJobId },
      });
      expect(denied.isError).toBe(true);
      expect(JSON.stringify(denied)).toContain("insufficient_scope");
      const foreign = await fixture(),
        foreignCredential = await foreign.key(["qr:read"]);
      const isolated = await (
        await connect(foreignCredential.secret)
      ).callTool({
        name: "get_qr_export",
        arguments: { id: created.exportJobId },
      });
      expect(isolated.isError).toBe(true);
      expect(JSON.stringify(isolated)).toContain("not_found");
      const outageApp = createMcpApp({
        db,
        cache,
        pepper,
        linkDomain: f.ctx.linkDomain,
        origin: "http://localhost:3003",
        clientIp: () => undefined,
        log: () => {},
        qrExports: {
          sign: async () => {
            throw new Error("private signing secret");
          },
        },
      });
      const outageClient = new Client({
        name: "synthetic-storage-outage",
        version: "1",
      });
      clients.push(outageClient);
      await outageClient.connect(
        new StreamableHTTPClientTransport(
          new URL("http://localhost:3003/mcp"),
          {
            requestInit: {
              headers: { Authorization: `Bearer ${credential.secret}` },
            },
            fetch: async (url, init) =>
              outageApp.fetch(new Request(String(url), init)),
          },
        ) as Parameters<Client["connect"]>[0],
      );
      const outage = await outageClient.callTool({
        name: "get_qr_export",
        arguments: { id: created.exportJobId },
      });
      expect(JSON.stringify(outage)).toContain("storage_unavailable");
      expect(JSON.stringify(outage)).not.toContain("private signing secret");
      expect([...f.objects.values()][0]!.contentType).toBe("application/pdf");
      expect(
        await qrExportJobs(db).countDocuments({
          workspaceId: f.ctx.workspace._id,
        }),
      ).toBe(1);
    });

    test("MCP create returns the finished export URL when a worker completes within the bounded wait", async () => {
      const f = await fixture(),
        credential = await f.key();
      const link = await createLink(f.ctx, {
        url: "https://example.com/mcp-ready",
      });
      if (!link.ok) throw new Error(link.error);
      const app = createMcpApp({
        db,
        cache,
        pepper,
        linkDomain: f.ctx.linkDomain,
        origin: "http://localhost:3003",
        clientIp: () => undefined,
        log: () => {},
        qrExports: { sign: f.store.sign },
      });
      const client = new Client({ name: "synthetic-qr-ready", version: "1" });
      clients.push(client);
      await client.connect(
        new StreamableHTTPClientTransport(
          new URL("http://localhost:3003/mcp"),
          {
            requestInit: {
              headers: { Authorization: `Bearer ${credential.secret}` },
            },
            fetch: async (url, init) =>
              app.fetch(new Request(String(url), init)),
          },
        ) as Parameters<Client["connect"]>[0],
      );
      let inFlight: Promise<void> | undefined;
      const failures: unknown[] = [];
      const pump = () => {
        if (!inFlight)
          inFlight = (async () => {
            const due = await qrExportJobs(db)
              .find({ workspaceId: f.ctx.workspace._id, state: "pending" })
              .limit(5)
              .toArray();
            for (const job of due) await f.run(job._id.toHexString());
          })()
            .catch((error) => {
              failures.push(error);
            })
            .finally(() => {
              inFlight = undefined;
            });
      };
      const interval = setInterval(pump, 25);
      try {
        const result = await client.callTool({
          name: "create_qr_code",
          arguments: { linkKey: link.value.key, format: "svg" },
        });
        const content = z
          .object({
            structuredContent: z.object({
              data: z.object({
                id: z.string(),
                exportJobId: z.string(),
                exportStatus: z.literal("completed"),
                exportUrl: z.string().url(),
              }),
            }),
          })
          .parse(result);
        expect(content.structuredContent.data.exportUrl).toStartWith(
          "https://storage.example/",
        );
        expect([...f.objects.values()][0]!.contentType).toBe("image/svg+xml");
        expect(failures).toEqual([]);
        expect(
          await db
            .collection(physicalNames.audit_log)
            .countDocuments({
              workspaceId: f.ctx.workspace._id,
              tool: "create_qr_code",
            }),
        ).toBe(1);
      } finally {
        clearInterval(interval);
        await inFlight;
      }
    });
  },
);
