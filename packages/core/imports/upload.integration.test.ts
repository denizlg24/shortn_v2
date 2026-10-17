import { beforeAll, afterAll, describe, test, expect } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import Redis from "ioredis";
import { physicalNames } from "@shortn/db";
import { createImportJob, getImportJob } from "./jobs";
import { uploadImportSource } from "./upload";
import { ensurePersonalWorkspace } from "../workspaces/service";
import type { ServiceContext } from "../workspaces/context";
const mongo = process.env.MONGO_TEST_URL,
  cache = process.env.REDIS_TEST_URL;
(mongo && cache ? describe : describe.skip)(
  "single-write import upload fallback",
  () => {
    let client: MongoClient, db: Db, redis: Redis;
    beforeAll(async () => {
      if (
        ![mongo, cache].every((u) =>
          ["localhost", "127.0.0.1"].includes(new URL(u!).hostname),
        )
      )
        throw Error("Loopback only");
      client = await new MongoClient(mongo!).connect();
      db = client.db(
        `shortn_upload_${crypto.randomUUID().replaceAll("-", "")}`,
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
          sub: `import|${userId}`,
          name: "Synthetic import",
        });
      return {
        db,
        cache: redis,
        workspace,
        actor: { userId, role: "owner" },
        linkDomain: "shortn.invalid",
      };
    }

    const bytes = new TextEncoder().encode("url\nhttps://example.com/\n");
    async function fixture() {
      const ctx = await context();
      const result = await createImportJob(ctx, bytes.length);
      if (!result.ok) throw Error(result.error);
      return { ctx, id: String(result.value._id) };
    }
    test("concurrent and later uploads cannot overwrite a claimed source", async () => {
      const { ctx, id } = await fixture();
      let writes = 0;
      const results = await Promise.all(
        [1, 2].map(() =>
          uploadImportSource(ctx, id, bytes, async () => {
            writes++;
            await Bun.sleep(10);
          }),
        ),
      );
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(writes).toBe(1);
      expect((await getImportJob(ctx, id))?.state).toBe("inspect_pending");
      expect(
        await uploadImportSource(ctx, id, bytes, async () => {
          writes++;
        }),
      ).toMatchObject({ ok: false, error: "invalid_state" });
      expect(writes).toBe(1);
    });
    test("foreign actor, viewer, wrong size and expired jobs cannot write", async () => {
      const { ctx, id } = await fixture();
      let writes = 0;
      const put = async () => {
        writes++;
      };
      expect(
        (
          await uploadImportSource(
            {
              ...ctx,
              actor: { ...ctx.actor, userId: new ObjectId().toHexString() },
            },
            id,
            bytes,
            put,
          )
        ).ok,
      ).toBe(false);
      expect(
        (
          await uploadImportSource(
            { ...ctx, actor: { ...ctx.actor, role: "viewer" } },
            id,
            bytes,
            put,
          )
        ).ok,
      ).toBe(false);
      expect((await uploadImportSource(ctx, id, bytes.slice(1), put)).ok).toBe(
        false,
      );
      await db
        .collection(physicalNames.import_jobs)
        .updateOne(
          { _id: new ObjectId(id) },
          { $set: { expiresAt: new Date(0) } },
        );
      expect((await uploadImportSource(ctx, id, bytes, put)).ok).toBe(false);
      expect(writes).toBe(0);
    });
    test("storage failures leave the claim terminal and never release it to a stale writer", async () => {
      const { ctx, id } = await fixture();
      let writes = 0;
      expect(
        await uploadImportSource(ctx, id, bytes, async () => {
          writes++;
          throw Error("storage secret");
        }),
      ).toMatchObject({ ok: false, error: "storage_unavailable" });
      expect((await getImportJob(ctx, id))?.state).toBe("failed");
      expect(
        (
          await uploadImportSource(ctx, id, bytes, async () => {
            writes++;
          })
        ).ok,
      ).toBe(false);
      expect(writes).toBe(1);
    });
  },
);
