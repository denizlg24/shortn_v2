import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import Redis from "ioredis";
import { collection } from "@shortn/db";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { ensurePersonalWorkspace } from "../workspaces/service";
import type { ServiceContext } from "../workspaces/context";
import {
  authenticateApiKey,
  createApiKey,
  listApiKeys,
  revokeApiKey,
  rollApiKey,
} from "./service";

const mongoUrl = process.env.MONGO_TEST_URL;
const pepper = "test-api-key-pepper-".repeat(3);
(mongoUrl ? describe : describe.skip)(
  "API key lifecycle with live membership",
  () => {
    let client: MongoClient, db: Db, ctx: ServiceContext;
    beforeAll(async () => {
      if (!/^mongodb:\/\/(localhost|127\.0\.0\.1):/.test(mongoUrl!))
        throw new Error("API key integration tests require loopback MongoDB");
      client = await new MongoClient(mongoUrl!).connect();
      db = client.db(
        `shortn_p6_keys_test_${crypto.randomUUID().replaceAll("-", "")}`,
      );
      await collection(db, "api_keys").createIndex(
        { hashedKey: 1 },
        { unique: true },
      );
      const userId = new ObjectId().toHexString();
      const workspace = await ensurePersonalWorkspace(db, {
        id: userId,
        name: "P6 Keys",
      });
      ctx = {
        db,
        workspace,
        actor: { userId, role: "owner" },
        cache: {
          del: async () => 0,
          publish: async () => 0,
          eval: async () => 0,
        },
        linkDomain: "shortn.at",
      };
    });
    afterAll(async () => {
      await db?.dropDatabase();
      await client?.close();
    });

    test("secret is shown once; storage and lists contain only the hash/prefix", async () => {
      const result = await createApiKey(
        ctx,
        { name: "Automation", scopes: ["links:read"] },
        pepper,
      );
      if (!result.ok) throw new Error(result.error);
      expect(result.value.secret).toMatch(/^sk_live_[A-Za-z0-9]{24}$/);
      const stored = await collection(db, "api_keys").findOne({
        _id: new ObjectId(result.value.key.id),
      });
      expect(stored?.hashedKey).toMatch(/^[a-f0-9]{64}$/);
      expect(JSON.stringify(stored)).not.toContain(result.value.secret);
      expect(JSON.stringify(await listApiKeys(ctx))).not.toContain("hashedKey");
      const auth = await authenticateApiKey(db, result.value.secret, pepper);
      expect(auth.ok && auth.value.actor.role).toBe("owner");
      expect(
        (
          await authenticateApiKey(
            db,
            result.value.secret,
            "different".repeat(8),
          )
        ).ok,
      ).toBe(false);
    });

    test.skipIf(!process.env.REDIS_TEST_URL)(
      "usage throttling limits writes while revocation remains live",
      async () => {
        const redisUrl = process.env.REDIS_TEST_URL!;
        if (!/^redis:\/\/(localhost|127\.0\.0\.1):/.test(redisUrl))
          throw new Error("Usage tests require loopback Redis");
        const cache = new Redis(redisUrl);
        const created = await createApiKey(
          ctx,
          { name: "Throttle", scopes: ["links:read"] },
          pepper,
        );
        if (!created.ok) throw new Error(created.error);
        const { secret, key } = created.value;
        const throttleKey = `apikey:last-used:${key.id}`;
        const filter = { _id: new ObjectId(key.id) };
        const now = new Date();
        try {
          expect(
            (
              await authenticateApiKey(
                db,
                secret,
                pepper,
                undefined,
                now,
                cache,
              )
            ).ok,
          ).toBe(true);
          expect(await cache.ttl(throttleKey)).toBeGreaterThan(50);
          expect(
            (
              await authenticateApiKey(
                db,
                secret,
                pepper,
                undefined,
                new Date(now.getTime() + 30_000),
                cache,
              )
            ).ok,
          ).toBe(true);
          expect(
            (await collection(db, "api_keys").findOne(filter))?.lastUsedAt,
          ).toEqual(now);
          await cache.del(throttleKey);
          const later = new Date(now.getTime() + 61_000);
          expect(
            (
              await authenticateApiKey(
                db,
                secret,
                pepper,
                undefined,
                later,
                cache,
              )
            ).ok,
          ).toBe(true);
          expect(
            (await collection(db, "api_keys").findOne(filter))?.lastUsedAt,
          ).toEqual(later);
          expect((await revokeApiKey(ctx, key.id)).ok).toBe(true);
          expect(
            (
              await authenticateApiKey(
                db,
                secret,
                pepper,
                undefined,
                later,
                cache,
              )
            ).ok,
          ).toBe(false);
        } finally {
          await cache.del(throttleKey);
          cache.disconnect();
        }
      },
    );

    test("role changes and removal apply on the next use", async () => {
      const created = await createApiKey(
        ctx,
        { name: "Role", scopes: ["links:write"] },
        pepper,
      );
      if (!created.ok) throw new Error(created.error);
      const members = collection(db, "workspace_members");
      const filter = {
        workspaceId: ctx.workspace._id,
        userId: ctx.actor.userId,
      };
      await members.updateOne(filter, { $set: { role: "viewer" } });
      const auth = await authenticateApiKey(db, created.value.secret, pepper);
      expect(auth.ok && auth.value.actor.role).toBe("viewer");
      const member = await members.findOne(filter);
      if (!member) throw new Error("missing member");
      await members.deleteOne(filter);
      expect(
        (await authenticateApiKey(db, created.value.secret, pepper)).ok,
      ).toBe(false);
      await members.insertOne({ ...member, role: "owner" });
    });

    test("expired, revoked and IP-restricted keys fail immediately", async () => {
      const now = new Date();
      const created = await createApiKey(
        ctx,
        {
          name: "Restricted",
          scopes: ["links:read"],
          ipAllowlist: ["192.0.2.0/24"],
          expiresAt: new Date(now.getTime() + 60_000),
        },
        pepper,
      );
      if (!created.ok) throw new Error(created.error);
      const { secret, key } = created.value;
      expect(
        (await authenticateApiKey(db, secret, pepper, "192.0.2.1", now)).ok,
      ).toBe(true);
      expect(
        (await authenticateApiKey(db, secret, pepper, "192.0.3.1", now)).ok,
      ).toBe(false);
      expect((await authenticateApiKey(db, secret, pepper)).ok).toBe(false);
      expect(
        (
          await authenticateApiKey(
            db,
            secret,
            pepper,
            "192.0.2.1",
            new Date(now.getTime() + 60_000),
          )
        ).ok,
      ).toBe(false);
      expect((await revokeApiKey(ctx, key.id)).ok).toBe(true);
      expect(
        (await authenticateApiKey(db, secret, pepper, "192.0.2.1", now)).ok,
      ).toBe(false);
    });

    test("rolling atomically replaces the secret and preserves restrictions", async () => {
      const created = await createApiKey(
        ctx,
        { name: "Roll", scopes: ["links:read"], ipAllowlist: ["192.0.2.1"] },
        pepper,
      );
      if (!created.ok) throw new Error(created.error);
      const rolled = await rollApiKey(ctx, created.value.key.id, pepper);
      if (!rolled.ok) throw new Error(rolled.error);
      expect(rolled.value.secret).not.toBe(created.value.secret);
      expect(
        (
          await authenticateApiKey(
            db,
            created.value.secret,
            pepper,
            "192.0.2.1",
          )
        ).ok,
      ).toBe(false);
      expect(
        (await authenticateApiKey(db, rolled.value.secret, pepper, "192.0.2.1"))
          .ok,
      ).toBe(true);
      expect(
        (await authenticateApiKey(db, rolled.value.secret, pepper, "192.0.2.2"))
          .ok,
      ).toBe(false);
      expect((await rollApiKey(ctx, created.value.key.id, pepper)).ok).toBe(
        false,
      );
    });

    test("concurrent rotations produce exactly one replacement", async () => {
      const created = await createApiKey(
        ctx,
        { name: "Concurrent roll", scopes: ["links:read"] },
        pepper,
      );
      if (!created.ok) throw new Error(created.error);
      const results = await Promise.all(
        Array.from({ length: 3 }, () =>
          rollApiKey(ctx, created.value.key.id, pepper),
        ),
      );
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(
        (await authenticateApiKey(db, created.value.secret, pepper)).ok,
      ).toBe(false);
    });

    test("key management enforces role, workspace boundaries, and bounded pagination", async () => {
      const member = {
        ...ctx,
        actor: { ...ctx.actor, role: "member" as const },
      };
      expect(
        await createApiKey(
          member,
          { name: "No", scopes: ["links:read"] },
          pepper,
        ),
      ).toEqual({ ok: false, error: "forbidden" });
      expect((await listApiKeys(member)).ok).toBe(false);
      const created = await createApiKey(
        ctx,
        { name: "Boundary", scopes: ["links:read"] },
        pepper,
      );
      if (!created.ok) throw new Error(created.error);
      const other = {
        ...ctx,
        workspace: { ...ctx.workspace, _id: new ObjectId() },
      };
      expect(await revokeApiKey(other, created.value.key.id)).toEqual({
        ok: false,
        error: "not_found",
      });
      const first = await listApiKeys(ctx, undefined, 1);
      if (!first.ok || !first.value.nextCursor)
        throw new Error("missing first page");
      const second = await listApiKeys(ctx, first.value.nextCursor, 1);
      expect(second.ok && second.value.items[0]?.id).not.toBe(
        first.value.items[0]?.id,
      );
      expect(
        (
          await createApiKey(
            ctx,
            { name: "Expired", scopes: ["links:read"], expiresAt: new Date(0) },
            pepper,
          )
        ).ok,
      ).toBe(false);
    });
  },
);
