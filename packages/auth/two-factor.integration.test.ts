import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ObjectId, type Db } from "mongodb";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { symmetricDecrypt } from "better-auth/crypto";
import { collection, closeMongoClient, getDb, physicalNames } from "@shortn/db";
import { ensurePersonalWorkspace } from "@shortn/core";
import { createAuth, hashHandoffToken } from "./index";
import { legacyPasswordGate } from "./legacy-password-gate";
import fixture from "./fixtures/better-auth-1.4.18.json";
import { createHmac } from "node:crypto";

const mongo = process.env.MONGO_TEST_URL;
(mongo ? describe : describe.skip)(
  "TOTP account security and coexistence",
  () => {
    let db: Db,
      auth: ReturnType<typeof createAuth>,
      legacy: { handler: (request: Request) => Promise<Response> };
    let workspaceId: ObjectId,
      cookie = "",
      setupCode = "",
      backups: string[] = [];
    let ip = 1;
    const userId = new ObjectId(fixture.user.id),
      password = fixture.password;
    const cookies = (response: Response) =>
      response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
    const request = (
      path: string,
      body?: Record<string, unknown>,
      session = cookie,
      handler = auth.handler,
    ) =>
      handler(
        new Request(`${fixture.origin}/api/auth${path}`, {
          method: body ? "POST" : "GET",
          headers: {
            Origin: fixture.origin,
            Cookie: session,
            "x-forwarded-for": `192.0.2.${ip++}`,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        }),
      );
    const signIn = () =>
      request("/sign-in/email", { email: fixture.user.email, password }, "");
    beforeAll(async () => {
      if (!["localhost", "127.0.0.1"].includes(new URL(mongo!).hostname))
        throw new Error("Loopback Mongo required");
      const config = {
        url: mongo!,
        database: `shortn_two_factor_${crypto.randomUUID().replaceAll("-", "")}`,
      };
      db = await getDb(config);
      await db
        .collection(physicalNames.two_factor)
        .createIndex({ userId: 1 }, { unique: true });
      const now = new Date();
      await db
        .collection(physicalNames.user)
        .insertOne({
          _id: userId,
          name: fixture.user.name,
          email: fixture.user.email,
          emailVerified: true,
          sub: "legacy|totp",
          createdAt: now,
          updatedAt: now,
        });
      await db
        .collection(physicalNames.account)
        .insertOne({
          _id: new ObjectId(),
          userId,
          accountId: String(userId),
          providerId: "credential",
          password: fixture.account.password,
          createdAt: now,
          updatedAt: now,
        });
      workspaceId = (
        await ensurePersonalWorkspace(db, {
          id: String(userId),
          name: fixture.user.name,
        })
      )._id;
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
      // A separate handler models legacy's shared collections and password gate.
      legacy = betterAuth({
        baseURL: fixture.origin,
        secret: fixture.secret,
        database: mongodbAdapter(db),
        emailAndPassword: { enabled: true },
        advanced: { cookiePrefix: "shortn_auth_", useSecureCookies: false },
        plugins: [
          legacyPasswordGate(async (id) =>
            Boolean(
              (
                await db
                  .collection(physicalNames.user)
                  .findOne({ _id: new ObjectId(id) })
              )?.twoFactorEnabled,
            ),
          ),
        ],
      });
      cookie = cookies(await signIn());
    });
    afterAll(async () => {
      await db?.dropDatabase();
      await closeMongoClient();
    });

    test("enrollment requires current flagged membership and recent verified password session", async () => {
      expect((await request("/two-factor/enable", { password })).status).toBe(
        403,
      );
      expect(
        await db.collection(physicalNames.two_factor).countDocuments(),
      ).toBe(0);
      await collection(db, "workspaces").updateOne(
        { _id: workspaceId },
        { $set: { "platformFeatures.advancedAuth": true } },
      );
      await db
        .collection(physicalNames.session)
        .updateMany(
          { userId },
          { $set: { createdAt: new Date(Date.now() - 301000) } },
        );
      expect((await request("/two-factor/enable", { password })).status).toBe(
        403,
      );
      await db
        .collection(physicalNames.session)
        .updateMany({ userId }, { $set: { createdAt: new Date() } });
      expect(
        (
          await request("/two-factor/enable", {
            password: "synthetic-wrong-password",
          })
        ).status,
      ).toBe(400);
    });

    test("setup stays pending until TOTP proof, encrypts secrets and revokes prior sessions and handoffs", async () => {
      const setup = await request("/two-factor/enable", { password });
      expect(setup.status).toBe(200);
      const body = await setup.json();
      backups = body.backupCodes;
      expect(backups).toHaveLength(10);
      expect(new URL(body.totpURI).searchParams.get("issuer")).toBe("Shortn");
      expect(
        (await db.collection(physicalNames.user).findOne({ _id: userId }))
          ?.twoFactorEnabled,
      ).toBeFalsy();
      const factor = (await db
        .collection(physicalNames.two_factor)
        .findOne({ userId }))!;
      expect(factor.verified).toBe(false);
      expect(factor.backupCodes.includes(backups[0])).toBe(false);
      const secret = await symmetricDecrypt({
        key: fixture.secret,
        data: factor.secret,
      });
      expect(factor.secret).not.toBe(secret);
      setupCode = (await auth.api.generateTOTP({ body: { secret } })).code;
      await db
        .collection(physicalNames.session)
        .insertOne({
          userId,
          token: "synthetic-peer-session",
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: new Date(Date.now() + 3600000),
        });
      await db
        .collection<{ _id: string; userId: string; expiresAt: Date }>(
          physicalNames.handoff_tokens,
        )
        .insertOne({
          _id: hashHandoffToken("synthetic-prior-handoff"),
          userId: String(userId),
          expiresAt: new Date(Date.now() + 60000),
        });
      const verified = await request("/two-factor/verify-totp", {
        code: setupCode,
      });
      expect(verified.status).toBe(200);
      cookie = cookies(verified);
      expect(
        (await (await request("/get-session")).json()).user.twoFactorEnabled,
      ).toBe(true);
      expect(
        await db.collection(physicalNames.session).countDocuments({ userId }),
      ).toBe(1);
      expect(
        await db
          .collection(physicalNames.handoff_tokens)
          .countDocuments({ userId: String(userId) }),
      ).toBe(0);
      expect(
        (await request("/two-factor/get-totp-uri", { password })).status,
      ).toBe(403);
    });

    test("flag removal cannot bypass password challenges; TOTP and backup codes reject replay", async () => {
      await collection(db, "workspaces").updateOne(
        { _id: workspaceId },
        { $set: { "platformFeatures.advancedAuth": false } },
      );
      const primary = await signIn();
      expect((await primary.json()).twoFactorRedirect).toBe(true);
      const challenge = cookies(primary);
      expect(
        await (await request("/get-session", undefined, challenge)).json(),
      ).toBeNull();
      const replay = await request(
        "/two-factor/verify-totp",
        { code: setupCode },
        challenge,
      );
      expect(replay.status).toBe(401);
      expect((await replay.json()).code).toBe("TOTP_ALREADY_USED");
      expect(
        (
          await request(
            "/two-factor/verify-backup-code",
            { code: backups[0], trustDevice: true },
            challenge,
          )
        ).status,
      ).toBe(400);
      const recovered = await request(
        "/two-factor/verify-backup-code",
        { code: backups[0] },
        challenge,
      );
      expect(recovered.status).toBe(200);
      cookie = cookies(recovered);
      const nextChallenge = cookies(await signIn());
      expect(
        (
          await request(
            "/two-factor/verify-backup-code",
            { code: backups[0] },
            nextChallenge,
          )
        ).status,
      ).toBe(401);
    });

    test("one backup code cannot authenticate two concurrent challenges", async () => {
      const a = cookies(await signIn()),
        b = cookies(await signIn());
      const results = await Promise.all(
        [a, b].map((challenge) =>
          request(
            "/two-factor/verify-backup-code",
            { code: backups[1] },
            challenge,
          ),
        ),
      );
      expect(results.filter((result) => result.status === 200)).toHaveLength(1);
      expect(results.filter((result) => result.status !== 200)).toHaveLength(1);
    });
    test("one fresh TOTP step cannot authenticate two concurrent challenges", async () => {
      const factor = (await db
        .collection(physicalNames.two_factor)
        .findOne({ userId }))!;
      const secret = await symmetricDecrypt({
        key: fixture.secret,
        data: factor.secret,
      });
      // Authenticator clocks may be one step ahead; use that valid unused step.
      const counter = Buffer.alloc(8);
      counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + 1));
      const digest = createHmac("sha1", secret).update(counter).digest(),
        offset = digest[digest.length - 1]! & 15;
      const code = ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000)
        .toString()
        .padStart(6, "0");
      const a = cookies(await signIn()),
        b = cookies(await signIn());
      const results = await Promise.all(
        [a, b].map((challenge) =>
          request("/two-factor/verify-totp", { code }, challenge),
        ),
      );
      expect(results.filter((result) => result.status === 200)).toHaveLength(1);
      expect(results.filter((result) => result.status === 401)).toHaveLength(1);
    });

    test("legacy password handler deletes the tentative session and directs protected users to the new app", async () => {
      const before = await db
        .collection(physicalNames.session)
        .countDocuments({ userId });
      const response = await request(
        "/sign-in/email",
        { email: fixture.user.email, password },
        "",
        legacy.handler,
      );
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("TWO_FACTOR_NEW_APP_REQUIRED");
      expect(
        await db.collection(physicalNames.session).countDocuments({ userId }),
      ).toBe(before);
      expect(
        await (
          await request("/get-session", undefined, cookies(response))
        ).json(),
      ).toBeNull();
    });

    test("handoff proves the primary identity and requires recovery proof before creating a session", async () => {
      const token = "synthetic-protected-user-handoff",
        before = await db
          .collection(physicalNames.session)
          .countDocuments({ userId });
      await db
        .collection<{ _id: string; userId: string; expiresAt: Date }>(
          physicalNames.handoff_tokens,
        )
        .insertOne({
          _id: hashHandoffToken(token),
          userId: String(userId),
          expiresAt: new Date(Date.now() + 60000),
        });
      const response = await request(
        `/handoff?t=${token}&next=%2F%3Fto%3Dlinks`,
        undefined,
        "",
      );
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe(
        "/login/two-factor?next=%2F%3Fto%3Dlinks",
      );
      expect(
        await db.collection(physicalNames.session).countDocuments({ userId }),
      ).toBe(before);
      const challenge = cookies(response);
      expect(
        (
          await request(
            "/two-factor/verify-backup-code",
            { code: backups[2] },
            challenge,
          )
        ).status,
      ).toBe(200);
      expect(
        await db.collection(physicalNames.session).countDocuments({ userId }),
      ).toBe(before + 1);
      expect(
        (await request(`/handoff?t=${token}`, undefined, "")).headers.get(
          "Location",
        ),
      ).toMatch(/^\/login\?/);
    });

    test("expired challenges cannot authenticate and disabling requires a fresh password session", async () => {
      const primary = cookies(await signIn());
      await db
        .collection(physicalNames.verification)
        .updateMany(
          { identifier: /^2fa-/ },
          { $set: { expiresAt: new Date(0) } },
        );
      expect(
        (
          await request(
            "/two-factor/verify-backup-code",
            { code: backups[3] },
            primary,
          )
        ).status,
      ).toBe(401);
      const sessions = db.collection(physicalNames.session);
      const existing = await sessions.find({ userId }).toArray();
      await sessions.updateMany(
        { userId },
        { $set: { createdAt: new Date(Date.now() - 301000) } },
      );
      expect((await request("/two-factor/disable", { password })).status).toBe(
        403,
      );
      for (const session of existing)
        await sessions.updateOne(
          { _id: session._id },
          { $set: { createdAt: session.createdAt } },
        );
      const disabled = await request("/two-factor/disable", { password });
      expect(disabled.status).toBe(200);
      cookie = cookies(disabled);
      expect(
        await db.collection(physicalNames.two_factor).countDocuments(),
      ).toBe(0);
      expect((await (await signIn()).json()).twoFactorRedirect).toBeUndefined();
    });
  },
);
