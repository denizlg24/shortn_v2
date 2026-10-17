import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ObjectId, type Db } from "mongodb";
import { closeMongoClient, getDb, physicalNames } from "@shortn/db";
import { createAuth } from "./index";
import fixture from "./fixtures/better-auth-1.4.18.json";

const mongo = process.env.MONGO_TEST_URL;
(mongo ? describe : describe.skip)(
  "Better Auth 1.4.18 shared identity compatibility",
  () => {
    let db: Db, auth: ReturnType<typeof createAuth>;
    const request = (
      path: string,
      body?: Record<string, unknown>,
      cookie = fixture.cookie,
    ) =>
      auth.handler(
        new Request(`${fixture.origin}/api/auth${path}`, {
          method: body ? "POST" : "GET",
          headers: {
            Origin: fixture.origin,
            Cookie: cookie,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        }),
      );
    beforeAll(async () => {
      if (!["localhost", "127.0.0.1"].includes(new URL(mongo!).hostname))
        throw new Error("Loopback Mongo required");
      const config = {
        url: mongo!,
        database: `shortn_auth_compat_${crypto.randomUUID().replaceAll("-", "")}`,
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
      for (const [model, record] of Object.entries({
        user: fixture.user,
        account: fixture.account,
        session: fixture.session,
      })) {
        const { id, ...fields } = record;
        const row: Record<string, unknown> = {
          ...fields,
          _id: new ObjectId(id),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        if ("userId" in row) row.userId = new ObjectId(String(row.userId));
        if (model === "session") row.expiresAt = new Date(Date.now() + 3600000);
        if (model === "user") {
          row.emailVerified = true;
          row.sub = "legacy|compatibility";
        }
        await db
          .collection(physicalNames[model as "user" | "account" | "session"])
          .insertOne(row);
      }
    });
    afterAll(async () => {
      await db?.dropDatabase();
      await closeMongoClient();
    });

    test("old signed session cookie resolves the same shared user", async () => {
      const response = await request("/get-session");
      expect(response.status).toBe(200);
      const session = await response.json();
      expect(session.user.id).toBe(fixture.user.id);
      expect(session.user.sub).toBe("legacy|compatibility");
      expect(session.session.id).toBe(fixture.session.id);
    });

    test("Mongo revocation immediately invalidates the old cookie", async () => {
      await db
        .collection(physicalNames.session)
        .deleteOne({ _id: new ObjectId(fixture.session.id) });
      expect(await (await request("/get-session")).json()).toBeNull();
    });

    test("old scrypt password hash signs into the same user with the shared cookie prefix", async () => {
      const response = await request(
        "/sign-in/email",
        { email: fixture.user.email, password: fixture.password },
        "",
      );
      expect(response.status).toBe(200);
      expect((await response.json()).user.id).toBe(fixture.user.id);
      expect(
        response.headers
          .getSetCookie()
          .some((cookie) => cookie.startsWith("shortn_auth_.session_token=")),
      ).toBe(true);
      expect(
        (
          await request(
            "/sign-in/email",
            { email: fixture.user.email, password: "synthetic-wrong-password" },
            "",
          )
        ).status,
      ).toBe(401);
    });
  },
);
