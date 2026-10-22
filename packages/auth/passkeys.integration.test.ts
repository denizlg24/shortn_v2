import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  sign,
} from "node:crypto";
import { isoCBOR } from "@simplewebauthn/server/helpers";
import { ObjectId, type Db } from "mongodb";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { collection, closeMongoClient, getDb, physicalNames } from "@shortn/db";
import { ensurePersonalWorkspace } from "@shortn/core";
import { createAuth } from "./index";
import { legacyPasswordGate } from "./legacy-password-gate";
import fixture from "./fixtures/better-auth-1.4.18.json";

const mongo = process.env.MONGO_TEST_URL;
(mongo ? describe : describe.skip)(
  "signed WebAuthn ceremonies and passkey authority",
  () => {
    let db: Db,
      auth: ReturnType<typeof createAuth>,
      cookie = "",
      credentialRow: ObjectId,
      passkeyCookie = "",
      workspaceId: ObjectId;
    const userId = new ObjectId(fixture.user.id),
      accountId = new ObjectId(fixture.account.id);
    const keys = generateKeyPairSync("ec", { namedCurve: "prime256v1" }),
      credential = randomBytes(32),
      id = credential.toString("base64url");
    const publicJwk = keys.publicKey.export({ format: "jwk" });
    const cose = isoCBOR.encode(
      new Map<number, number | Uint8Array>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, Buffer.from(publicJwk.x!, "base64url")],
        [-3, Buffer.from(publicJwk.y!, "base64url")],
      ]),
    );
    let ip = 1;
    const cookies = (response: Response) =>
      response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
    const request = (
      path: string,
      body?: Record<string, unknown>,
      session = cookie,
    ) =>
      auth.handler(
        new Request(`${fixture.origin}/api/auth${path}`, {
          method: body ? "POST" : "GET",
          headers: {
            Origin: fixture.origin,
            Cookie: session,
            "x-forwarded-for": `198.51.100.${ip++}`,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        }),
      );
    function clientData(
      type: string,
      challenge: string,
      origin = fixture.origin,
    ) {
      return Buffer.from(
        JSON.stringify({ type, challenge, origin, crossOrigin: false }),
      );
    }
    function registration(challenge: string, verified = true) {
      const data = clientData("webauthn.create", challenge),
        length = Buffer.alloc(2);
      length.writeUInt16BE(credential.length);
      const authData = Buffer.concat([
        createHash("sha256").update("localhost").digest(),
        Buffer.from([0x41 | (verified ? 4 : 0)]),
        Buffer.alloc(4),
        Buffer.alloc(16),
        length,
        credential,
        Buffer.from(cose),
      ]);
      const attestation = isoCBOR.encode(
        new Map<string, string | Uint8Array | Map<string, never>>([
          ["fmt", "none"],
          ["attStmt", new Map<string, never>()],
          ["authData", authData],
        ]),
      );
      return {
        id,
        rawId: id,
        type: "public-key",
        response: {
          clientDataJSON: data.toString("base64url"),
          attestationObject: Buffer.from(attestation).toString("base64url"),
          transports: ["internal"],
        },
        clientExtensionResults: {},
      };
    }
    function assertion(
      challenge: string,
      counter: number,
      verified = true,
      origin = fixture.origin,
      rp = "localhost",
    ) {
      const data = clientData("webauthn.get", challenge, origin),
        count = Buffer.alloc(4);
      count.writeUInt32BE(counter);
      const authData = Buffer.concat([
        createHash("sha256").update(rp).digest(),
        Buffer.from([1 | (verified ? 4 : 0)]),
        count,
      ]);
      const signature = sign(
        "sha256",
        Buffer.concat([authData, createHash("sha256").update(data).digest()]),
        keys.privateKey,
      );
      return {
        id,
        rawId: id,
        type: "public-key",
        response: {
          clientDataJSON: data.toString("base64url"),
          authenticatorData: authData.toString("base64url"),
          signature: signature.toString("base64url"),
          userHandle: null,
        },
        clientExtensionResults: {},
      };
    }
    async function challenge() {
      const response = await request(
        "/passkey/generate-authenticate-options",
        undefined,
        "",
      );
      expect(response.status).toBe(200);
      return { data: await response.json(), cookie: cookies(response) };
    }
    beforeAll(async () => {
      if (!["localhost", "127.0.0.1"].includes(new URL(mongo!).hostname))
        throw new Error("Loopback Mongo required");
      const config = {
        url: mongo!,
        database: `shortn_passkey_${crypto.randomUUID().replaceAll("-", "")}`,
      };
      db = await getDb(config);
      await db
        .collection(physicalNames.passkeys)
        .createIndex({ credentialID: 1 }, { unique: true });
      const now = new Date();
      await db.collection(physicalNames.user).insertOne({
        _id: userId,
        name: fixture.user.name,
        email: fixture.user.email,
        emailVerified: true,
        sub: "legacy|passkey",
        createdAt: now,
        updatedAt: now,
      });
      await db.collection(physicalNames.account).insertOne({
        _id: accountId,
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
      cookie = cookies(
        await request(
          "/sign-in/email",
          { email: fixture.user.email, password: fixture.password },
          "",
        ),
      );
    });
    afterAll(async () => {
      await db?.dropDatabase();
      await closeMongoClient();
    });

    test("registration is authenticated, gated and recent; authentication requests device verification", async () => {
      expect(
        (await request("/passkey/generate-register-options", undefined, ""))
          .status,
      ).toBe(401);
      expect((await request("/passkey/generate-register-options")).status).toBe(
        403,
      );
      expect((await challenge()).data.userVerification).toBe("required");
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
      expect((await request("/passkey/generate-register-options")).status).toBe(
        403,
      );
      await db
        .collection(physicalNames.session)
        .updateMany({ userId }, { $set: { createdAt: new Date() } });
      expect(
        (
          await request(
            `/passkey/generate-register-options?name=${"x".repeat(65)}`,
          )
        ).status,
      ).toBe(400);
    });
    test("signed registration requires user verification and stores only the public credential", async () => {
      const options = await request(
          "/passkey/generate-register-options?name=My%20device",
        ),
        data = await options.json();
      expect(data.rp.id).toBe("localhost");
      expect(data.authenticatorSelection.userVerification).toBe("required");
      expect(data.authenticatorSelection.residentKey).toBe("required");
      expect(
        (
          await request(
            "/passkey/verify-registration",
            {
              response: registration(data.challenge, false),
              name: "My device",
            },
            cookies(options) + "; " + cookie,
          )
        ).status,
      ).not.toBe(200);
      expect(await db.collection(physicalNames.passkeys).countDocuments()).toBe(
        0,
      );
      const next = await request(
        "/passkey/generate-register-options?name=My%20device",
      );
      const response = await request(
        "/passkey/verify-registration",
        {
          response: registration((await next.json()).challenge),
          name: "  My device  ",
        },
        cookies(next) + "; " + cookie,
      );
      expect(response.status).toBe(200);
      const row = (await db
        .collection(physicalNames.passkeys)
        .findOne({ credentialID: id }))!;
      credentialRow = row._id;
      expect(row.name).toBe("My device");
      expect(Buffer.from(row.publicKey, "base64")).toEqual(Buffer.from(cose));
      expect(row.privateKey).toBeUndefined();
    });
    test("valid signatures cannot bypass device verification, RP or origin binding", async () => {
      const originalCount = await db
        .collection(physicalNames.session)
        .countDocuments({ userId });
      for (const [verified, origin, rp] of [
        [false, fixture.origin, "localhost"],
        [true, "https://attacker.invalid", "localhost"],
        [true, fixture.origin, "attacker.invalid"],
      ] as const) {
        const c = await challenge(),
          response = await request(
            "/passkey/verify-authentication",
            { response: assertion(c.data.challenge, 1, verified, origin, rp) },
            c.cookie,
          );
        expect(response.status).not.toBe(200);
      }
      expect(
        await db.collection(physicalNames.session).countDocuments({ userId }),
      ).toBe(originalCount);
    });
    test("a valid assertion issues a credential-bound shared session; challenge replay fails", async () => {
      const c = await challenge(),
        signed = assertion(c.data.challenge, 1);
      const response = await request(
        "/passkey/verify-authentication",
        { response: signed },
        c.cookie,
      );
      expect(response.status).toBe(200);
      passkeyCookie = cookies(response);
      const session = await (
        await request("/get-session", undefined, passkeyCookie)
      ).json();
      expect(session.user.id).toBe(String(userId));
      expect(session.session.passkeyId).toBe(String(credentialRow));
      expect(
        (
          await request(
            "/passkey/verify-authentication",
            { response: signed },
            c.cookie,
          )
        ).status,
      ).not.toBe(200);
    });
    test("concurrent assertions cannot reuse a nonzero device counter", async () => {
      const [a, b] = await Promise.all([challenge(), challenge()]);
      const results = await Promise.all(
        [a, b].map((c) =>
          request(
            "/passkey/verify-authentication",
            { response: assertion(c.data.challenge, 2) },
            c.cookie,
          ),
        ),
      );
      expect(
        results.filter((response) => response.status === 200),
      ).toHaveLength(1);
      expect(
        (
          await db
            .collection(physicalNames.passkeys)
            .findOne({ _id: credentialRow })
        )?.lastVerifiedCounter,
      ).toBe(2);
    });
    test("a banned user's valid assertion opens no session; an expired ban does", async () => {
      const users = db.collection(physicalNames.user);
      const sessions = () =>
        db.collection(physicalNames.session).countDocuments({ userId });
      const before = await sessions();
      await users.updateOne({ _id: userId }, { $set: { banned: true } });
      try {
        const c = await challenge();
        const refused = await request(
          "/passkey/verify-authentication",
          { response: assertion(c.data.challenge, 10) },
          c.cookie,
        );
        // The plugin rethrows only its own @better-auth/core APIError class;
        // with two core copies installed it reports AUTHENTICATION_FAILED.
        expect([400, 403]).toContain(refused.status);
        expect(["ACCOUNT_SUSPENDED", "AUTHENTICATION_FAILED"]).toContain(
          (await refused.json()).code,
        );
        expect(refused.headers.getSetCookie().join()).not.toContain(
          "session_token=",
        );
        expect(await sessions()).toBe(before);
        await users.updateOne(
          { _id: userId },
          { $set: { banExpires: new Date(Date.now() - 1000) } },
        );
        const expired = await challenge();
        expect(
          (
            await request(
              "/passkey/verify-authentication",
              { response: assertion(expired.data.challenge, 11) },
              expired.cookie,
            )
          ).status,
        ).toBe(200);
      } finally {
        await users.updateOne(
          { _id: userId },
          { $unset: { banned: "", banExpires: "" } },
        );
        // Later tests continue the device counter from 2.
        await db
          .collection(physicalNames.passkeys)
          .updateOne(
            { _id: credentialRow },
            { $set: { counter: 2, lastVerifiedCounter: 2 } },
          );
      }
    });
    test("concurrent removals cannot delete every passwordless sign-in method", async () => {
      const accounts = await db
        .collection(physicalNames.account)
        .find({ userId })
        .toArray();
      const sessions = await db
        .collection(physicalNames.session)
        .find({ userId })
        .toArray();
      const primary = (await db
        .collection(physicalNames.passkeys)
        .findOne({ _id: credentialRow }))!;
      const keys = [new ObjectId(), new ObjectId()];
      await db.collection(physicalNames.account).deleteMany({ userId });
      await db
        .collection(physicalNames.passkeys)
        .deleteOne({ _id: credentialRow });
      await db.collection(physicalNames.passkeys).insertMany(
        keys.map((_id) => ({
          _id,
          userId,
          credentialID: String(_id),
          publicKey: "synthetic",
        })),
      );
      try {
        const responses = await Promise.all(
          keys.map((id) =>
            request("/passkey/delete-passkey", { id: String(id) }),
          ),
        );
        expect(
          responses.filter((response) => response.status === 200),
        ).toHaveLength(1);
        expect(
          await db
            .collection(physicalNames.passkeys)
            .countDocuments({ _id: { $in: keys } }),
        ).toBe(1);
        expect(
          (await db.collection(physicalNames.user).findOne({ _id: userId }))
            ?.passkeyRemoval,
        ).toBeUndefined();
      } finally {
        await db
          .collection(physicalNames.passkeys)
          .deleteMany({ _id: { $in: keys } });
        await db.collection(physicalNames.passkeys).insertOne(primary);
        await db.collection(physicalNames.account).insertMany(accounts);
        await db.collection(physicalNames.session).deleteMany({ userId });
        await db.collection(physicalNames.session).insertMany(sessions);
      }
    });
    test("removing a passkey requires ownership and preserves a usable sign-in method", async () => {
      const foreign = new ObjectId();
      await db.collection(physicalNames.passkeys).insertOne({
        _id: foreign,
        userId: new ObjectId(),
        credentialID: "synthetic-foreign-credential",
        publicKey: "synthetic",
      });
      expect(
        (await request("/passkey/delete-passkey", { id: String(foreign) }))
          .status,
      ).not.toBe(200);
      expect(
        await db
          .collection(physicalNames.passkeys)
          .countDocuments({ _id: foreign }),
      ).toBe(1);
      const account = (await db
        .collection(physicalNames.account)
        .findOne({ _id: accountId }))!;
      await db.collection(physicalNames.account).deleteOne({ _id: accountId });
      const refused = await request("/passkey/delete-passkey", {
        id: String(credentialRow),
      });
      expect(refused.status).toBe(403);
      expect((await refused.json()).code).toBe("LAST_SIGN_IN_METHOD");
      await db.collection(physicalNames.account).insertOne(account);
      await collection(db, "workspaces").updateOne(
        { _id: workspaceId },
        { $set: { "platformFeatures.advancedAuth": false } },
      );
      expect((await request("/passkey/generate-register-options")).status).toBe(
        403,
      );
      const existing = await challenge();
      expect(
        (
          await request(
            "/passkey/verify-authentication",
            { response: assertion(existing.data.challenge, 3) },
            existing.cookie,
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await request("/passkey/delete-passkey", {
            id: String(credentialRow),
          })
        ).status,
      ).toBe(200);
      expect(
        await db.collection(physicalNames.session).countDocuments({ userId }),
      ).toBe(0);
      expect(
        await (await request("/get-session", undefined, passkeyCookie)).json(),
      ).toBeNull();
      const c = await challenge();
      expect(
        (
          await request(
            "/passkey/verify-authentication",
            { response: assertion(c.data.challenge, 3) },
            c.cookie,
          )
        ).status,
      ).toBe(401);
    });
    test("a session racing credential revocation is rejected by the new and legacy handlers", async () => {
      const seed = async () =>
        db.collection(physicalNames.session).insertOne({
          _id: new ObjectId(fixture.session.id),
          userId,
          token: fixture.session.token,
          passkeyId: String(credentialRow),
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: new Date(Date.now() + 60000),
        });
      await seed();
      expect(
        await (await request("/get-session", undefined, fixture.cookie)).json(),
      ).toBeNull();
      await seed();
      const legacy = betterAuth({
        baseURL: fixture.origin,
        secret: fixture.secret,
        database: mongodbAdapter(db),
        advanced: { cookiePrefix: "shortn_auth_", useSecureCookies: false },
        plugins: [
          legacyPasswordGate(
            async () => false,
            async (keyId, owner) =>
              Boolean(
                await db.collection(physicalNames.passkeys).findOne({
                  _id: new ObjectId(keyId),
                  userId: new ObjectId(owner),
                }),
              ),
          ),
        ],
      });
      expect(
        await (
          await legacy.handler(
            new Request(`${fixture.origin}/api/auth/get-session`, {
              headers: { Origin: fixture.origin, Cookie: fixture.cookie },
            }),
          )
        ).json(),
      ).toBeNull();
    });
  },
);
