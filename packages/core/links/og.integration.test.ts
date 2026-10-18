import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { Redis } from "ioredis";
import { collection } from "@shortn/db";
import { keys } from "@shortn/redis";
import { createLink, createMany, getLink, updateLink } from "./service";
import { ensurePersonalWorkspace } from "../workspaces/service";
import type { ServiceContext } from "../workspaces/context";
import { mongoLinkLoader } from "../../../apps/redirect/src/resolver";
const mongo = process.env.MONGO_TEST_URL,
  cacheUrl = process.env.REDIS_TEST_URL;
(mongo && cacheUrl ? describe : describe.skip)(
  "social preview persistence and invalidation",
  () => {
    let client: MongoClient, db: Db, cache: Redis;
    beforeAll(async () => {
      if (
        ![mongo, cacheUrl].every((url) =>
          ["localhost", "127.0.0.1"].includes(new URL(url!).hostname),
        )
      )
        throw new Error("Loopback fixtures required");
      client = await new MongoClient(mongo!).connect();
      db = client.db(`shortn_og_${crypto.randomUUID().replaceAll("-", "")}`);
      cache = new Redis(cacheUrl!);
    });
    afterAll(async () => {
      await db?.dropDatabase();
      await client?.close();
      cache?.disconnect();
    });
    async function context(): Promise<ServiceContext> {
      const userId = new ObjectId().toHexString();
      return {
        db,
        cache,
        workspace: await ensurePersonalWorkspace(db, {
          id: userId,
          name: "Preview",
        }),
        actor: { userId, role: "owner" },
        linkDomain: "shortn.at",
      };
    }
    test("creation and replacement persist canonical metadata; clearing evicts canonical and alias cache keys", async () => {
      const ctx = await context();
      const created = await createLink(ctx, {
        url: "https://example.com",
        og: {
          title: " First ",
          description: undefined,
          image: "https://images.example.com/one.png",
        },
      });
      if (!created.ok) throw new Error(created.error);
      const id = new ObjectId(created.value.id),
        alias = `alias${id}`;
      expect(created.value.og).toEqual({
        title: "First",
        image: "https://images.example.com/one.png",
      });
      await collection(db, "links").updateOne(
        { _id: id },
        { $set: { previousKeys: [alias] } },
      );
      expect(
        await mongoLinkLoader(db)("shortn.at", created.value.key),
      ).toMatchObject({ og: created.value.og });
      const cacheKeys = [
        keys.link("shortn.at", created.value.key),
        keys.link("shortn.at", alias),
      ];
      try {
        for (const key of cacheKeys) await cache.set(key, "stale");
        const updated = await updateLink(ctx, created.value.id, {
          og: { description: "New description" },
        });
        expect(updated.ok && updated.value.og).toEqual({
          description: "New description",
        });
        expect(await cache.mget(...cacheKeys)).toEqual([null, null]);
        expect((await getLink(ctx, created.value.id))?.og).toEqual({
          description: "New description",
        });
        const cleared = await updateLink(ctx, created.value.id, { og: null });
        expect(cleared.ok && cleared.value.og).toBeUndefined();
        expect(
          (await collection(db, "links").findOne({ _id: id }))!.og,
        ).toBeUndefined();
        expect(
          await mongoLinkLoader(db)("shortn.at", created.value.key),
        ).not.toHaveProperty("og");
        expect(
          (
            await updateLink(
              { ...ctx, actor: { ...ctx.actor, role: "viewer" } },
              created.value.id,
              { og: { title: "No" } },
            )
          ).ok,
        ).toBe(false);
        expect(
          (
            await updateLink(await context(), created.value.id, {
              og: { title: "Foreign" },
            })
          ).ok,
        ).toBe(false);
      } finally {
        await cache.del(...cacheKeys);
      }
    });
    test("bulk metadata validation is atomic and valid metadata survives every created row", async () => {
      const ctx = await context();
      expect(
        (
          await createMany(ctx, [
            { url: "https://example.com", og: { title: "Valid" } },
            {
              url: "https://example.com",
              og: { image: "https://127.0.0.1/x" },
            },
          ])
        ).ok,
      ).toBe(false);
      expect(
        await collection(db, "links").countDocuments({
          workspaceId: ctx.workspace._id,
        }),
      ).toBe(0);
      const result = await createMany(ctx, [
        { url: "https://example.com", og: { title: "One" } },
        { url: "https://example.org", og: { title: "Two" } },
      ]);
      if (!result.ok) throw new Error(result.error);
      expect(result.value.map((row) => row.og?.title)).toEqual(["One", "Two"]);
    });
  },
);
