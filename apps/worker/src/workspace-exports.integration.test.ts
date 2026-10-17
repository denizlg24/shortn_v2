import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import Redis from "ioredis";
import { unzipSync } from "fflate";
import { desiredIndexes, physicalNames } from "@shortn/db";
import {
  ensurePersonalWorkspace,
  workspaceArchiveFiles,
  prepareWorkspaceExport,
  workspaceExportJobs,
  workspaceExportDelivery,
  getWorkspaceExport,
  cancelWorkspaceExport,
  listWorkspaceExports,
  parseImportCsv,
  getLinkExport,
  getAnalyticsExport,
  type ServiceContext,
} from "@shortn/core";
import { migratedBioContent } from "@shortn/core/bio-content";
import type { ObjectStore } from "@shortn/storage";
import {
  workspaceZip,
  runWorkspaceExport,
  createWorkspaceExportWorker,
} from "./workspace-exports";
import { sendWorkspaceExportNotice } from "./workspace-export-notice";
import { runLinkExport } from "./link-exports";
import { runAnalyticsExport } from "./analytics-exports";

const mongoUrl = process.env.MONGO_TEST_URL,
  cacheUrl = process.env.REDIS_TEST_URL,
  durableUrl = process.env.REDIS_DURABLE_TEST_URL;
(mongoUrl && cacheUrl && durableUrl ? describe : describe.skip)(
  "full workspace portability export",
  () => {
    let client: MongoClient, db: Db, cache: Redis, durable: Redis;
    const objects = new Map<string, Uint8Array>(),
      queueNames: string[] = [];
    const store: ObjectStore = {
      async head(key) {
        const bytes = objects.get(key);
        return bytes
          ? { bytes: bytes.length, contentType: "application/zip" }
          : null;
      },
      async get(key) {
        return objects.get(key)!;
      },
      async put(key, bytes) {
        objects.set(key, bytes);
      },
      async putStream(key, chunks, _type, maximum) {
        const all = [];
        let size = 0;
        for await (const chunk of chunks) {
          all.push(chunk);
          size += chunk.length;
          if (size > maximum) throw new Error("archive_too_large");
        }
        objects.set(key, Buffer.concat(all));
        return size;
      },
      async sign(key, seconds) {
        return `https://synthetic.invalid/${key}?ttl=${seconds}`;
      },
    };
    beforeAll(async () => {
      if (
        ![mongoUrl, cacheUrl, durableUrl].every((url) =>
          ["127.0.0.1", "localhost"].includes(new URL(url!).hostname),
        )
      )
        throw new Error("Loopback only");
      client = await new MongoClient(mongoUrl!).connect();
      db = client.db(
        `shortn_workspace_export_${crypto.randomUUID().replaceAll("-", "")}`,
      );
      cache = new Redis(cacheUrl!);
      durable = new Redis(durableUrl!);
      await db.createCollection(physicalNames.click_events, {
        timeseries: { timeField: "ts", metaField: "m", granularity: "hours" },
      });
      await db
        .collection(physicalNames.export_jobs)
        .createIndexes(desiredIndexes[physicalNames.export_jobs]!);
    });
    afterAll(async () => {
      if (durable)
        for (const name of queueNames) {
          let cursor = "0";
          do {
            const [next, keys] = await durable.scan(
              cursor,
              "MATCH",
              `bull:${name}:*`,
              "COUNT",
              1000,
            );
            cursor = next;
            if (keys.length) await durable.unlink(...keys);
          } while (cursor !== "0");
        }
      await db?.dropDatabase();
      await client?.close();
      cache?.disconnect();
      durable?.disconnect();
    });
    async function context(): Promise<ServiceContext> {
      const userId = new ObjectId().toHexString(),
        workspace = await ensurePersonalWorkspace(db, {
          id: userId,
          sub: `workspace-export|${userId}`,
          name: "Synthetic workspace",
        });
      await db
        .collection(physicalNames.user)
        .insertOne({
          _id: new ObjectId(userId),
          email: `${userId}@synthetic.invalid`,
          emailVerified: true,
          locale: "pt",
        });
      return {
        db,
        cache,
        workspace,
        actor: { userId, role: "owner" },
        linkDomain: "workspace-export.invalid",
      };
    }
    const deps = () => ({
      db,
      cache,
      store,
      linkDomain: "workspace-export.invalid",
      appUrl: "https://app.synthetic.invalid",
    });
    async function archive(
      ctx: ServiceContext,
      progress?: (done: number, phase: string) => Promise<void>,
    ) {
      const chunks = [];
      for await (const chunk of workspaceZip(
        workspaceArchiveFiles(ctx, new Date(), undefined, progress),
      ))
        chunks.push(chunk);
      return unzipSync(Buffer.concat(chunks));
    }
    const json = (files: Record<string, Uint8Array>, name: string) =>
      JSON.parse(Buffer.from(files[name]!).toString());

    test("5,001 links and every content category share one snapshot; JSON/CSV exclude foreign data and secrets", async () => {
      const ctx = await context(),
        foreign = await context(),
        original = new ObjectId(),
        otherLink = new ObjectId(),
        bio = new ObjectId();
      const links = Array.from({ length: 5001 }, (_, i) => ({
        _id: i ? new ObjectId() : original,
        workspaceId: ctx.workspace._id,
        urlCode: `key-${i}`,
        longUrl: `https://example.com/${i}?utm_source=one&utm_source=two#part`,
        title: "=SUM(1)",
        passwordProtected: true,
        passwordHash: "PRIVATE_PASSWORD",
        password: "PRIVATE_PASSWORD",
        tags: [{ id: "alias", tagName: "North, South" }],
        isQrCode: i === 1,
        hidden: i === 2,
        ...(i === 3 ? { deletedAt: new Date() } : {}),
      }));
      await db
        .collection(physicalNames.links)
        .insertMany([
          ...links,
          {
            _id: otherLink,
            workspaceId: foreign.workspace._id,
            sub: ctx.workspace.legacySub,
            urlCode: "FOREIGN_SECRET",
            longUrl: "https://foreign.invalid",
          },
        ]);
      await db.collection(physicalNames.qr_codes).insertOne({
        _id: new ObjectId(),
        sub: ctx.workspace.legacySub,
        urlId: "key-1",
        longUrl: "https://example.com/qr",
        options: {
          width: 1024,
          dotsOptions: {
            type: "rounded",
            gradient: {
              type: "linear",
              rotation: 0,
              colorStops: [
                { offset: 0, color: "#000000" },
                { offset: 1, color: "#333333" },
              ],
            },
          },
        },
        providerSecret: "PRIVATE_QR",
      });
      const legacyBio = {
        _id: bio,
        userId: ctx.workspace.legacySub,
        slug: "synthetic",
        title: "São João",
        links: [{ link: original }, { link: otherLink }],
      };
      await db.collection(physicalNames.bio_pages).insertOne(legacyBio);
      const largeBioId = new ObjectId();
      await db
        .collection(physicalNames.bio_pages)
        .insertOne({
          ...legacyBio,
          _id: largeBioId,
          slug: "large-legacy",
          links: links.slice(0, 2501).map((link) => ({ link: link._id })),
        });
      await db
        .collection(physicalNames.bio_page_versions)
        .insertOne({
          workspaceId: ctx.workspace._id,
          bioPageId: bio,
          revision: 1,
          content: migratedBioContent(legacyBio),
          createdAt: new Date(),
        });
      await db
        .collection(physicalNames.campaigns)
        .insertOne({
          _id: new ObjectId(),
          sub: ctx.workspace.legacySub,
          title: "Launch",
          links: [original, otherLink],
          utmDefaults: { sources: ["newsletter"] },
        });
      await db
        .collection(physicalNames.tags)
        .insertOne({
          _id: new ObjectId(),
          sub: ctx.workspace.legacySub,
          id: "alias",
          tagName: "North, South",
          providerSecret: "PRIVATE_TAG",
        });
      await db
        .collection(physicalNames.domains)
        .insertOne({
          workspaceId: ctx.workspace._id,
          hostname: "links.synthetic.invalid",
          kind: "links",
          status: "active",
          cfCustomHostnameId: "PRIVATE_CF",
          verification: { value: "PRIVATE_DNS" },
        });
      await db.collection(physicalNames.click_events).insertMany([
        {
          ts: new Date(),
          m: {
            workspaceId: ctx.workspace._id,
            key: "key-0",
            linkId: original,
            kind: "click",
          },
          ipHash: "PRIVATE_VISITOR_A",
        },
        {
          ts: new Date(Date.now() - 1000 * 86400_000),
          m: {
            workspaceId: ctx.workspace._id,
            key: "key-0",
            linkId: original,
            kind: "scan",
          },
          ipHash: "PRIVATE_VISITOR_B",
        },
        {
          ts: new Date(),
          m: {
            workspaceId: foreign.workspace._id,
            key: "FOREIGN_SECRET",
            kind: "click",
          },
          ipHash: "PRIVATE_VISITOR_C",
        },
      ]);
      let changed = false;
      const files = await archive(ctx, async (done, phase) => {
        if (!changed && phase === "links" && done >= 500) {
          changed = true;
          await db
            .collection(physicalNames.links)
            .updateOne(
              { _id: original },
              { $set: { title: "AFTER_SNAPSHOT" } },
            );
          await db
            .collection(physicalNames.links)
            .insertOne({
              workspaceId: ctx.workspace._id,
              urlCode: "LATE_LINK",
              longUrl: "https://late.invalid",
            });
        }
      });
      expect(Object.keys(files)).toHaveLength(18);
      expect(json(files, "links.json")).toHaveLength(5001);
      expect(json(files, "links.json")[0].title).toBe("=SUM(1)");
      expect(
        json(files, "links.json").some(
          (row: { deletedAt: unknown }) => row.deletedAt,
        ),
      ).toBe(true);
      expect(
        json(files, "links.json").some(
          (row: { hidden: boolean }) => row.hidden,
        ),
      ).toBe(true);
      const csv = Buffer.from(files["links.csv"]!).toString();
      expect(csv).toContain('"\'=SUM(1)"');
      expect(csv).not.toContain("AFTER_SNAPSHOT");
      expect(csv).not.toContain("LATE_LINK");
      const parsed = parseImportCsv(files["links.csv"]!);
      expect(parsed.records).toHaveLength(5001);
      expect(
        json(files, "qr_codes.json")[0].storedDesign.dotsOptions.gradient.type,
      ).toBe("linear");
      expect(
        json(files, "bio_pages.json")[0].draft.blocks.flatMap(
          (block: {
            type: string;
            linkId?: string;
            items?: { linkId: string }[];
          }) =>
            block.type === "link"
              ? [block.linkId]
              : (block.items?.map((item) => item.linkId) ?? []),
        ),
      ).toEqual([original.toHexString()]);
      expect(
        json(files, "bio_pages.json").find(
          (page: { id: string }) => page.id === largeBioId.toHexString(),
        ).legacy.links,
      ).toHaveLength(2501);
      expect(json(files, "campaigns.json")[0].links).toEqual([
        original.toHexString(),
      ]);
      expect(json(files, "tags.json")[0].name).toBe("North, South");
      expect(json(files, "domains.json")[0].hostname).toBe(
        "links.synthetic.invalid",
      );
      const totals = json(files, "analytics.json").find(
        (row: { section: string }) => row.section === "total",
      );
      expect(totals).toMatchObject({ clicks: 1, scans: 1, uniques: 2 });
      expect(json(files, "manifest.json").counts.links).toBe(5001);
      const all = Object.values(files)
        .map((bytes) => Buffer.from(bytes).toString())
        .join("\n");
      for (const secret of [
        "FOREIGN_SECRET",
        "PRIVATE_PASSWORD",
        "PRIVATE_QR",
        "PRIVATE_TAG",
        "PRIVATE_CF",
        "PRIVATE_DNS",
        "PRIVATE_VISITOR",
      ])
        expect(all).not.toContain(secret);
    }, 20000);

    test("free owners can prepare; current ownership, kind, retry UUID, expiry and history remain enforced", async () => {
      const ctx = await context(),
        foreign = await context(),
        request = crypto.randomUUID();
      const prepared = await prepareWorkspaceExport(ctx, request);
      expect(prepared.ok).toBe(true);
      if (!prepared.ok) return;
      const id = prepared.value.id;
      expect(await prepareWorkspaceExport(ctx, request)).toEqual(prepared);
      expect(await prepareWorkspaceExport(ctx)).toEqual({
        ok: false,
        error: "export_in_progress",
      });
      expect(await getWorkspaceExport(foreign, id)).toBeNull();
      expect(await getLinkExport(ctx, id)).toBeNull();
      expect(await getAnalyticsExport(ctx, id)).toBeNull();
      expect(await runLinkExport(deps(), id)).toBe(false);
      expect(await runAnalyticsExport(deps(), id)).toBe(false);
      await db
        .collection(physicalNames.workspace_members)
        .updateOne(
          { workspaceId: ctx.workspace._id, userId: ctx.actor.userId },
          { $set: { role: "admin" } },
        );
      await expect(prepareWorkspaceExport(ctx)).rejects.toThrow("forbidden");
      await expect(getWorkspaceExport(ctx, id)).rejects.toThrow("forbidden");
      await db
        .collection(physicalNames.workspace_members)
        .updateOne(
          { workspaceId: ctx.workspace._id, userId: ctx.actor.userId },
          { $set: { role: "owner" } },
        );
      await runWorkspaceExport(deps(), id);
      const job = await getWorkspaceExport(ctx, id);
      expect(job?.state).toBe("completed");
      const delivered = await workspaceExportDelivery(ctx, id, store.sign);
      expect(delivered).toHaveProperty("downloadUrl");
      expect(JSON.stringify(delivered)).not.toContain("leaseToken");
      expect(JSON.stringify(delivered)).not.toContain("requestKey");
      await workspaceExportJobs(db).updateOne(
        { _id: new ObjectId(id) },
        { $set: { objectKey: "exports/jobs/analytics/foreign" } },
      );
      expect(
        await workspaceExportDelivery(ctx, id, store.sign),
      ).not.toHaveProperty("downloadUrl");
      await workspaceExportJobs(db).updateOne(
        { _id: new ObjectId(id) },
        { $set: { expiresAt: new Date(0) } },
      );
      expect(await getWorkspaceExport(ctx, id)).toBeNull();
      expect(await prepareWorkspaceExport(ctx, request)).toEqual({
        ok: false,
        error: "expired",
      });
      const seed = (await workspaceExportJobs(db).findOne({
        _id: new ObjectId(id),
      }))!;
      await workspaceExportJobs(db).insertMany(
        Array.from({ length: 30 }, () => ({
          ...seed,
          _id: new ObjectId(),
          requestKey: crypto.randomUUID(),
          state: "cancelled" as const,
          expiresAt: new Date(Date.now() + 86400_000),
        })),
      );
      expect((await listWorkspaceExports(ctx))?.items).toHaveLength(25);
      expect(
        (await listWorkspaceExports(ctx, { page: 2 }))?.items,
      ).toHaveLength(5);
      await workspaceExportJobs(db).updateMany(
        { workspaceId: ctx.workspace._id, state: "pending" },
        { $set: { state: "cancelled" } },
      );
      expect(await prepareWorkspaceExport(ctx, "not-a-uuid")).toEqual({
        ok: false,
        error: "invalid_export",
      });
    });

    test("mail uses the verified current owner, stable idempotency and separate retry state", async () => {
      const ctx = await context(),
        prepared = await prepareWorkspaceExport(ctx);
      if (!prepared.ok) throw new Error("prepare");
      const id = prepared.value.id;
      await runWorkspaceExport(deps(), id);
      let calls = 0;
      const mailer = {
        async workspaceExportReady(value: {
          to: string;
          locale: string;
          workspace: string;
          url: string;
          idempotencyKey: string;
        }) {
          calls++;
          expect(value.to).toBe(`${ctx.actor.userId}@synthetic.invalid`);
          expect(value.locale).toBe("pt");
          expect(value.url).toContain(`/settings/workspace/exports/${id}`);
          expect(value.url).not.toContain("X-Amz");
          expect(value.idempotencyKey).toBe(`workspace-export-ready-${id}`);
          if (calls === 1) throw new Error("synthetic email failure");
        },
      };
      await sendWorkspaceExportNotice({ ...deps(), mailer }, id);
      expect((await getWorkspaceExport(ctx, id))?.state).toBe("completed");
      expect((await getWorkspaceExport(ctx, id))?.emailState).toBe("pending");
      await workspaceExportJobs(db).updateOne(
        { _id: new ObjectId(id) },
        { $set: { mailNextAt: new Date(0) } },
      );
      await sendWorkspaceExportNotice({ ...deps(), mailer }, id);
      expect((await getWorkspaceExport(ctx, id))?.emailState).toBe("sent");
      expect(await sendWorkspaceExportNotice({ ...deps(), mailer }, id)).toBe(
        false,
      );
      expect(calls).toBe(2);
      expect((await getWorkspaceExport(ctx, id))?.attempts).toBe(1);
      const revoked = await prepareWorkspaceExport(ctx);
      if (!revoked.ok) throw new Error("prepare");
      await runWorkspaceExport(deps(), revoked.value.id);
      await db
        .collection(physicalNames.workspaces)
        .updateOne(
          { _id: ctx.workspace._id },
          { $set: { ownerUserId: new ObjectId().toHexString() } },
        );
      await sendWorkspaceExportNotice({ ...deps(), mailer }, revoked.value.id);
      expect(calls).toBe(2);
      expect(
        (
          await workspaceExportJobs(db).findOne({
            _id: new ObjectId(revoked.value.id),
          })
        )?.emailState,
      ).toBe("failed");
    });

    test("concurrent requests create one active archive, and expired active rows release capacity before TTL cleanup", async () => {
      const ctx = await context();
      const results = await Promise.all(
        Array.from({ length: 5 }, () => prepareWorkspaceExport(ctx)),
      );
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(
        results.filter(
          (result) => !result.ok && result.error === "export_in_progress",
        ),
      ).toHaveLength(4);
      const first = results.find((result) => result.ok)!;
      if (!first.ok) throw new Error("prepare");
      await workspaceExportJobs(db).updateOne(
        { _id: new ObjectId(first.value.id) },
        { $set: { expiresAt: new Date(0) } },
      );
      const next = await prepareWorkspaceExport(ctx);
      expect(next.ok).toBe(true);
      if (!next.ok) throw new Error("prepare");
      expect(
        (
          await workspaceExportJobs(db).findOne({
            _id: new ObjectId(first.value.id),
          })
        )?.state,
      ).toBe("failed");
      expect(await runWorkspaceExport(deps(), first.value.id)).toBe(false);
      await cancelWorkspaceExport(ctx, next.value.id);
    });

    test("cancellation, storage retry, lost owner and replaced lease never publish stale output", async () => {
      const ctx = await context(),
        cancelled = await prepareWorkspaceExport(ctx);
      if (!cancelled.ok) throw new Error("prepare");
      expect(await cancelWorkspaceExport(ctx, cancelled.value.id)).toBe(true);
      expect(await runWorkspaceExport(deps(), cancelled.value.id)).toBe(false);
      const running = await prepareWorkspaceExport(ctx);
      if (!running.ok) throw new Error("prepare");
      const runningId = running.value.id;
      await runWorkspaceExport(
        {
          ...deps(),
          store: {
            ...store,
            async putStream(key, chunks, type, max) {
              async function* cancelDuringZip() {
                let n = 0;
                for await (const chunk of chunks) {
                  yield chunk;
                  if (++n === 10) await cancelWorkspaceExport(ctx, runningId);
                }
              }
              return store.putStream!(key, cancelDuringZip(), type, max);
            },
          },
        },
        runningId,
      );
      expect((await getWorkspaceExport(ctx, runningId))?.state).toBe(
        "cancelled",
      );
      expect(
        await workspaceExportDelivery(ctx, runningId, store.sign),
      ).not.toHaveProperty("downloadUrl");
      const retry = await prepareWorkspaceExport(ctx);
      if (!retry.ok) throw new Error("prepare");
      await runWorkspaceExport(
        {
          ...deps(),
          store: {
            ...store,
            async putStream() {
              throw new Error("synthetic transport");
            },
          },
        },
        retry.value.id,
      );
      expect((await getWorkspaceExport(ctx, retry.value.id))?.state).toBe(
        "pending",
      );
      await workspaceExportJobs(db).updateOne(
        { _id: new ObjectId(retry.value.id) },
        { $set: { nextAttemptAt: new Date(0) } },
      );
      await runWorkspaceExport(deps(), retry.value.id);
      expect((await getWorkspaceExport(ctx, retry.value.id))?.state).toBe(
        "completed",
      );
      const stale = await prepareWorkspaceExport(ctx);
      if (!stale.ok) throw new Error("prepare");
      const staleId = new ObjectId(stale.value.id);
      await runWorkspaceExport(
        {
          ...deps(),
          store: {
            ...store,
            async putStream(key, chunks, type, max) {
              const bytes = await store.putStream!(key, chunks, type, max);
              await workspaceExportJobs(db).updateOne(
                { _id: staleId },
                {
                  $set: {
                    leaseToken: "replacement",
                    leaseUntil: new Date(Date.now() + 300000),
                  },
                },
              );
              return bytes;
            },
          },
        },
        stale.value.id,
      );
      expect(
        (await workspaceExportJobs(db).findOne({ _id: staleId }))?.objectKey,
      ).toBeUndefined();
      await workspaceExportJobs(db).updateOne(
        { _id: staleId },
        { $set: { leaseUntil: new Date(0), nextAttemptAt: new Date(0) } },
      );
      await runWorkspaceExport(deps(), stale.value.id);
      expect((await getWorkspaceExport(ctx, stale.value.id))?.state).toBe(
        "completed",
      );
      await expect(
        archive(ctx, async (_done, phase) => {
          if (phase === "links")
            await db
              .collection(physicalNames.workspace_members)
              .deleteOne({
                workspaceId: ctx.workspace._id,
                userId: ctx.actor.userId,
              });
        }),
      ).rejects.toThrow("forbidden");
    });

    test("real queue pumps generation and ready mail without a paid plan", async () => {
      const ctx = await context(),
        prepared = await prepareWorkspaceExport(ctx);
      if (!prepared.ok) throw new Error("prepare");
      let sent = 0;
      const factory = createWorkspaceExportWorker({
        ...deps(),
        durable,
        queueName: `workspace-export-test-${crypto.randomUUID()}`,
        mailer: {
          async workspaceExportReady() {
            sent++;
          },
        },
        log() {},
      });
      queueNames.push(factory.queue.name);
      try {
        const deadline = Date.now() + 15000;
        while (
          Date.now() < deadline &&
          (await getWorkspaceExport(ctx, prepared.value.id))?.emailState !==
            "sent"
        ) {
          await factory.pump();
          await Bun.sleep(50);
        }
        expect((await getWorkspaceExport(ctx, prepared.value.id))?.state).toBe(
          "completed",
        );
        expect(
          (await getWorkspaceExport(ctx, prepared.value.id))?.emailState,
        ).toBe("sent");
        expect(sent).toBeGreaterThan(0);
      } finally {
        await factory.close();
      }
    }, 20000);
  },
);
