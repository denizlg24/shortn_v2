import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { collection, physicalNames } from "@shortn/db";
import { Redis } from "ioredis";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { createLink } from "../links/service";
import type { ServiceContext } from "../workspaces/context";
import { ensurePersonalWorkspace } from "../workspaces/service";
import { recordImpersonatedAction } from "./impersonation";

const mongoUrl = process.env.MONGO_TEST_URL;
const redisUrl = process.env.REDIS_TEST_URL;

(mongoUrl && redisUrl ? describe : describe.skip)(
  "impersonated service calls",
  () => {
    let client: MongoClient, db: Db, redis: Redis, ctx: ServiceContext;
    const adminId = new ObjectId();

    beforeAll(async () => {
      client = await new MongoClient(mongoUrl!).connect();
      db = client.db(
        `shortn_impersonated_${crypto.randomUUID().replaceAll("-", "")}`,
      );
      redis = new Redis(redisUrl!);
      const userId = new ObjectId().toHexString();
      const workspace = await ensurePersonalWorkspace(db, {
        id: userId,
        name: "Target",
      });
      await db.collection(physicalNames.user).insertOne({
        _id: adminId,
        email: "staff@shortn.at",
        role: "superadmin",
      });
      ctx = {
        db,
        workspace,
        actor: { userId, role: "owner" },
        cache: redis,
        linkDomain: "shortn.at",
      };
    });
    afterAll(async () => {
      await db?.dropDatabase();
      await client?.close();
      redis?.disconnect();
    });

    test("read mode can't mutate; write mode can", async () => {
      expect(
        await createLink(
          { ...ctx, actor: { ...ctx.actor, impersonation: "read" } },
          { url: "https://example.com/read" },
        ),
      ).toMatchObject({ ok: false, error: "forbidden" });
      expect(
        (
          await createLink(
            { ...ctx, actor: { ...ctx.actor, impersonation: "write" } },
            { url: "https://example.com/write" },
          )
        ).ok,
      ).toBe(true);
    });

    test("each write-mode action leaves an attributed staff audit row", async () => {
      await recordImpersonatedAction(db, {
        adminId: adminId.toHexString(),
        userId: ctx.actor.userId,
        workspaceId: ctx.workspace._id,
        sessionId: "session-1",
        actionId: "7f00aa",
        path: "https://app.shortn.at/w/links/new",
      });
      expect(
        await collection(db, "admin_audit_log").findOne({
          action: "impersonation.action",
        }),
      ).toMatchObject({
        actorId: adminId.toHexString(),
        actorEmail: "staff@shortn.at",
        actorRole: "superadmin",
        targetType: "user",
        targetId: ctx.actor.userId,
        workspaceId: ctx.workspace._id,
        status: "succeeded",
        adminSessionId: "session-1",
        metadata: { actionId: "7f00aa" },
      });
    });
  },
);
