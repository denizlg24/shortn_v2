import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ObjectId, type Db } from "mongodb";
import { closeMongoClient, getDb, physicalNames } from "@shortn/db";
import { createAuth } from "./index";
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
});
