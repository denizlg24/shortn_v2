import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import Redis from "ioredis";
import { unzipSync } from "fflate";
import { collection, physicalNames, desiredIndexes } from "@shortn/db";
import {
  createQr,
  ensurePersonalWorkspace,
  requestQrZip,
  qrZipJobs,
  qrZipItems,
  qrZipDelivery,
  QR_ZIP_LIMIT,
  QR_ZIP_MAX_BYTES,
  type ServiceContext,
} from "@shortn/core";
import type { ObjectStore } from "@shortn/storage";
import { runQrZipExport } from "./qr-zip";
import { createQrExportWorker } from "./qr-exports";

const mongo = process.env.MONGO_TEST_URL,
  redis = process.env.REDIS_DURABLE_TEST_URL;
(mongo && redis ? describe : describe.skip)(
  "bounded private QR ZIP jobs",
  () => {
    let client: MongoClient, db: Db, durable: Redis;
    beforeAll(async () => {
      for (const url of [mongo!, redis!])
        if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname))
          throw new Error("Loopback fixtures required");
      client = await new MongoClient(mongo!).connect();
      db = client.db(
        `shortn_qr_zip_${crypto.randomUUID().replaceAll("-", "")}`,
      );
      durable = new Redis(redis!);
      for (const name of [
        physicalNames.qr_zip_jobs,
        physicalNames.qr_zip_items,
      ])
        await db.collection(name).createIndexes(desiredIndexes[name]!);
    });
    afterAll(async () => {
      await db?.dropDatabase();
      await client?.close();
      durable?.disconnect();
    });
    async function fixture(count = 3) {
      const userId = new ObjectId().toHexString(),
        workspace = await ensurePersonalWorkspace(db, {
          id: userId,
          name: "Synthetic bulk QR",
        });
      const ctx: ServiceContext = {
        db,
        cache: durable,
        workspace,
        actor: { userId, role: "owner" },
        linkDomain: "shortn.at",
      };
      const base = await createQr(ctx, {
        url: "https://example.com/synthetic",
      });
      if (!base.ok) throw new Error(base.error);
      const original = (await collection(db, "qr_codes").findOne({
        _id: new ObjectId(base.value.id),
      }))!;
      const rows = Array.from({ length: count - 1 }, (_, index) => ({
        ...original,
        _id: new ObjectId(),
        qrCodeId: `synthetic-${index}`,
        options: {
          ...original.options,
          data: `https://shortn.at/synthetic-${index}`,
        },
      }));
      if (rows.length) await collection(db, "qr_codes").insertMany(rows);
      const ids = [base.value.id, ...rows.map((row) => row._id.toHexString())];
      return { ctx, ids };
    }
    function memory() {
      const objects = new Map<
          string,
          { bytes: Uint8Array; contentType: string }
        >(),
        writes = new Map<string, number>();
      const store: ObjectStore = {
        head: async (key) => {
          const value = objects.get(key);
          return value
            ? { bytes: value.bytes.length, contentType: value.contentType }
            : null;
        },
        get: async (key, maximum) => {
          const value = objects.get(key);
          if (!value || value.bytes.length > maximum)
            throw new Error("missing");
          return value.bytes;
        },
        put: async (key, bytes, contentType) => {
          writes.set(key, (writes.get(key) ?? 0) + 1);
          objects.set(key, { bytes, contentType });
        },
        sign: async (key, seconds) =>
          `https://storage.example/synthetic.zip?expires=${seconds}&path=${encodeURIComponent(key)}`,
        putStream: async (key, chunks, contentType, maximum) => {
          const result: Uint8Array[] = [];
          let size = 0;
          for await (const chunk of chunks) {
            size += chunk.length;
            if (size > maximum) throw new Error("archive_too_large");
            result.push(chunk);
          }
          const bytes = new Uint8Array(Buffer.concat(result));
          objects.set(key, { bytes, contentType });
          return size;
        },
      };
      return { store, objects, writes };
    }
    async function requested(
      ctx: ServiceContext,
      ids: string[],
      format: "svg" | "png" | "pdf" = "svg",
    ) {
      const result = await requestQrZip(ctx, { ids, format });
      if (!result.ok) throw new Error(result.error);
      return result.value;
    }
    const deps = (store: ObjectStore) => ({
      db,
      store,
      linkDomain: "shortn.at",
      logoOrigins: [],
    });

    test("selects 500 of 1001 codes without including the rest and atomically rejects foreign/over-limit selections", async () => {
      const f = await fixture(1001),
        foreign = await fixture(1);
      const selected = f.ids.slice(0, QR_ZIP_LIMIT);
      const [first, duplicate] = await Promise.all([
        requested(f.ctx, selected),
        requested(f.ctx, [...selected].reverse()),
      ]);
      expect(first.id).toBe(duplicate.id);
      expect(first.total).toBe(500);
      expect(first.maximumBytes).toBe(QR_ZIP_MAX_BYTES);
      const persisted = await qrZipItems(db)
        .find({ jobId: new ObjectId(first.id) })
        .toArray();
      expect(persisted).toHaveLength(500);
      expect(new Set(persisted.map((row) => row.qrId.toHexString()))).toEqual(
        new Set(selected),
      );
      const before = await qrZipJobs(db).countDocuments({
        workspaceId: f.ctx.workspace._id,
      });
      expect(
        (
          await requestQrZip(f.ctx, {
            ids: [...selected, f.ids[500]!],
            format: "svg",
          })
        ).ok,
      ).toBe(false);
      expect(
        (
          await requestQrZip(f.ctx, {
            ids: [f.ids[0]!, foreign.ids[0]!],
            format: "svg",
          })
        ).ok,
      ).toBe(false);
      expect(
        await qrZipJobs(db).countDocuments({
          workspaceId: f.ctx.workspace._id,
        }),
      ).toBe(before);
      expect(
        await qrZipDelivery(foreign.ctx, first.id, memory().store.sign),
      ).toBeNull();
      const m = memory();
      await runQrZipExport(deps(m.store), first.id);
      const complete = (await qrZipJobs(db).findOne({
        _id: new ObjectId(first.id),
      }))!;
      expect(complete.state).toBe("completed");
      expect(complete.done).toBe(500);
      expect(
        Object.keys(unzipSync(m.objects.get(complete.objectKey!)!.bytes)),
      ).toHaveLength(500);
    }, 30_000);

    test("streams valid SVG, PNG and PDF ZIP entries with safe unique names and private delivery", async () => {
      const f = await fixture(),
        m = memory();
      for (const format of ["svg", "png", "pdf"] as const) {
        const job = await requested(f.ctx, f.ids, format);
        expect(await runQrZipExport(deps(m.store), job.id)).toBe(true);
        const completed = (await qrZipJobs(db).findOne({
          _id: new ObjectId(job.id),
        }))!;
        expect(completed.state).toBe("completed");
        expect(completed.done).toBe(3);
        const archive = m.objects.get(completed.objectKey!)!;
        expect(archive.contentType).toBe("application/zip");
        const files = unzipSync(archive.bytes);
        expect(Object.keys(files)).toHaveLength(3);
        for (const [name, bytes] of Object.entries(files)) {
          expect(name).toMatch(
            new RegExp(`^[0-9]{3}-[a-zA-Z0-9_.-]+\\.${format}$`),
          );
          if (format === "svg")
            expect(Buffer.from(bytes).toString()).toStartWith("<svg");
          if (format === "png")
            expect(Buffer.from(bytes.subarray(0, 8)).toString("hex")).toBe(
              "89504e470d0a1a0a",
            );
          if (format === "pdf")
            expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe("%PDF-");
        }
        const delivery = await qrZipDelivery(f.ctx, job.id, m.store.sign);
        expect(delivery).toHaveProperty("downloadUrl");
        expect(delivery).not.toHaveProperty("objectKey");
        expect(delivery).not.toHaveProperty("design");
      }
    }, 20_000);

    test("reclaims a dead lease and resumes checkpoints without rerendering completed items", async () => {
      const f = await fixture(),
        m = memory(),
        job = await requested(f.ctx, f.ids);
      let calls = 0;
      const failing = {
        ...m.store,
        put: async (key: string, bytes: Uint8Array, type: string) => {
          if (++calls === 2) throw new Error("synthetic crash");
          await m.store.put(key, bytes, type);
        },
      };
      await runQrZipExport(deps(failing), job.id);
      const partial = (await qrZipJobs(db).findOne({
        _id: new ObjectId(job.id),
      }))!;
      expect(partial.state).toBe("pending");
      expect(partial.done).toBe(1);
      const checkpoint = (await qrZipItems(db).findOne({
        jobId: partial._id,
        position: 0,
      }))!;
      await collection(db, "qr_codes").updateOne(
        { _id: checkpoint.qrId },
        { $set: { "options.dotsOptions.color": "#ddd" } },
      );
      await qrZipJobs(db).updateOne(
        { _id: partial._id },
        {
          $set: {
            state: "running",
            leaseToken: "dead-process",
            leaseUntil: new Date(0),
            nextAttemptAt: new Date(0),
          },
        },
      );
      await runQrZipExport(deps(m.store), job.id);
      expect((await qrZipJobs(db).findOne({ _id: partial._id }))?.state).toBe(
        "completed",
      );
      expect(m.writes.get(checkpoint.objectKey!)).toBe(1);
    });

    test("refuses invalid print designs, removed access, expired jobs and oversized archives without a public result", async () => {
      const f = await fixture(),
        m = memory();
      await collection(db, "qr_codes").updateOne(
        { _id: new ObjectId(f.ids[0]!) },
        { $set: { "options.dotsOptions.color": "#ddd" } },
      );
      const bad = await requested(f.ctx, f.ids);
      await runQrZipExport(deps(m.store), bad.id);
      expect(
        (await qrZipJobs(db).findOne({ _id: new ObjectId(bad.id) }))?.error,
      ).toBe("low_contrast");
      expect(
        (await qrZipJobs(db).findOne({ _id: new ObjectId(bad.id) }))
          ?.failedQrId,
      ).toBe(f.ids[0]!);
      expect(
        [...m.objects.keys()].some((key) => key.startsWith("exports/jobs/")),
      ).toBe(false);
      const other = await fixture(),
        oversized = await requested(other.ctx, other.ids);
      await runQrZipExport(
        deps({
          ...m.store,
          putStream: async () => {
            throw new Error("archive_too_large");
          },
        }),
        oversized.id,
      );
      expect(
        (await qrZipJobs(db).findOne({ _id: new ObjectId(oversized.id) }))
          ?.error,
      ).toBe("archive_too_large");
      const removed = await requested(other.ctx, other.ids, "png");
      await collection(db, "workspace_members").deleteOne({
        workspaceId: other.ctx.workspace._id,
        userId: other.ctx.actor.userId,
      });
      await runQrZipExport(deps(m.store), removed.id);
      expect(
        (await qrZipJobs(db).findOne({ _id: new ObjectId(removed.id) }))?.error,
      ).toBe("access_removed");
      expect(
        await qrZipDelivery(other.ctx, removed.id, m.store.sign),
      ).toBeNull();
      await qrZipJobs(db).updateOne(
        { _id: new ObjectId(bad.id) },
        { $set: { expiresAt: new Date(0) } },
      );
      expect(await runQrZipExport(deps(m.store), bad.id)).toBe(false);
      expect(await qrZipDelivery(f.ctx, bad.id, m.store.sign)).toBeNull();
    });

    test("the mounted durable worker discovers ZIP jobs and completes their archive", async () => {
      const f = await fixture(1),
        m = memory(),
        job = await requested(f.ctx, f.ids);
      const worker = createQrExportWorker({
        ...deps(m.store),
        durable,
        queueName: `qr-zip-${crypto.randomUUID()}`,
        log: () => {},
      });
      try {
        await worker.pump();
        const deadline = Date.now() + 15_000;
        while (
          Date.now() < deadline &&
          (await qrZipJobs(db).findOne({ _id: new ObjectId(job.id) }))
            ?.state !== "completed"
        )
          await Bun.sleep(50);
        expect(
          (await qrZipJobs(db).findOne({ _id: new ObjectId(job.id) }))?.state,
        ).toBe("completed");
      } finally {
        await worker.queue.obliterate({ force: true });
        await worker.close();
      }
    }, 20_000);
  },
);
