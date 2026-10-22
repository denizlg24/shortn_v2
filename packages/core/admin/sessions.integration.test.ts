import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { collection, physicalNames } from "@shortn/db";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { withAdminAudit } from "./audit";
import type { AdminContext } from "./context";
import {
  adminSessionIdleMs,
  createAdminSession,
  markAdminSessionElevated,
  resolveAdminSession,
} from "./sessions";

const mongoUrl = process.env.MONGO_TEST_URL;

(mongoUrl ? describe : describe.skip)("admin sessions and audit", () => {
  let client: MongoClient, db: Db;
  beforeAll(async () => {
    client = await new MongoClient(mongoUrl!).connect();
    db = client.db(`shortn_admin_${crypto.randomUUID().replaceAll("-", "")}`);
  });
  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
  });

  const staff = async (role: "admin" | "superadmin" | "user" = "admin") => {
    const _id = new ObjectId();
    await db
      .collection(physicalNames.user)
      .insertOne({ _id, email: `${_id.toHexString()}@x.com`, role });
    return _id.toHexString();
  };
  const ua = "Mozilla/5.0 test";

  test("a session resolves for its browser and staff role only", async () => {
    const userId = await staff();
    const { token } = await createAdminSession(db, { userId, userAgent: ua });
    const resolved = await resolveAdminSession(db, token, { userAgent: ua });
    expect(resolved?.admin).toMatchObject({ id: userId, role: "admin" });
    expect(resolved?.session.elevatedAt).toBeInstanceOf(Date);

    // Another browser burns the session.
    expect(await resolveAdminSession(db, token, { userAgent: "x" })).toBeNull();
    expect(await resolveAdminSession(db, token, { userAgent: ua })).toBeNull();
  });

  test("demotion and bans end the session on the next request", async () => {
    const userId = await staff();
    const users = db.collection(physicalNames.user);
    const first = await createAdminSession(db, { userId, userAgent: ua });
    await users.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { role: "user" } },
    );
    expect(
      await resolveAdminSession(db, first.token, { userAgent: ua }),
    ).toBeNull();

    await users.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { role: "superadmin", banned: true } },
    );
    const second = await createAdminSession(db, { userId, userAgent: ua });
    expect(
      await resolveAdminSession(db, second.token, { userAgent: ua }),
    ).toBeNull();
    expect(
      await collection(db, "admin_sessions").countDocuments({ userId }),
    ).toBe(0);
  });

  test("idle sessions expire and activity slides the idle window", async () => {
    const userId = await staff("superadmin");
    const start = new Date();
    const { token, id } = await createAdminSession(db, {
      userId,
      userAgent: ua,
      now: start,
    });
    const later = new Date(start.getTime() + adminSessionIdleMs - 1000);
    expect(
      await resolveAdminSession(db, token, { userAgent: ua, now: later }),
    ).not.toBeNull();
    const row = await collection(db, "admin_sessions").findOne({ _id: id });
    expect(row?.idleUntil.getTime()).toBeGreaterThan(
      start.getTime() + adminSessionIdleMs,
    );
    const idle = new Date(later.getTime() + adminSessionIdleMs + 1000);
    expect(
      await resolveAdminSession(db, token, { userAgent: ua, now: idle }),
    ).toBeNull();
  });

  test("step-up only refreshes the session's own user", async () => {
    const userId = await staff();
    const { id } = await createAdminSession(db, { userId, userAgent: ua });
    expect(await markAdminSessionElevated(db, id, "someone-else")).toBe(false);
    expect(await markAdminSessionElevated(db, id, userId)).toBe(true);
  });

  const context = (database: Db): AdminContext => ({
    db: database,
    cache: {
      eval: async () => null,
      del: async () => 0,
      publish: async () => 0,
      get: async () => null,
      set: async () => "OK",
    },
    admin: { id: "a", email: "a@x.com", role: "admin" },
    session: { id: "s" },
    request: { ip: "127.0.0.1" },
    linkDomain: "shortn.at",
    now: () => new Date(),
  });

  test("the audit row is written ahead and completed with the result", async () => {
    const ctx = context(db);
    const intent = {
      action: "test.ok",
      targetType: "user" as const,
      targetId: "t",
      reason: " because ",
    };
    let seen: string | undefined;
    const result = await withAdminAudit(
      ctx,
      intent,
      async () => {
        const row = await collection(db, "admin_audit_log").findOne({
          action: "test.ok",
        });
        seen = row?.status;
        return { ok: true as const, value: 3 };
      },
      (r) => (r.ok ? { count: r.value } : undefined),
    );
    expect(result).toEqual({ ok: true, value: 3 });
    expect(seen).toBe("started");
    const row = await collection(db, "admin_audit_log").findOne({
      action: "test.ok",
    });
    expect(row).toMatchObject({
      status: "succeeded",
      reason: "because",
      actorRole: "admin",
      metadata: { count: 3 },
    });

    await withAdminAudit(ctx, { ...intent, action: "test.fail" }, async () => ({
      ok: false as const,
      error: "not_found",
    }));
    expect(
      await collection(db, "admin_audit_log").findOne({ action: "test.fail" }),
    ).toMatchObject({ status: "failed", error: "not_found" });
  });

  test("a failed audit insert refuses the mutation", async () => {
    // A closed client makes the started insert throw.
    const closed = await new MongoClient(mongoUrl!).connect();
    const doomed = closed.db(db.databaseName);
    await closed.close();
    let ran = false;
    await expect(
      withAdminAudit(
        context(doomed),
        { action: "test.closed", targetType: "user", targetId: "t" },
        async () => {
          ran = true;
          return { ok: true as const, value: null };
        },
      ),
    ).rejects.toThrow();
    expect(ran).toBe(false);
  });
});
