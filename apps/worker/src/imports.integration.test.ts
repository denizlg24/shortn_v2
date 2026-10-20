import { beforeAll, afterAll, describe, test, expect } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import Redis from "ioredis";
import { keys, cacheScripts } from "@shortn/redis";
import { collection, desiredIndexes, physicalNames } from "@shortn/db";
import {
  createImportJob,
  inspectImport,
  validateImport,
  commitImport,
  cancelImport,
  getImportJob,
  importErrorDelivery,
  importJobs,
  importRows,
  importResults,
  importReservations,
  importReceipts,
  ensurePersonalWorkspace,
  createLink,
  createMany,
  createManyQrImports,
  getQr,
  updateQr,
  deleteQrs,
  requestQrExport,
  qrExportJobs,
  countUsage,
  reserveImportQuota,
  importJobView,
  decodeCachedLink,
  listImportJobs,
  listImportResults,
  searchImportTags,
  prepareImportUpload,
  completeImportUpload,
  streamFilteredLinkExport,
  countFilteredLinkExport,
  listLinks,
  getLink,
  prepareLinkExport,
  linkExportJobs,
  linkExportDelivery,
  getLinkExport,
  cancelLinkExport,
  listLinkExports,
  type ServiceContext,
} from "@shortn/core";
import type { ObjectStore } from "@shortn/storage";
import { loadEntitlements } from "@shortn/billing";
import { runImport, createImportWorker } from "./imports";
import { runLinkExport, createLinkExportWorker } from "./link-exports";
const mongo = process.env.MONGO_TEST_URL,
  cache = process.env.REDIS_TEST_URL,
  durableUrl = process.env.REDIS_DURABLE_TEST_URL;
const linkDomain = `import-fixture-${crypto.randomUUID()}.invalid`;
const fixtureDomains = new Set([linkDomain]);
(mongo && cache && durableUrl ? describe : describe.skip)(
  "durable CSV import lifecycle",
  () => {
    let client: MongoClient, db: Db, redis: Redis, durable: Redis;
    const objects = new Map<string, Uint8Array>();
    const store: ObjectStore = {
      async head(key) {
        const bytes = objects.get(key);
        return bytes ? { bytes: bytes.length, contentType: "text/csv" } : null;
      },
      async get(key, max) {
        const bytes = objects.get(key);
        if (!bytes) throw new Error("missing");
        if (bytes.length > max) throw new Error("oversized");
        return bytes;
      },
      async put(key, bytes) {
        objects.set(key, bytes);
      },
      async putStream(key, chunks, _type, maximum) {
        const bytes: Uint8Array[] = [];
        let size = 0;
        for await (const chunk of chunks) {
          bytes.push(chunk);
          size += chunk.length;
          if (size > maximum) throw new Error("oversized");
        }
        objects.set(key, new Uint8Array(Buffer.concat(bytes)));
        return size;
      },
      async sign(key) {
        return `https://synthetic.invalid/${key}`;
      },
    };
    beforeAll(async () => {
      if (
        ![mongo, cache, durableUrl].every((url) =>
          ["127.0.0.1", "localhost"].includes(new URL(url!).hostname),
        )
      )
        throw new Error("Loopback only");
      client = await new MongoClient(mongo!).connect();
      db = client.db(
        `shortn_import_worker_${crypto.randomUUID().replaceAll("-", "")}`,
      );
      redis = new Redis(cache!);
      durable = new Redis(durableUrl!);
      for (const [name, indexes] of Object.entries(desiredIndexes))
        await db.collection(name).createIndexes(indexes);
    });
    afterAll(async () => {
      // Cache generations intentionally have no TTL; remove only this fixture's namespace.
      if (redis)
        for (const domain of fixtureDomains)
          for (const pattern of [
            `link:${domain}:*`,
            `cache-generation:link:${domain}:*`,
          ]) {
            let cursor = "0";
            do {
              const [next, keys] = await redis.scan(
                cursor,
                "MATCH",
                pattern,
                "COUNT",
                1000,
              );
              cursor = next;
              if (keys.length) await redis.unlink(...keys);
            } while (cursor !== "0");
          }
      await db?.dropDatabase();
      await client?.close();
      redis?.disconnect();
      durable?.disconnect();
    });
    async function context(pro = true): Promise<ServiceContext> {
      const userId = new ObjectId().toHexString(),
        workspace = await ensurePersonalWorkspace(db, {
          id: userId,
          sub: `import|${userId}`,
          name: "Synthetic",
        });
      if (pro)
        await db.collection(physicalNames.subscriptions).insertOne({
          workspaceId: workspace._id,
          polarSubscriptionId: crypto.randomUUID(),
          status: "active",
          plan: "pro",
          currentPeriodStart: new Date(Date.now() - 86400000),
          currentPeriodEnd: new Date(Date.now() + 29 * 86400000),
          cancelAtPeriodEnd: false,
        });
      return {
        db,
        cache: redis,
        workspace,
        actor: { userId, role: "owner" },
        linkDomain,
      };
    }
    const deps = () => ({ db, cache: redis, store, linkDomain });
    async function uploaded(
      ctx: ServiceContext,
      csv: string,
      kind: "links" | "qr" = "links",
    ) {
      const bytes = new TextEncoder().encode(csv),
        result = await createImportJob(ctx, bytes.length, kind);
      if (!result.ok) throw new Error(result.error);
      await store.put(result.value.inputKey, bytes, "text/csv");
      expect(
        (await inspectImport(ctx, result.value._id.toHexString())).ok,
      ).toBe(true);
      await runImport(deps(), result.value._id.toHexString());
      const job = (await getImportJob(ctx, result.value._id.toHexString()))!;
      expect(job.state).toBe("mapping");
      return job;
    }
    async function ready(
      ctx: ServiceContext,
      csv: string,
      kind: "links" | "qr" = "links",
    ) {
      const job = await uploaded(ctx, csv, kind);
      expect(
        (await validateImport(ctx, job._id.toHexString(), job.mapping!)).ok,
      ).toBe(true);
      await runImport(deps(), job._id.toHexString());
      const result = (await getImportJob(ctx, job._id.toHexString()))!;
      expect(result.state).toBe("ready");
      return result;
    }
    test("export history is paginated, redacted, scoped and authorized by current membership", async () => {
      const ctx = await context(),
        other = await context(),
        now = new Date(),
        memberId = new ObjectId().toHexString();
      await db.collection(physicalNames.workspace_members).insertOne({
        _id: new ObjectId(),
        workspaceId: ctx.workspace._id,
        userId: memberId,
        role: "member",
        createdAt: now,
      });
      const member = {
        ...ctx,
        actor: { userId: memberId, role: "member" as const },
      };
      const rows = Array.from({ length: 30 }, (_, index) => ({
        _id: new ObjectId(),
        requestKey: crypto.randomUUID(),
        signature: "private-signature",
        workspaceId: ctx.workspace._id,
        createdBy: index === 0 ? memberId : ctx.actor.userId,
        kind: "links" as const,
        format: index % 2 ? ("csv" as const) : ("json" as const),
        filter: { search: "private-query" },
        total: 1,
        done: 1,
        state: "completed" as const,
        attempts: 1,
        createdAt: now,
        expiresAt: new Date(now.getTime() + 86400000),
        nextAttemptAt: now,
        objectKey: "private-key",
        leaseToken: "private-lease",
      }));
      await linkExportJobs(db).insertMany(rows);
      expect(await listLinkExports(ctx)).toMatchObject({
        total: 30,
        page: 1,
        pages: 2,
      });
      expect((await listLinkExports(ctx))?.items).toHaveLength(25);
      expect((await listLinkExports(ctx, { page: 999 }))?.items).toHaveLength(
        5,
      );
      expect(await listLinkExports(member)).toMatchObject({ total: 1 });
      expect(await listLinkExports(other)).toMatchObject({ total: 0 });
      expect(
        await listLinkExports(ctx, { format: "csv", state: "completed" }),
      ).toMatchObject({ total: 15 });
      for (const hidden of [
        "filter",
        "objectKey",
        "leaseToken",
        "signature",
        "requestKey",
        "createdBy",
        "private-query",
      ])
        expect(JSON.stringify(await listLinkExports(ctx))).not.toContain(
          hidden,
        );
      await db
        .collection(physicalNames.workspace_members)
        .updateOne(
          { workspaceId: ctx.workspace._id, userId: memberId },
          { $set: { role: "admin" } },
        );
      expect(await listLinkExports(member)).toMatchObject({ total: 30 });
      await db
        .collection(physicalNames.workspace_members)
        .updateOne(
          { workspaceId: ctx.workspace._id, userId: memberId },
          { $set: { role: "viewer" } },
        );
      expect(
        await listLinkExports({
          ...member,
          actor: { ...member.actor, role: "admin" },
        }),
      ).toMatchObject({ total: 1 });
      await linkExportJobs(db).updateOne(
        { _id: rows[0]!._id },
        { $set: { expiresAt: new Date(0) } },
      );
      expect(await listLinkExports(member)).toMatchObject({ total: 0 });
      await db
        .collection(physicalNames.workspace_members)
        .deleteOne({ workspaceId: ctx.workspace._id, userId: memberId });
      await expect(listLinkExports(member)).rejects.toThrow("forbidden");
    });
    test("filtered CSV export round-trips through the actual worker into a different workspace", async () => {
      const source = await context(),
        target = await context();
      const input = {
        url: "https://example.com/news?utm_source=one&utm_source=two&encoded=%2F#part",
        key: `roundtrip-${crypto.randomUUID().slice(0, 8)}`,
        title: '\'=São João, "edição"\nsemanal',
        tags: [
          "News, North",
          "Weekly;Edition",
          "São João",
          "'=literal",
          "@SUM(1)",
        ],
        rules: { expiresAt: "2027-01-01T12:00:00.000Z" },
      };
      const created = await createLink(source, input);
      if (!created.ok) throw new Error(created.error);
      expect(
        (
          await createLink(source, {
            url: "https://example.com/unselected",
            tags: ["Other"],
          })
        ).ok,
      ).toBe(true);
      expect(
        (
          await createLink(target, {
            url: "https://example.com/foreign",
            tags: ["News, North"],
          })
        ).ok,
      ).toBe(true);
      const filter = { tags: ["News, North"], search: "São João" };
      expect(await countFilteredLinkExport(source, filter)).toBe(
        (await listLinks(source, filter)).total!,
      );
      let csv = "";
      for await (const chunk of streamFilteredLinkExport(source, filter, "csv"))
        csv += new TextDecoder().decode(chunk);
      expect(csv).not.toContain("unselected");
      expect(csv).not.toContain("foreign");
      expect(csv).not.toContain("password");
      // Free the global domain/key identity before importing it into the other tenant.
      await db.collection(physicalNames.links).deleteOne({
        _id: new ObjectId(created.value.id),
        workspaceId: source.workspace._id,
      });
      const job = await ready(target, csv);
      expect(job).toMatchObject({ valid: 1, invalid: 0 });
      expect((await commitImport(target, job._id.toHexString())).ok).toBe(true);
      await runImport(deps(), job._id.toHexString());
      const receipt = await importReceipts(db).findOne({
        reservationId: job._id,
      });
      expect(receipt).not.toBeNull();
      const imported = await db
        .collection(physicalNames.links)
        .findOne({ importId: job._id, workspaceId: target.workspace._id });
      expect(imported).not.toBeNull();
      const view = await getLink(target, imported!._id.toHexString());
      expect(view).toMatchObject({
        url: input.url,
        key: input.key,
        title: input.title,
        rules: input.rules,
      });
      expect(view!.tags.map((tag) => tag.name).sort()).toEqual(
        [...input.tags].sort(),
      );
      expect((await getImportJob(target, job._id.toHexString()))?.state).toBe(
        "completed",
      );
    });
    test("export cursors keep a stable snapshot across batches, validate scope and stop on abort or access loss", async () => {
      const ctx = await context(),
        created = await createLink(ctx, {
          url: "https://example.com/snapshot",
          title: "Snapshot",
        });
      if (!created.ok) throw new Error(created.error);
      const base = (await db
        .collection(physicalNames.links)
        .findOne({ _id: new ObjectId(created.value.id) }))!;
      const marker = crypto.randomUUID().slice(0, 8);
      await db.collection(physicalNames.links).insertMany(
        Array.from({ length: 700 }, (_, index) => ({
          ...base,
          _id: new ObjectId(),
          urlCode: `snap-${marker}-${index}`,
          key: `snap-${marker}-${index}`,
        })),
      );
      const stream = streamFilteredLinkExport(
        ctx,
        { search: "Snapshot" },
        "json",
      );
      expect(new TextDecoder().decode((await stream.next()).value!)).toBe(
        "[\n",
      );
      const first = await stream.next();
      await db
        .collection(physicalNames.links)
        .updateOne(
          { _id: base._id },
          { $set: { title: "Changed after the snapshot" } },
        );
      await db.collection(physicalNames.links).insertOne({
        ...base,
        _id: new ObjectId(),
        urlCode: `new-${marker}`,
        key: `new-${marker}`,
      });
      let output = "[\n" + new TextDecoder().decode(first.value!);
      for await (const chunk of stream)
        output += new TextDecoder().decode(chunk);
      const rows = JSON.parse(output);
      expect(rows).toHaveLength(701);
      expect(
        rows.some((row: { title: string }) => row.title !== "Snapshot"),
      ).toBe(false);
      expect(
        rows.some((row: { key: string }) => row.key === `new-${marker}`),
      ).toBe(false);
      for (const invalid of [
        { workspaceId: ctx.workspace._id },
        { search: { $ne: "" } },
        { tags: ["x".repeat(65)] },
        { campaign: "bad" },
        { createdBefore: new Date(NaN) },
      ])
        await expect(countFilteredLinkExport(ctx, invalid)).rejects.toThrow(
          "invalid_export",
        );
      const abort = new AbortController(),
        cancelled = streamFilteredLinkExport(ctx, {}, "csv", abort.signal);
      await cancelled.next();
      await cancelled.next();
      abort.abort();
      await expect(cancelled.next()).rejects.toThrow("export_cancelled");
      const revoked = streamFilteredLinkExport(ctx, {}, "json");
      await revoked.next();
      await revoked.next();
      await db.collection(physicalNames.workspace_members).deleteOne({
        workspaceId: ctx.workspace._id,
        userId: ctx.actor.userId,
      });
      let seen = 1,
        stopped = false;
      try {
        for await (const chunk of revoked) seen += Number(chunk.byteLength > 0);
      } catch (error) {
        stopped = error instanceof Error && error.message === "forbidden";
      }
      expect(stopped).toBe(true);
      expect(seen).toBeLessThanOrEqual(500);
      await expect(countFilteredLinkExport(ctx)).rejects.toThrow("forbidden");
      await expect(
        streamFilteredLinkExport(ctx, {}, "csv").next(),
      ).rejects.toThrow("forbidden");
    });
    test("4,999 rows stream a frozen server selection; 5,000 rows use a retry-safe private export job", async () => {
      const ctx = await context(),
        created = await createLink(ctx, {
          url: "https://example.com/export",
          title: "Export boundary",
        });
      if (!created.ok) throw new Error(created.error);
      const base = (await db
          .collection(physicalNames.links)
          .findOne({ _id: new ObjectId(created.value.id) }))!,
        marker = crypto.randomUUID().slice(0, 8);
      await db.collection(physicalNames.links).insertMany(
        Array.from({ length: 4998 }, (_, index) => ({
          ...base,
          _id: new ObjectId(),
          urlCode: `export-${marker}-${index}`,
          key: `export-${marker}-${index}`,
        })),
      );
      const small = await prepareLinkExport(ctx, {}, "json");
      if (!small.ok || small.value.mode !== "stream")
        throw new Error("expected stream");
      expect(small.value.total).toBe(4999);
      expect(small.value.selection).toHaveLength(4999);
      await db.collection(physicalNames.links).insertOne({
        ...base,
        _id: new ObjectId(),
        urlCode: `extra-${marker}`,
        key: `extra-${marker}`,
      });
      let streamed = "";
      for await (const chunk of streamFilteredLinkExport(
        ctx,
        small.value.filter,
        "json",
        undefined,
        small.value.selection,
      ))
        streamed += new TextDecoder().decode(chunk);
      expect(JSON.parse(streamed)).toHaveLength(4999);
      expect(streamed).not.toContain(`extra-${marker}`);
      const requestId = crypto.randomUUID(),
        large = await prepareLinkExport(ctx, {}, "json", requestId);
      if (!large.ok || large.value.mode !== "job")
        throw new Error("expected job");
      const id = large.value.job.id;
      expect(large.value.job.total).toBe(5000);
      expect(
        await prepareLinkExport(ctx, { search: undefined }, "json", requestId),
      ).toEqual(large);
      expect(await prepareLinkExport(ctx, {}, "csv", requestId)).toMatchObject({
        ok: false,
        error: "idempotency_conflict",
      });
      expect(
        await linkExportJobs(db).countDocuments({
          workspaceId: ctx.workspace._id,
        }),
      ).toBe(1);
      expect(await runLinkExport(deps(), id)).toBe(true);
      const done = await getLinkExport(ctx, id);
      expect(done).toMatchObject({
        state: "completed",
        done: 5000,
        total: 5000,
      });
      expect(
        JSON.parse(new TextDecoder().decode(objects.get(done!.objectKey!)!)),
      ).toHaveLength(5000);
      const signed: unknown[][] = [],
        delivery = await linkExportDelivery(ctx, id, async (...args) => {
          signed.push(args);
          return "https://synthetic.invalid/links.json";
        });
      expect(delivery).toHaveProperty("downloadUrl");
      expect(signed[0]?.[1] as number).toBeLessThanOrEqual(86400);
      expect(signed[0]?.[2]).toBe("links.json");
      for (const hidden of [
        "filter",
        "selection",
        "objectKey",
        "leaseToken",
        "createdBy",
        "requestKey",
      ])
        expect(JSON.stringify(delivery)).not.toContain(hidden);
      expect(await runLinkExport(deps(), id)).toBe(false);
      const foreign = await context();
      expect(await getLinkExport(foreign, id)).toBeNull();
      await linkExportJobs(db).updateOne(
        { _id: new ObjectId(id) },
        { $set: { objectKey: "uploads/public.json" } },
      );
      expect(
        await linkExportDelivery(ctx, id, async () => {
          throw new Error("must not sign");
        }),
      ).not.toHaveProperty("downloadUrl");
      await linkExportJobs(db).updateOne(
        { _id: new ObjectId(id) },
        { $set: { expiresAt: new Date(0) } },
      );
      expect(await getLinkExport(ctx, id)).toBeNull();
      const retry = await prepareLinkExport(ctx, {}, "csv");
      if (!retry.ok || retry.value.mode !== "job")
        throw new Error("expected job");
      const failing = {
        ...store,
        async putStream() {
          throw new Error("synthetic transport failure");
        },
      };
      await runLinkExport({ ...deps(), store: failing }, retry.value.job.id);
      expect(await getLinkExport(ctx, retry.value.job.id)).toMatchObject({
        state: "pending",
        error: "storage_unavailable",
        attempts: 1,
      });
      await linkExportJobs(db).updateOne(
        { _id: new ObjectId(retry.value.job.id) },
        { $set: { nextAttemptAt: new Date(0) } },
      );
      await runLinkExport(deps(), retry.value.job.id);
      expect(await getLinkExport(ctx, retry.value.job.id)).toMatchObject({
        state: "completed",
        done: 5000,
        attempts: 2,
      });
      const cancelled = await prepareLinkExport(ctx, {}, "csv");
      if (!cancelled.ok || cancelled.value.mode !== "job")
        throw new Error("expected job");
      expect(await cancelLinkExport(ctx, cancelled.value.job.id)).toBe(true);
      expect(await runLinkExport(deps(), cancelled.value.job.id)).toBe(false);
      const bull = await prepareLinkExport(ctx, {}, "json");
      if (!bull.ok || bull.value.mode !== "job")
        throw new Error("expected job");
      const factory = createLinkExportWorker({
        ...deps(),
        durable,
        queueName: `export-test-${crypto.randomUUID()}`,
        log() {},
      });
      try {
        await factory.pump();
        for (let i = 0; i < 100; i++) {
          if (
            (await getLinkExport(ctx, bull.value.job.id))?.state === "completed"
          )
            break;
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
        expect(await getLinkExport(ctx, bull.value.job.id)).toMatchObject({
          state: "completed",
          done: 5000,
        });
      } finally {
        await factory.worker.close();
        await factory.queue.obliterate({ force: true });
        await factory.close();
      }
      const stale = await prepareLinkExport(ctx, {}, "json");
      if (!stale.ok || stale.value.mode !== "job")
        throw new Error("expected job");
      const staleId = stale.value.job.id;
      const stealing = {
        ...store,
        async putStream(
          key: string,
          chunks: AsyncIterable<Uint8Array>,
          type: string,
          maximum: number,
        ) {
          const changed = async function* () {
            let first = true;
            for await (const chunk of chunks) {
              if (first) {
                first = false;
                await linkExportJobs(db).updateOne(
                  { _id: new ObjectId(staleId) },
                  {
                    $set: {
                      leaseToken: "replacement",
                      leaseUntil: new Date(0),
                    },
                  },
                );
              }
              yield chunk;
            }
          };
          return store.putStream!(key, changed(), type, maximum);
        },
      };
      await runLinkExport({ ...deps(), store: stealing }, staleId);
      expect(
        await linkExportJobs(db).findOne({ _id: new ObjectId(staleId) }),
      ).toMatchObject({ state: "running", leaseToken: "replacement" });
      expect(
        await linkExportDelivery(ctx, staleId, async () => {
          throw new Error("must not sign stale output");
        }),
      ).not.toHaveProperty("downloadUrl");
      await runLinkExport(deps(), staleId);
      expect(await getLinkExport(ctx, staleId)).toMatchObject({
        state: "completed",
        done: 5000,
        attempts: 2,
      });
      const denied = await prepareLinkExport(ctx, {}, "json");
      if (!denied.ok || denied.value.mode !== "job")
        throw new Error("expected job");
      const membership = (await db
        .collection(physicalNames.workspace_members)
        .findOne({
          workspaceId: ctx.workspace._id,
          userId: ctx.actor.userId,
        }))!;
      await db
        .collection(physicalNames.workspace_members)
        .deleteOne({ _id: membership._id });
      await runLinkExport(deps(), denied.value.job.id);
      expect(
        await linkExportJobs(db).findOne({
          _id: new ObjectId(denied.value.job.id),
        }),
      ).toMatchObject({ state: "failed", error: "forbidden" });
      expect(await getLinkExport(ctx, denied.value.job.id)).toBeNull();
      await db
        .collection(physicalNames.workspace_members)
        .insertOne(membership);
      const planJob = await prepareLinkExport(ctx, {}, "json");
      if (!planJob.ok || planJob.value.mode !== "job")
        throw new Error("expected job");
      const planStream = streamFilteredLinkExport(ctx, {}, "json");
      await planStream.next();
      await planStream.next();
      await db
        .collection(physicalNames.subscriptions)
        .updateMany(
          { workspaceId: ctx.workspace._id },
          { $set: { status: "canceled" } },
        );
      let planStopped = false,
        planRows = 1;
      try {
        for await (const chunk of planStream)
          planRows += Number(chunk.byteLength > 0);
      } catch (error) {
        planStopped =
          error instanceof Error && error.message === "feature_required";
      }
      expect(planStopped).toBe(true);
      expect(planRows).toBeLessThanOrEqual(500);
      await runLinkExport(deps(), planJob.value.job.id);
      expect(
        await linkExportJobs(db).findOne({
          _id: new ObjectId(planJob.value.job.id),
        }),
      ).toMatchObject({ state: "failed", error: "feature_required" });
      await expect(
        linkExportDelivery(ctx, planJob.value.job.id, async () => {
          throw new Error("must not sign after plan loss");
        }),
      ).rejects.toThrow("feature_required");
      const free = await context(false);
      await expect(prepareLinkExport(free, {}, "csv")).rejects.toThrow(
        "feature_required",
      );
      await expect(
        streamFilteredLinkExport(free, {}, "json").next(),
      ).rejects.toThrow("feature_required");
    }, 60_000);
    test("dashboard history enforces actor and workspace visibility, expiry and bounded pages", async () => {
      const ctx = await context(),
        other = await context(),
        memberId = new ObjectId().toHexString();
      const member = {
        ...ctx,
        actor: { userId: memberId, role: "member" as const },
      };
      const own = await createImportJob(member, 10, "qr");
      if (!own.ok) throw new Error(own.error);
      for (let i = 0; i < 27; i++)
        expect((await createImportJob(ctx, 10)).ok).toBe(true);
      const foreign = await createImportJob(other, 10);
      if (!foreign.ok) throw new Error(foreign.error);
      const expired = await createImportJob(ctx, 10);
      if (!expired.ok) throw new Error(expired.error);
      await importJobs(db).updateOne(
        { _id: expired.value._id },
        { $set: { expiresAt: new Date(0) } },
      );
      const first = await listImportJobs(ctx),
        last = await listImportJobs(ctx, { page: 999 });
      expect(first).toMatchObject({ total: 28, page: 1, pageSize: 25 });
      expect(first.items).toHaveLength(25);
      expect(last).toMatchObject({ total: 28, page: 2 });
      expect(last.items).toHaveLength(3);
      expect(
        new Set([...first.items, ...last.items].map((item) => item.id)).size,
      ).toBe(28);
      expect(await listImportJobs(member)).toMatchObject({
        total: 1,
        items: [{ id: own.value._id.toHexString() }],
      });
      expect(
        await listImportJobs({
          ...member,
          actor: { ...member.actor, role: "viewer" },
        }),
      ).toMatchObject({ total: 1 });
      expect(
        await listImportJobs({
          ...member,
          actor: { ...member.actor, role: "admin" },
        }),
      ).toMatchObject({ total: 28 });
      expect(
        await listImportJobs(ctx, { kind: "qr", state: "uploading" }),
      ).toMatchObject({ total: 1 });
      const payload = JSON.stringify(first);
      for (const hidden of [
        "inputKey",
        "sourceHash",
        "leaseToken",
        "preview",
        "columns",
        "mapping",
        foreign.value._id.toHexString(),
      ])
        expect(payload).not.toContain(hidden);
      expect((await listImportJobs(ctx, { page: Number.MAX_VALUE })).page).toBe(
        1,
      );
    });
    test("dashboard results filter the current generation by literal search, tags and error with safe projections", async () => {
      const ctx = await context(),
        other = await context();
      const job = await ready(
        ctx,
        "url,key,title,tags\nhttps://example.com/a,first,Special [a],Team;Shared\njavascript:alert(1),bad,Bad,Team\nhttps://example.com/c,last,Other,Shared",
      );
      const id = job._id.toHexString(),
        result = await listImportResults(ctx, id);
      expect(result).toMatchObject({ total: 3, generation: 1, pageSize: 25 });
      expect(
        (await listImportResults(ctx, id, { status: "valid" }))?.total,
      ).toBe(2);
      const invalid = await listImportResults(ctx, id, { status: "invalid" });
      expect(invalid?.total).toBe(1);
      expect(
        (await listImportResults(ctx, id, { error: invalid!.items[0]!.error }))
          ?.total,
      ).toBe(1);
      expect(
        (await listImportResults(ctx, id, { search: "[a]" }))?.items.map(
          (item) => item.key,
        ),
      ).toEqual(["first"]);
      expect((await listImportResults(ctx, id, { search: ".*" }))?.total).toBe(
        0,
      );
      expect((await listImportResults(ctx, id, { tag: "Team" }))?.total).toBe(
        1,
      );
      expect(
        (await listImportResults(ctx, id, { tag: "Shared", search: "Other" }))
          ?.total,
      ).toBe(1);
      expect(await searchImportTags(ctx, id, "tea")).toEqual({
        items: [{ tag: "Team", count: 1 }],
        hasMore: false,
      });
      expect(await searchImportTags(ctx, id, ".*")).toEqual({
        items: [],
        hasMore: false,
      });
      for (const hidden of [
        "jobId",
        "workspaceId",
        "identity",
        "expiresAt",
        "cells",
        "ordinal",
        "inputKey",
      ])
        expect(JSON.stringify(result)).not.toContain(hidden);
      expect(await listImportResults(other, id)).toBeNull();
      expect(await searchImportTags(other, id)).toBeNull();
      const member = {
        ...ctx,
        actor: { userId: "another", role: "member" as const },
      };
      expect(await listImportResults(member, id)).toBeNull();
      expect(await searchImportTags(member, id)).toBeNull();
      expect(await listImportResults(ctx, "invalid")).toBeNull();
      await importResults(db).insertOne({
        _id: new ObjectId(),
        jobId: job._id,
        generation: 0,
        position: 99,
        row: 99,
        expiresAt: job.expiresAt,
        input: { url: "https://example.com/stale", tags: ["Old"] },
      });
      expect((await listImportResults(ctx, id))?.total).toBe(3);
      expect((await searchImportTags(ctx, id, "Old"))?.items).toEqual([]);
      await importJobs(db).updateOne(
        { _id: job._id },
        { $set: { expiresAt: new Date(0) } },
      );
      expect(await listImportResults(ctx, id)).toBeNull();
      expect(await searchImportTags(ctx, id)).toBeNull();
    });
    test("50,000 dashboard rows stay paginated and searchable tag suggestions stay capped", async () => {
      const ctx = await context(),
        created = await createImportJob(ctx, 10);
      if (!created.ok) throw new Error(created.error);
      const job = created.value,
        id = job._id.toHexString();
      await importJobs(db).updateOne(
        { _id: job._id },
        {
          $set: { generation: 1, state: "ready", total: 50_000, valid: 50_000 },
        },
      );
      for (let start = 0; start < 50_000; start += 500)
        await importResults(db).insertMany(
          Array.from({ length: 500 }, (_, index) => {
            const position = start + index;
            return {
              _id: new ObjectId(),
              jobId: job._id,
              generation: 1,
              position,
              row: position + 2,
              expiresAt: job.expiresAt,
              input: {
                url: `https://example.com/${position}`,
                title: position === 49_975 ? "x".repeat(8000) : "Synthetic row",
                tags: [`Tag-${String(position % 75).padStart(2, "0")}`],
              },
            };
          }),
        );
      const page = await listImportResults(ctx, id, { page: 2000 });
      expect(page).toMatchObject({ total: 50_000, page: 2000, pageSize: 25 });
      expect(page?.items).toHaveLength(25);
      expect(page?.items[0]?.position).toBe(49_975);
      expect(page?.items.at(-1)?.position).toBe(49_999);
      expect(page?.items[0]?.title.length).toBe(200);
      expect(JSON.stringify(page).length).toBeLessThan(15_000);
      expect(await searchImportTags(ctx, id)).toMatchObject({ hasMore: true });
      expect((await searchImportTags(ctx, id))?.items).toHaveLength(50);
      expect(await searchImportTags(ctx, id, "Tag-74")).toEqual({
        items: [{ tag: "Tag-74", count: 666 }],
        hasMore: false,
      });
      const filtered = await listImportResults(ctx, id, {
        tag: "Tag-74",
        page: 999,
      });
      expect(filtered).toMatchObject({ total: 666, page: 27 });
      expect(filtered?.items).toHaveLength(16);
      await importResults(db).deleteMany({ jobId: job._id });
    }, 60_000);
    test("signed upload accepts metadata only, rolls back signer failure and retries completion without duplicate jobs", async () => {
      const ctx = await context(),
        signed: unknown[][] = [];
      const sign = async (...args: [string, number, number]) => {
        signed.push(args);
        return "https://synthetic.invalid/private-put";
      };
      const result = await prepareImportUpload(ctx, sign, 123, "qr");
      if (!result.ok) throw new Error(result.error);
      expect(result.value.headers).toEqual({
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "private, no-store",
        "If-None-Match": "*",
      });
      expect(signed).toEqual([
        [`imports/${ctx.workspace._id}/${result.value.id}.csv`, 123, 900],
      ]);
      expect(
        new Date(result.value.uploadExpiresAt).getTime() - Date.now(),
      ).toBeGreaterThan(890_000);
      expect((await completeImportUpload(ctx, result.value.id)).ok).toBe(true);
      expect((await completeImportUpload(ctx, result.value.id)).ok).toBe(true);
      expect(
        await importJobs(db).countDocuments({ workspaceId: ctx.workspace._id }),
      ).toBe(1);
      expect((await getImportJob(ctx, result.value.id))?.state).toBe(
        "inspect_pending",
      );
      const other = await context();
      expect((await completeImportUpload(other, result.value.id)).ok).toBe(
        false,
      );
      const viewer = {
        ...ctx,
        actor: { ...ctx.actor, role: "viewer" as const },
      };
      expect((await completeImportUpload(viewer, result.value.id)).ok).toBe(
        false,
      );
      expect((await prepareImportUpload(viewer, sign, 123, "links")).ok).toBe(
        false,
      );
      expect(signed).toHaveLength(1);
      expect(
        await prepareImportUpload(ctx, sign, 10 * 1024 * 1024 + 1, "links"),
      ).toMatchObject({ ok: false, error: "file_too_large" });
      expect(
        await prepareImportUpload(
          ctx,
          async () => {
            throw new Error("synthetic signer failure");
          },
          1,
          "links",
        ),
      ).toMatchObject({ ok: false, error: "storage_unavailable" });
      expect(
        await importJobs(db).countDocuments({ workspaceId: ctx.workspace._id }),
      ).toBe(1);
      const own = await prepareImportUpload(ctx, sign, 10, "links");
      if (!own.ok) throw new Error(own.error);
      await Promise.all([
        completeImportUpload(ctx, own.value.id),
        completeImportUpload(ctx, own.value.id),
      ]);
      expect((await getImportJob(ctx, own.value.id))?.state).toBe(
        "inspect_pending",
      );
    });
    test("full dry run validates shared rules, reports per-row errors and streams a private error CSV without creation", async () => {
      const ctx = await context();
      expect(
        (
          await createLink(ctx, {
            url: "https://example.com/taken",
            key: "taken",
          })
        ).ok,
      ).toBe(true);
      const job = await ready(
        ctx,
        "url,key,title,tags,utm_source,expires_at\nhttps://example.com/a,news,Newsletter,Team,email,2027-01-01T12:00:00Z\nhttps://example.org/a,news,Duplicate,,,\njavascript:alert(1),badurl,Bad,,,\nhttps://example.com,taken,Taken,,,\nhttps://example.com,login,Reserved,,,\nhttps://example.com,badexpiry,Date,,,tomorrow\n,missing,Missing,,,",
      );
      expect(job).toMatchObject({
        total: 7,
        valid: 1,
        invalid: 6,
        validated: 7,
      });
      expect(job.counts).toMatchObject({
        key_taken: 2,
        key_reserved: 1,
        invalid_date: 1,
        missing_url: 1,
      });
      expect(
        await db
          .collection(physicalNames.links)
          .countDocuments({ workspaceId: ctx.workspace._id }),
      ).toBe(1);
      expect(
        await importReservations(db).countDocuments({ _id: job._id }),
      ).toBe(0);
      const report = new TextDecoder().decode(objects.get(job.errorKey!)!);
      expect(report).toContain("row,error,url\r\n");
      expect(report).toContain('"key_taken"');
      const delivery = await importErrorDelivery(
        ctx,
        job._id.toHexString(),
        store.sign,
      );
      expect(delivery && "errorCsvUrl" in delivery).toBe(true);
      expect(JSON.stringify(importJobView(job))).not.toContain(job.inputKey);
      expect(JSON.stringify(importJobView(job))).not.toContain("leaseToken");
      expect(
        await getImportJob(await context(), job._id.toHexString()),
      ).toBeNull();
      await db.collection(physicalNames.webhook_endpoints).insertOne({
        workspaceId: ctx.workspace._id,
        enabled: true,
        events: ["import.completed", "link.created"],
      });
      expect((await commitImport(ctx, job._id.toHexString())).ok).toBe(true);
      await runImport(deps(), job._id.toHexString());
      expect((await getImportJob(ctx, job._id.toHexString()))?.state).toBe(
        "completed",
      );
      const created = await db
        .collection(physicalNames.links)
        .findOne({ importId: job._id });
      expect(created?.longUrl).toBe("https://example.com/a?utm_source=email");
      expect(created?.rules.expiresAt).toEqual(
        new Date("2027-01-01T12:00:00Z"),
      );
      expect(
        await db.collection(physicalNames.webhook_events).countDocuments({
          workspaceId: ctx.workspace._id,
          "event.type": "import.completed",
        }),
      ).toBe(1);
      expect(await runImport(deps(), job._id.toHexString())).toBe(false);
    });
    test("QR imports create complete default-design pairs, preserve custom domains and replay stable QR ids", async () => {
      const ctx = await context(),
        domain = `qr-${crypto.randomUUID()}.invalid`,
        addon = `synthetic-${crypto.randomUUID()}`,
        key = `qr-${crypto.randomUUID().slice(0, 8)}`;
      fixtureDomains.add(domain);
      await db.collection(physicalNames.domain_addons).insertOne({
        workspaceId: ctx.workspace._id,
        polarSubscriptionId: addon,
        status: "active",
      });
      await db.collection(physicalNames.domains).insertOne({
        workspaceId: ctx.workspace._id,
        hostname: domain,
        kind: "short",
        status: "active",
        hostnameStatus: "active",
        sslStatus: "active",
        addonSubscriptionId: addon,
      });
      const job = await ready(
        ctx,
        `url,key,title,tags,utm_source,expires_at,domain\nhttps://example.com/a,${key},QR Newsletter,Editorial,email,2027-01-01T12:00:00Z,${domain}`,
        "qr",
      );
      expect(job.quota?.requested).toBe(1);
      expect((await commitImport(ctx, job._id.toHexString())).ok).toBe(true);
      await runImport(deps(), job._id.toHexString());
      expect(await getImportJob(ctx, job._id.toHexString())).toMatchObject({
        state: "completed",
        kind: "qr",
        done: 1,
      });
      const qr = (await db
          .collection(physicalNames.qr_codes)
          .findOne({ importId: job._id }))!,
        backing = (await db
          .collection(physicalNames.links)
          .findOne({ _id: qr.linkId }))!;
      expect(backing).toMatchObject({
        isQrCode: true,
        domain,
        urlCode: key,
        qrCodeId: qr.qrCodeId,
        longUrl: "https://example.com/a?utm_source=email",
        tags: [],
        tagIds: [],
        requiresInterstitial: false,
      });
      expect(backing.rules.expiresAt).toEqual(new Date("2027-01-01T12:00:00Z"));
      const view = (await getQr(ctx, qr._id.toHexString()))!;
      expect(view.shortUrl).toBe(`https://${domain}/${key}`);
      expect(view.design.data).toBe(view.shortUrl);
      expect(view.tags.map((tag) => tag.name)).toEqual(["Editorial"]);
      expect(
        decodeCachedLink((await redis.get(keys.link(domain, key)))!),
      ).toMatchObject({
        kind: "link",
        dest: backing.longUrl,
        qr: { id: view.id, publicId: view.publicId },
      });
      const secondDomain = `qr-${crypto.randomUUID()}.invalid`,
        secondAddon = crypto.randomUUID();
      fixtureDomains.add(secondDomain);
      await db.collection(physicalNames.domain_addons).insertOne({
        workspaceId: ctx.workspace._id,
        polarSubscriptionId: secondAddon,
        status: "active",
      });
      await db.collection(physicalNames.domains).insertOne({
        workspaceId: ctx.workspace._id,
        hostname: secondDomain,
        kind: "short",
        status: "active",
        hostnameStatus: "active",
        sslStatus: "active",
        addonSubscriptionId: secondAddon,
      });
      const secondJob = await ready(
        ctx,
        `url,key,domain\nhttps://example.org/second,${key},${secondDomain}`,
        "qr",
      );
      await commitImport(ctx, secondJob._id.toHexString());
      await runImport(deps(), secondJob._id.toHexString());
      const secondQr = (await db
        .collection(physicalNames.qr_codes)
        .findOne({ importId: secondJob._id }))!;
      expect(
        decodeCachedLink((await redis.get(keys.link(secondDomain, key)))!),
      ).toMatchObject({
        kind: "link",
        dest: "https://example.org/second",
        qr: { id: secondQr._id.toHexString(), publicId: secondQr.qrCodeId },
      });
      const snapshot = (await importResults(db).findOne({
        jobId: job._id,
        ordinal: 0,
      }))!.input!;
      const replay = await createManyQrImports(ctx, [snapshot], {
        id: job._id.toHexString(),
        offset: 0,
      });
      expect(replay).toMatchObject({
        ok: true,
        value: [
          {
            id: qr._id.toHexString(),
            backingId: backing._id.toHexString(),
            publicId: qr.qrCodeId,
          },
        ],
      });
      expect(
        await createMany(ctx, [snapshot], {
          id: job._id.toHexString(),
          offset: 0,
        }),
      ).toMatchObject({ error: "invalid_input" });
      const exported = await requestQrExport(ctx, view.id, { format: "svg" });
      expect(exported.ok).toBe(true);
      if (exported.ok)
        expect(
          (
            await qrExportJobs(db).findOne({
              _id: new ObjectId(exported.value.id),
            })
          )?.data,
        ).toBe(view.shortUrl);
      const updated = await updateQr(ctx, view.id, {
        design: {
          ...view.design,
          dotsOptions: { color: "#000000", type: "dots" },
        },
      });
      expect(updated.ok).toBe(true);
      if (updated.ok) expect(updated.value.design.data).toBe(view.shortUrl);
      const ordinary = await createLink(ctx, {
        url: "https://example.org",
        key,
      });
      expect(ordinary.ok).toBe(true);
      expect((await deleteQrs(ctx, [view.id])).ok).toBe(true);
      expect(
        await db.collection(physicalNames.links).findOne({ _id: backing._id }),
      ).toBeNull();
      if (ordinary.ok)
        expect(
          await db
            .collection(physicalNames.links)
            .findOne({ _id: new ObjectId(ordinary.value.id) }),
        ).not.toBeNull();
      expect(
        await db
          .collection(physicalNames.qr_codes)
          .findOne({ _id: secondQr._id }),
      ).not.toBeNull();
      expect(
        await db
          .collection(physicalNames.links)
          .findOne({ _id: secondQr.linkId }),
      ).not.toBeNull();
    });
    test("QR quota is reserved independently and refused before any backing/QR writes", async () => {
      const ctx = await context(false),
        refused = await ready(
          ctx,
          "url\n" + "https://example.com\n".repeat(6),
          "qr",
        );
      await commitImport(ctx, refused._id.toHexString());
      await runImport(deps(), refused._id.toHexString());
      expect(await getImportJob(ctx, refused._id.toHexString())).toMatchObject({
        state: "ready",
        error: "limit_reached",
        quota: { limit: 5, used: 0, reserved: 0, requested: 6, available: 5 },
      });
      expect(
        await db
          .collection(physicalNames.links)
          .countDocuments({ importId: refused._id }),
      ).toBe(0);
      expect(
        await db
          .collection(physicalNames.qr_codes)
          .countDocuments({ importId: refused._id }),
      ).toBe(0);
      expect(
        (
          await createMany(
            ctx,
            Array.from({ length: 5 }, (_, index) => ({
              url: `https://example.com/link-${index}`,
            })),
          )
        ).ok,
      ).toBe(true);
      const accepted = await ready(
        ctx,
        "url\n" + "https://example.com\n".repeat(5),
        "qr",
      );
      await commitImport(ctx, accepted._id.toHexString());
      await runImport(deps(), accepted._id.toHexString());
      expect(await getImportJob(ctx, accepted._id.toHexString())).toMatchObject(
        { state: "completed", done: 5 },
      );
      const usage = await countUsage(
        db,
        ctx.workspace,
        (await loadEntitlements(db, ctx.workspace._id)).period,
      );
      expect(usage).toMatchObject({ links: 5, qrCodes: 5 });
    });
    test("a QR insert failure rolls back backing rows, tags, capacity and checkpoint together", async () => {
      const ctx = await context(),
        job = await ready(
          ctx,
          "url,title,tags\nhttps://example.com/a,Good QR,Team\nhttps://example.com/b,Bad QR,Team",
          "qr",
        );
      await commitImport(ctx, job._id.toHexString());
      await db.command({
        collMod: physicalNames.qr_codes,
        validator: { title: { $ne: "Bad QR" } },
      });
      try {
        await runImport(deps(), job._id.toHexString());
      } finally {
        await db.command({ collMod: physicalNames.qr_codes, validator: {} });
      }
      expect(await importJobs(db).findOne({ _id: job._id })).toMatchObject({
        state: "commit_pending",
        done: 0,
      });
      for (const name of [
        physicalNames.links,
        physicalNames.qr_codes,
        physicalNames.tags,
        physicalNames.import_receipts,
      ])
        expect(
          await db
            .collection(name)
            .countDocuments({ workspaceId: ctx.workspace._id }),
        ).toBe(0);
      expect(
        await importReservations(db).findOne({ _id: job._id }),
      ).toMatchObject({ metric: "qrCodes", remaining: 2, consumed: 0 });
      await importJobs(db).updateOne(
        { _id: job._id },
        { $set: { nextAttemptAt: new Date(0) } },
      );
      await runImport(deps(), job._id.toHexString());
      expect(await getImportJob(ctx, job._id.toHexString())).toMatchObject({
        state: "completed",
        done: 2,
      });
      expect(
        await db
          .collection(physicalNames.links)
          .countDocuments({ importId: job._id }),
      ).toBe(2);
      expect(
        await db
          .collection(physicalNames.qr_codes)
          .countDocuments({ importId: job._id }),
      ).toBe(2);
    });
    test("all-invalid mapped rows complete a dry run, and remapping creates an isolated result generation", async () => {
      const ctx = await context(),
        job = await ready(ctx, "url,title\n,Missing\n,Another");
      expect(job).toMatchObject({ valid: 0, invalid: 2 });
      expect(await commitImport(ctx, job._id.toHexString())).toMatchObject({
        error: "empty_import",
      });
      expect(
        (await validateImport(ctx, job._id.toHexString(), { url: 1 })).ok,
      ).toBe(true);
      await runImport(deps(), job._id.toHexString());
      expect((await getImportJob(ctx, job._id.toHexString()))?.generation).toBe(
        2,
      );
      expect(
        await importResults(db).countDocuments({
          jobId: job._id,
          generation: 1,
        }),
      ).toBe(2);
      expect(
        await importResults(db).countDocuments({
          jobId: job._id,
          generation: 2,
        }),
      ).toBe(2);
    });
    test("whole quota refusal precedes every imported write and exposes exact numbers", async () => {
      const ctx = await context(false),
        job = await ready(ctx, "url\n" + "https://example.com\n".repeat(6));
      expect((await commitImport(ctx, job._id.toHexString())).ok).toBe(true);
      await runImport(deps(), job._id.toHexString());
      expect(await getImportJob(ctx, job._id.toHexString())).toMatchObject({
        state: "ready",
        error: "limit_reached",
        quota: { limit: 5, used: 0, reserved: 0, requested: 6, available: 5 },
      });
      expect(
        await db
          .collection(physicalNames.links)
          .countDocuments({ importId: job._id }),
      ).toBe(0);
    });
    for (const kind of ["links", "qr"] as const)
      test(`a killed ${kind} process resumes after its committed 500-row checkpoint without duplicates`, async () => {
        const ctx = await context();
        if (kind === "qr")
          await db
            .collection(physicalNames.subscriptions)
            .updateOne(
              { workspaceId: ctx.workspace._id },
              { $set: { plan: "enterprise" } },
            );
        const job = await ready(
          ctx,
          "url\n" +
            Array.from(
              { length: 1001 },
              (_, index) => `https://example.com/restart-${index}`,
            ).join("\n"),
          kind,
        );
        expect(job.preview?.length).toBe(20);
        expect((await commitImport(ctx, job._id.toHexString())).ok).toBe(true);
        const script = `import {MongoClient} from 'mongodb'; import Redis from 'ioredis'; import {runImport} from './imports';
      const client=await new MongoClient(process.env.MONGO_TEST_URL).connect(), redis=new Redis(process.env.REDIS_TEST_URL);
      const cache=new Proxy(redis,{get(target,prop){if(prop==='publish')return async(...args)=>{await target.publish(...args);process.kill(process.pid,'SIGKILL');};const value=Reflect.get(target,prop);return typeof value==='function'?value.bind(target):value;}});
      await runImport({db:client.db(process.env.IMPORT_TEST_DB),cache,store:{},linkDomain:process.env.IMPORT_TEST_DOMAIN},process.env.IMPORT_TEST_JOB);`;
        const child = Bun.spawn([process.execPath, "-e", script], {
          cwd: new URL("./", import.meta.url).pathname,
          env: {
            ...process.env,
            IMPORT_TEST_DB: db.databaseName,
            IMPORT_TEST_JOB: job._id.toHexString(),
            IMPORT_TEST_DOMAIN: linkDomain,
          },
          stdout: "pipe",
          stderr: "pipe",
        });
        const timeout = setTimeout(() => child.kill("SIGKILL"), 15_000);
        try {
          const exit = await child.exited;
          if (exit === 0)
            throw new Error("Child did not reach kill checkpoint");
        } finally {
          clearTimeout(timeout);
        }
        const partial = await importJobs(db).findOne({ _id: job._id });
        if (partial?.done !== 500)
          throw new Error(
            `Child checkpoint missing: ${await new Response(child.stderr).text()}`,
          );
        expect(partial).toMatchObject({ state: "committing", done: 500 });
        expect(
          await db
            .collection(physicalNames.links)
            .countDocuments({ importId: job._id }),
        ).toBe(500);
        await importJobs(db).updateOne(
          { _id: job._id },
          { $set: { leaseUntil: new Date(0), nextAttemptAt: new Date(0) } },
        );
        await runImport(deps(), job._id.toHexString());
        expect(await getImportJob(ctx, job._id.toHexString())).toMatchObject({
          state: "completed",
          done: 1001,
          warmed: 1001,
        });
        expect(
          await db
            .collection(physicalNames.links)
            .countDocuments({ importId: job._id }),
        ).toBe(1001);
        expect(
          (
            await db
              .collection(physicalNames.links)
              .distinct("importRow", { importId: job._id })
          ).length,
        ).toBe(1001);
        expect(
          await importReceipts(db).countDocuments({ reservationId: job._id }),
        ).toBe(3);
        if (kind === "qr") {
          expect(
            await db
              .collection(physicalNames.qr_codes)
              .countDocuments({ importId: job._id }),
          ).toBe(1001);
          expect(
            (
              await db
                .collection(physicalNames.qr_codes)
                .distinct("linkId", { importId: job._id })
            ).length,
          ).toBe(1001);
          const usage = await countUsage(
            db,
            ctx.workspace,
            (await loadEntitlements(db, ctx.workspace._id)).period,
          );
          expect(usage).toMatchObject({ links: 0, qrCodes: 1001 });
        }
      }, 30_000);
    test("warming repairs a post-commit invalidation failure and replaces stale negative entries", async () => {
      const ctx = await context(),
        prefix = `warm-${crypto.randomUUID().slice(0, 8)}`,
        job = await ready(
          ctx,
          `url,key\nhttps://example.com/a,${prefix}-a\nhttps://example.com/b,${prefix}-b`,
        );
      for (const suffix of ["a", "b"])
        await redis.set(
          keys.link(linkDomain, `${prefix}-${suffix}`),
          JSON.stringify({ kind: "missing" }),
          "EX",
          60,
        );
      await commitImport(ctx, job._id.toHexString());
      let failed = false;
      const cache = new Proxy(redis, {
        get(target, prop) {
          if (prop === "eval")
            return async (...args: unknown[]) => {
              if (!failed && args[0] === cacheScripts.invalidate) {
                failed = true;
                throw new Error("synthetic-invalidation-failure");
              }
              return Reflect.apply(target.eval, target, args);
            };
          const value = Reflect.get(target, prop);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      await runImport({ ...deps(), cache }, job._id.toHexString());
      expect(failed).toBe(true);
      expect(await importJobs(db).findOne({ _id: job._id })).toMatchObject({
        state: "commit_pending",
        done: 2,
        warmed: 0,
      });
      await importJobs(db).updateOne(
        { _id: job._id },
        { $set: { nextAttemptAt: new Date(0) } },
      );
      await runImport(deps(), job._id.toHexString());
      expect(await getImportJob(ctx, job._id.toHexString())).toMatchObject({
        state: "completed",
        done: 2,
        warmed: 2,
      });
      for (const suffix of ["a", "b"])
        expect(
          decodeCachedLink(
            (await redis.get(keys.link(linkDomain, `${prefix}-${suffix}`)))!,
          ),
        ).toMatchObject({
          kind: "link",
          dest: `https://example.com/${suffix}`,
        });
      expect(
        await db
          .collection(physicalNames.links)
          .countDocuments({ importId: job._id }),
      ).toBe(2);
      expect(
        await importReceipts(db).countDocuments({ reservationId: job._id }),
      ).toBe(1);
    });
    test("completion outbox failure retries the event without recreating committed rows", async () => {
      const ctx = await context(),
        job = await ready(ctx, "url\nhttps://example.com");
      await db.collection(physicalNames.webhook_endpoints).insertOne({
        workspaceId: ctx.workspace._id,
        enabled: true,
        events: ["import.completed"],
      });
      await commitImport(ctx, job._id.toHexString());
      await db.command({
        collMod: physicalNames.webhook_events,
        validator: { "event.type": { $ne: "import.completed" } },
      });
      try {
        await runImport(deps(), job._id.toHexString());
      } finally {
        await db.command({
          collMod: physicalNames.webhook_events,
          validator: {},
        });
      }
      expect(await importJobs(db).findOne({ _id: job._id })).toMatchObject({
        state: "commit_pending",
        done: 1,
        error: "infrastructure_unavailable",
      });
      expect(
        await db
          .collection(physicalNames.links)
          .countDocuments({ importId: job._id }),
      ).toBe(1);
      expect(
        await db
          .collection(physicalNames.webhook_events)
          .countDocuments({ workspaceId: ctx.workspace._id }),
      ).toBe(0);
      await importJobs(db).updateOne(
        { _id: job._id },
        { $set: { nextAttemptAt: new Date(0) } },
      );
      await runImport(deps(), job._id.toHexString());
      expect(await getImportJob(ctx, job._id.toHexString())).toMatchObject({
        state: "completed",
        done: 1,
      });
      expect(
        await db.collection(physicalNames.webhook_events).countDocuments({
          workspaceId: ctx.workspace._id,
          "event.type": "import.completed",
        }),
      ).toBe(1);
      expect(
        await db
          .collection(physicalNames.links)
          .countDocuments({ importId: job._id }),
      ).toBe(1);
    });
    test("cancellation and an obsolete lease prevent writes and release remaining quota", async () => {
      const ctx = await context(false),
        job = await ready(ctx, "url\nhttps://example.com");
      const token = crypto.randomUUID();
      await reserveImportQuota(ctx, job._id.toHexString(), "links", 1);
      await importJobs(db).updateOne(
        { _id: job._id },
        {
          $set: {
            state: "committing",
            leaseToken: token,
            leaseUntil: new Date(Date.now() + 300_000),
          },
        },
      );
      expect(await cancelImport(ctx, job._id.toHexString())).toBe(true);
      expect(
        await createMany(ctx, [{ url: "https://example.com" }], {
          id: job._id.toHexString(),
          offset: 0,
          leaseToken: token,
        }),
      ).toMatchObject({ error: "invalid_input" });
      expect(
        await importReservations(db).findOne({ _id: job._id }),
      ).toMatchObject({ state: "released", remaining: 0 });
      expect(
        await db
          .collection(physicalNames.links)
          .countDocuments({ importId: job._id }),
      ).toBe(0);
    });
    (process.env.IMPORT_PERFORMANCE_TEST === "1" ? test : test.skip)(
      "50k links complete the local pipeline within five minutes",
      async () => {
        const ctx = await context();
        await db
          .collection(physicalNames.subscriptions)
          .updateOne(
            { workspaceId: ctx.workspace._id },
            { $set: { plan: "enterprise" } },
          );
        const start = performance.now(),
          job = await ready(
            ctx,
            "url\n" +
              Array.from(
                { length: 50_000 },
                (_, index) => `https://example.com/performance-${index}`,
              ).join("\n"),
          );
        expect(job).toMatchObject({ total: 50_000, valid: 50_000, invalid: 0 });
        await commitImport(ctx, job._id.toHexString());
        await runImport(deps(), job._id.toHexString());
        expect(await getImportJob(ctx, job._id.toHexString())).toMatchObject({
          state: "completed",
          done: 50_000,
        });
        expect(
          await db
            .collection(physicalNames.links)
            .countDocuments({ importId: job._id }),
        ).toBe(50_000);
        const elapsedMs = performance.now() - start;
        console.log(
          JSON.stringify({
            importLocalPerformance: { rows: 50_000, elapsedMs, staging: false },
          }),
        );
        expect(elapsedMs).toBeLessThan(300_000);
      },
      360_000,
    );
    test("a locked or suspended workspace fails a pending import permanently", async () => {
      const ctx = await context(),
        job = await uploaded(ctx, "url\nhttps://example.com");
      await collection(db, "workspaces").updateOne(
        { _id: ctx.workspace._id },
        {
          $set: {
            suspension: {
              level: "locked",
              category: "chargeback",
              internalNote: "integration",
              by: "staff",
              at: new Date(),
            },
          },
        },
      );
      try {
        await importJobs(db).updateOne(
          { _id: job._id },
          { $set: { state: "validate_pending", generation: 1 } },
        );
        await runImport(deps(), job._id.toHexString());
        expect(await importJobs(db).findOne({ _id: job._id })).toMatchObject({
          state: "failed",
          error: "workspace_suspended",
        });
      } finally {
        await collection(db, "workspaces").updateOne(
          { _id: ctx.workspace._id },
          { $unset: { suspension: "" } },
        );
      }
    });
    test("lost membership and changed source fail closed; factory pump uses real durable Redis", async () => {
      const ctx = await context(),
        job = await uploaded(ctx, "url\nhttps://example.com");
      await db
        .collection(physicalNames.workspace_members)
        .updateOne(
          { workspaceId: ctx.workspace._id, userId: ctx.actor.userId },
          { $set: { role: "viewer" } },
        );
      await importJobs(db).updateOne(
        { _id: job._id },
        { $set: { state: "validate_pending", generation: 1 } },
      );
      await runImport(deps(), job._id.toHexString());
      expect((await importJobs(db).findOne({ _id: job._id }))?.error).toBe(
        "access_removed",
      );
      const fresh = await context(),
        input = new TextEncoder().encode("url\nhttps://example.org"),
        created = await createImportJob(fresh, input.length);
      if (!created.ok) throw new Error(created.error);
      await store.put(created.value.inputKey, input, "text/csv");
      await inspectImport(fresh, created.value._id.toHexString());
      const worker = createImportWorker({
        ...deps(),
        durable,
        queueName: `imports-test-${crypto.randomUUID()}`,
        log() {},
      });
      try {
        await worker.pump();
        for (let count = 0; count < 100; count++) {
          if (
            (await importJobs(db).findOne({ _id: created.value._id }))
              ?.state === "mapping"
          )
            break;
          await Bun.sleep(50);
        }
        expect(
          (await importJobs(db).findOne({ _id: created.value._id }))?.state,
        ).toBe("mapping");
      } finally {
        await worker.worker.pause();
        await worker.queue.obliterate({ force: true });
        await worker.close();
      }
      await importJobs(db).updateOne(
        { _id: created.value._id },
        { $set: { state: "inspect_pending", inspected: 0 } },
      );
      objects.set(
        created.value.inputKey,
        new TextEncoder().encode("url\nhttps://example.net"),
      );
      await runImport(deps(), created.value._id.toHexString());
      expect(
        (await importJobs(db).findOne({ _id: created.value._id }))?.error,
      ).toBe("source_changed");
      expect(
        await importRows(db).countDocuments({ jobId: created.value._id }),
      ).toBe(1);
    });
  },
);
