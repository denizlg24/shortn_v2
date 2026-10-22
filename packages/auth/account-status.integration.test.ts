import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ObjectId, type Db } from "mongodb";
import { closeMongoClient, getDb, physicalNames } from "@shortn/db";
import { createAuth, hashHandoffToken } from "./index";
import fixture from "./fixtures/better-auth-1.4.18.json";

const mongo = process.env.MONGO_TEST_URL;
(mongo ? describe : describe.skip)("staff-managed account fields", () => {
  let db: Db, auth: ReturnType<typeof createAuth>;
  let ip = 1;
  const userId = new ObjectId(fixture.user.id);
  const cookies = (response: Response) =>
    response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
  const request = (path: string, body?: Record<string, unknown>, cookie = "") =>
    auth.handler(
      new Request(`${fixture.origin}/api/auth${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          Origin: fixture.origin,
          Cookie: cookie,
          "x-forwarded-for": `198.51.100.${ip++}`,
          "user-agent": "account-status-test",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
  const signIn = () =>
    request("/sign-in/email", {
      email: fixture.user.email,
      password: fixture.password,
    });
  const users = () => db.collection(physicalNames.user);

  beforeAll(async () => {
    if (!["localhost", "127.0.0.1"].includes(new URL(mongo!).hostname))
      throw new Error("Loopback Mongo required");
    const config = {
      url: mongo!,
      database: `shortn_account_status_${crypto.randomUUID().replaceAll("-", "")}`,
    };
    db = await getDb(config);
    auth = createAuth({
      baseURL: fixture.origin,
      secret: fixture.secret,
      production: false,
      mongo: config,
      polar: { accessToken: "synthetic-unused-token", server: "sandbox" },
      emails: {
        verifyEmail: async () => {},
        emailVerified: async () => {},
        resetPassword: async () => {},
        confirmEmailChange: async () => {},
      },
    });
    const now = new Date();
    await users().insertOne({
      _id: userId,
      name: fixture.user.name,
      email: fixture.user.email,
      emailVerified: true,
      sub: "legacy|account-status",
      createdAt: now,
      updatedAt: now,
    });
    await db.collection(physicalNames.account).insertOne({
      _id: new ObjectId(),
      userId,
      accountId: fixture.user.id,
      providerId: "credential",
      password: fixture.account.password,
      createdAt: now,
      updatedAt: now,
    });
  });
  afterAll(async () => {
    await db?.dropDatabase();
    await closeMongoClient();
  });

  test("update-user can't assign role, ban or deletion fields", async () => {
    const response = await signIn();
    expect(response.status).toBe(200);
    const session = cookies(response);
    for (const body of [
      { role: "admin" },
      { role: "superadmin", name: "Escalated" },
      { banned: true },
      { banExpires: new Date().toISOString() },
      { deletion: { state: "done" } },
    ])
      expect((await request("/update-user", body, session)).status).toBe(400);
    const user = await users().findOne({ _id: userId });
    expect(user?.role).toBeUndefined();
    expect(user?.banned).toBeUndefined();
    expect(user?.banExpires).toBeUndefined();
    expect(user?.deletion).toBeUndefined();
    expect(user?.name).toBe(fixture.user.name);
  });

  test("the session exposes role but not deletion", async () => {
    await users().updateOne({ _id: userId }, { $set: { role: "admin" } });
    const session = cookies(await signIn());
    await users().updateOne(
      { _id: userId },
      {
        $set: {
          deletion: {
            requestedAt: new Date(),
            by: "staff",
            purgeAfter: new Date(),
            state: "scheduled",
          },
        },
      },
    );
    const body = await (
      await request("/get-session", undefined, session)
    ).json();
    expect(body.user.role).toBe("admin");
    expect("deletion" in body.user).toBe(false);
    await users().updateOne(
      { _id: userId },
      { $unset: { deletion: "", role: "" } },
    );
  });

  const sessionCount = () =>
    db
      .collection(physicalNames.session)
      .countDocuments({ userId: { $in: [userId, String(userId)] } });

  test("a banned user can't sign in with a password; the public reason is returned", async () => {
    await users().updateOne(
      { _id: userId },
      { $set: { banned: true, banReason: "Phishing links" } },
    );
    try {
      const before = await sessionCount();
      const response = await signIn();
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.code).toBe("ACCOUNT_SUSPENDED");
      expect(body.reason).toBe("Phishing links");
      expect(await sessionCount()).toBe(before);
      await users().updateOne(
        { _id: userId },
        { $set: { banExpires: new Date(Date.now() + 3_600_000) } },
      );
      expect((await signIn()).status).toBe(403);
      await users().updateOne(
        { _id: userId },
        { $set: { banExpires: new Date(Date.now() - 1000) } },
      );
      expect((await signIn()).status).toBe(200);
    } finally {
      await users().updateOne(
        { _id: userId },
        { $unset: { banned: "", banReason: "", banExpires: "" } },
      );
    }
  });

  test("scheduled deletion blocks sign-in like a ban", async () => {
    await users().updateOne(
      { _id: userId },
      {
        $set: {
          deletion: {
            requestedAt: new Date(),
            by: "staff",
            purgeAfter: new Date(Date.now() + 7 * 86_400_000),
            state: "scheduled",
          },
        },
      },
    );
    try {
      const response = await signIn();
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("ACCOUNT_SUSPENDED");
    } finally {
      await users().updateOne({ _id: userId }, { $unset: { deletion: "" } });
    }
  });

  test("handoff and impersonation handoff refuse a banned user with a login redirect", async () => {
    await users().updateOne({ _id: userId }, { $set: { banned: true } });
    try {
      for (const impersonatedBy of [undefined, "staff-user"]) {
        const token = crypto.randomUUID().replaceAll("-", "");
        await db
          .collection<{
            _id: string;
            userId: string;
            impersonatedBy?: string;
            expiresAt: Date;
          }>(physicalNames.handoff_tokens)
          .insertOne({
            _id: hashHandoffToken(token),
            userId: String(userId),
            ...(impersonatedBy ? { impersonatedBy } : {}),
            expiresAt: new Date(Date.now() + 60_000),
          });
        const before = await sessionCount();
        const response = await request(`/handoff?t=${token}&next=/w`);
        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toBe(
          "/login?error=ACCOUNT_SUSPENDED",
        );
        expect(await sessionCount()).toBe(before);
      }
    } finally {
      await users().updateOne({ _id: userId }, { $unset: { banned: "" } });
    }
  });

  test("a completed sign-in is recorded once, with hashed user agent", async () => {
    const events = db.collection(physicalNames.sign_in_events);
    await events.deleteMany({});
    expect((await signIn()).status).toBe(200);
    const recorded = await events.find({ userId: String(userId) }).toArray();
    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.method).toBe("/sign-in/email");
    expect(recorded[0]?.ip).toMatch(/^198\.51\.100\./);
    expect(recorded[0]?.uaHash).toHaveLength(64);
  });

  test("a password sign-in awaiting TOTP isn't recorded until the second factor", async () => {
    const events = db.collection(physicalNames.sign_in_events);
    await events.deleteMany({});
    await users().updateOne(
      { _id: userId },
      { $set: { twoFactorEnabled: true } },
    );
    try {
      const response = await signIn();
      expect(response.status).toBe(200);
      expect((await response.json()).twoFactorRedirect).toBe(true);
      expect(await events.countDocuments({})).toBe(0);
    } finally {
      await users().updateOne(
        { _id: userId },
        { $unset: { twoFactorEnabled: "" } },
      );
    }
  });
});
