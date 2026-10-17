import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import Redis from "ioredis";
import { collection, desiredIndexes, physicalNames } from "@shortn/db";
import {
  createQr,
  ensurePersonalWorkspace,
  getQrExport,
  qrExportDelivery,
  qrExportJobs,
  requestQrExport,
  type ServiceContext,
} from "@shortn/core";
import type { ObjectStore } from "@shortn/storage";
import { createQrExportWorker, runQrExport } from "./qr-exports";

const mongo = process.env.MONGO_TEST_URL,
  redis = process.env.REDIS_DURABLE_TEST_URL;
(mongo && redis ? describe : describe.skip)(
  "private durable QR exports",
  () => {
    let client: MongoClient, db: Db, durable: Redis;
    beforeAll(async () => {
      for (const url of [mongo!, redis!])
        if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname))
          throw new Error("Loopback fixtures required");
      client = await new MongoClient(mongo!).connect();
      db = client.db(
        `shortn_qr_exports_${crypto.randomUUID().replaceAll("-", "")}`,
      );
      durable = new Redis(redis!);
      await qrExportJobs(db).createIndexes(
        desiredIndexes[physicalNames.qr_export_jobs]!,
      );
    });
    afterAll(async () => {
      await db?.dropDatabase();
      await client?.close();
      durable?.disconnect();
    });
    async function fixture() {
      const userId = new ObjectId().toHexString();
      const ctx: ServiceContext = {
        db,
        cache: durable,
        workspace: await ensurePersonalWorkspace(db, {
          id: userId,
          name: "Synthetic QR export",
        }),
        actor: { userId, role: "owner" },
        linkDomain: "shortn.at",
      };
      const qr = await createQr(ctx, {
        url: "https://example.com/synthetic",
        design: {
          shape: "circle",
          frameOptions: { style: "outline", caption: "São João — scan" },
        },
      });
      if (!qr.ok) throw new Error(qr.error);
      return { ctx, qr: qr.value };
    }
    function store() {
      const objects = new Map<
        string,
        { bytes: Uint8Array; contentType: string }
      >();
      let writes = 0;
      const value: ObjectStore = {
        async head(key) {
          const object = objects.get(key);
          return object
            ? { bytes: object.bytes.length, contentType: object.contentType }
            : null;
        },
        async get(key) {
          const object = objects.get(key);
          if (!object) throw new Error("missing");
          return object.bytes;
        },
        async put(key, bytes, contentType) {
          writes++;
          objects.set(key, { bytes, contentType });
        },
        async sign() {
          return "https://storage.example/synthetic-signed-download";
        },
      };
      return { value, objects, writes: () => writes };
    }
    async function requested(
      ctx: ServiceContext,
      qrId: string,
      format: "svg" | "png" | "pdf" = "svg",
    ) {
      const result = await requestQrExport(ctx, qrId, { format });
      if (!result.ok) throw new Error(result.error);
      return result.value;
    }
    const dependencies = (value: ObjectStore) => ({
      db,
      store: value,
      linkDomain: "shortn.at",
      logoOrigins: ["https://app.shortn.at"],
    });

    test("deduplicates concurrent requests, isolates tenants and protects private metadata", async () => {
      const { ctx, qr } = await fixture(),
        other = await fixture();
      const requests = await Promise.all(
        Array.from({ length: 8 }, () => requested(ctx, qr.id)),
      );
      expect(new Set(requests.map((job) => job.id)).size).toBe(1);
      expect(requests[0]).not.toHaveProperty("design");
      expect(requests[0]).not.toHaveProperty("objectKey");
      expect(await getQrExport(other.ctx, requests[0]!.id)).toBeNull();
      const foreign = await requestQrExport(other.ctx, qr.id, {
        format: "svg",
      });
      expect(foreign.ok).toBe(false);
      expect(
        (await getQrExport(ctx, requests[0]!.id))?.qrId.toHexString(),
      ).toBe(qr.id);
    });

    test("renders snapshots, retries storage failures and reuses private cache", async () => {
      const { ctx, qr } = await fixture(),
        memory = store();
      const job = await requested(ctx, qr.id);
      await collection(db, "qr_codes").updateOne(
        { _id: new ObjectId(qr.id) },
        { $set: { "options.dotsOptions.color": "#ddd" } },
      );
      expect(await runQrExport(dependencies(memory.value), job.id)).toBe(true);
      const completed = (await getQrExport(ctx, job.id))!;
      expect(completed.state).toBe("completed");
      expect(completed.objectKey).toStartWith(
        `exports/qr/${ctx.workspace._id}/`,
      );
      expect(completed.print?.quietModules).toBeGreaterThanOrEqual(4);
      expect(memory.writes()).toBe(1);
      let signedKey = "",
        signedSeconds = 0;
      const delivery = await qrExportDelivery(
        ctx,
        job.id,
        async (key, seconds) => {
          signedKey = key;
          signedSeconds = seconds;
          return "https://storage.example/private-synthetic-download";
        },
      );
      expect(delivery).toHaveProperty("downloadUrl");
      expect(delivery).not.toHaveProperty("objectKey");
      expect(signedKey).toBe(completed.objectKey!);
      expect(signedSeconds).toBeGreaterThan(86000);
      expect(signedSeconds).toBeLessThanOrEqual(86400);
      // A second pending request with the same snapshot tests the cache path.
      const original = (await qrExportJobs(db).findOne({
        _id: new ObjectId(job.id),
      }))!;
      const next = {
        ...original,
        _id: new ObjectId(),
        requestKey: crypto.randomUUID(),
        state: "pending" as const,
        attempts: 0,
      };
      await qrExportJobs(db).insertOne(next);
      await runQrExport(dependencies(memory.value), next._id.toHexString());
      expect(memory.writes()).toBe(1);
      const pngJob = await requested(ctx, qr.id, "png");
      // Invalid design is permanent and never reaches storage.
      await runQrExport(dependencies(memory.value), pngJob.id);
      expect((await getQrExport(ctx, pngJob.id))?.error).toBe("low_contrast");
      await qrExportJobs(db).updateOne(
        { _id: next._id },
        { $set: { state: "pending" }, $unset: { objectKey: "" } },
      );
      await runQrExport(
        dependencies({
          ...memory.value,
          head: async () => {
            throw new Error("secret internal service failure");
          },
        }),
        next._id.toHexString(),
      );
      const retried = await qrExportJobs(db).findOne({ _id: next._id });
      expect(retried?.state).toBe("pending");
      expect(retried?.error).toBe("storage_unavailable");
      expect(retried?.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    });

    test("removed creators, deleted QR codes and arbitrary logo URLs fail closed", async () => {
      const { ctx, qr } = await fixture(),
        memory = store(),
        job = await requested(ctx, qr.id);
      await collection(db, "workspace_members").deleteOne({
        workspaceId: ctx.workspace._id,
        userId: ctx.actor.userId,
      });
      await runQrExport(dependencies(memory.value), job.id);
      expect(
        (await qrExportJobs(db).findOne({ _id: new ObjectId(job.id) }))?.error,
      ).toBe("access_removed");
      expect(await getQrExport(ctx, job.id)).toBeNull();
      expect((await requestQrExport(ctx, qr.id, { format: "png" })).ok).toBe(
        false,
      );
      const second = await fixture();
      await collection(db, "qr_codes").updateOne(
        { _id: new ObjectId(second.qr.id) },
        { $set: { "options.image": "http://127.0.0.1:9999/never-fetch" } },
      );
      const imageJob = await requested(second.ctx, second.qr.id);
      let reads = 0;
      await runQrExport(
        dependencies({
          ...memory.value,
          get: async () => {
            reads++;
            throw new Error();
          },
        }),
        imageJob.id,
      );
      expect(reads).toBe(0);
      expect((await getQrExport(second.ctx, imageJob.id))?.error).toBe(
        "logo_unavailable",
      );
      const deleted = await requested(second.ctx, second.qr.id, "pdf");
      await collection(db, "qr_codes").deleteOne({
        _id: new ObjectId(second.qr.id),
      });
      await runQrExport(dependencies(memory.value), deleted.id);
      expect(
        (await qrExportJobs(db).findOne({ _id: new ObjectId(deleted.id) }))
          ?.error,
      ).toBe("access_removed");
      expect(memory.writes()).toBe(0);
    });

    test("reclaims an expired lease, fences duplicate workers and ignores expired jobs", async () => {
      const { ctx, qr } = await fixture(),
        memory = store(),
        job = await requested(ctx, qr.id);
      await qrExportJobs(db).updateOne(
        { _id: new ObjectId(job.id) },
        {
          $set: {
            state: "running",
            leaseToken: "dead-worker",
            leaseUntil: new Date(0),
          },
        },
      );
      const results = await Promise.all([
        runQrExport(dependencies(memory.value), job.id),
        runQrExport(dependencies(memory.value), job.id),
      ]);
      expect(results.filter(Boolean).length).toBe(1);
      expect(memory.writes()).toBe(1);
      const expired = await requested(ctx, qr.id, "png");
      await qrExportJobs(db).updateOne(
        { _id: new ObjectId(expired.id) },
        { $set: { expiresAt: new Date(0) } },
      );
      expect(await runQrExport(dependencies(memory.value), expired.id)).toBe(
        false,
      );
      expect(await getQrExport(ctx, expired.id)).toBeNull();
    });

    test("Mongo outbox pumps through real durable Redis and completes after worker startup", async () => {
      const { ctx, qr } = await fixture(),
        memory = store(),
        job = await requested(ctx, qr.id, "png");
      const bounded = durable.duplicate({ commandTimeout: 1000 });
      const errors: unknown[] = [];
      const worker = createQrExportWorker({
        ...dependencies(memory.value),
        durable: bounded,
        queueName: `qr-export-test-${crypto.randomUUID()}`,
        log: (_message, error) => {
          if (error) errors.push(error);
        },
      });
      try {
        // Production parents have a command timeout. Blocking consumers must
        // survive an idle interval longer than that bound, then process work.
        await worker.worker.waitUntilReady();
        await Bun.sleep(1300);
        expect(errors).toHaveLength(0);
        await worker.pump();
        const deadline = Date.now() + 15_000;
        while (
          Date.now() < deadline &&
          (await getQrExport(ctx, job.id))?.state !== "completed"
        )
          await Bun.sleep(50);
        expect((await getQrExport(ctx, job.id))?.state).toBe("completed");
        expect(memory.writes()).toBeGreaterThan(0);
      } finally {
        await worker.queue.obliterate({ force: true });
        await worker.close();
        bounded.disconnect();
      }
    }, 20_000);
  },
);
