import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { consumeAdminElevation, hashElevationSecret } from "@shortn/core";
import { closeMongoClient, getDb, physicalNames } from "@shortn/db";
import { symmetricEncrypt } from "better-auth/crypto";
import { ObjectId, type Db } from "mongodb";
import { createHmac, randomBytes } from "node:crypto";
import { createAuth, hashHandoffToken } from "./index";
import fixture from "./fixtures/better-auth-1.4.18.json";

const mongo = process.env.MONGO_TEST_URL;
const adminOrigin = "https://admin.shortn.test";

// One TOTP step per call, so codes never collide with the replay guard.
const totp = (secret: string, step: number) => {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", secret).update(counter).digest(),
    offset = digest[digest.length - 1]! & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
};

(mongo ? describe : describe.skip)("admin elevation", () => {
  let db: Db, auth: ReturnType<typeof createAuth>, cookie: string;
  let ip = 1;
  const userId = new ObjectId(fixture.user.id);
  const secret = randomBytes(20).toString("hex");
  const nonce = randomBytes(32).toString("hex");
  const n = hashElevationSecret(nonce);
  const step = () => Math.floor(Date.now() / 30000);
  const users = () => db.collection(physicalNames.user);
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
          "x-forwarded-for": `203.0.113.${ip++}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
  const elevate = (code: string, session = cookie) =>
    request("/admin/elevate", { code, n, purpose: "login" }, session);

  beforeAll(async () => {
    if (!["localhost", "127.0.0.1"].includes(new URL(mongo!).hostname))
      throw new Error("Loopback Mongo required");
    const config = {
      url: mongo!,
      database: `shortn_admin_elevation_${crypto.randomUUID().replaceAll("-", "")}`,
    };
    db = await getDb(config);
    auth = createAuth({
      baseURL: fixture.origin,
      secret: fixture.secret,
      production: false,
      mongo: config,
      admin: { origin: adminOrigin },
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
    // Sign in before TOTP is on, so the session needs no second factor.
    cookie = cookies(
      await request(
        "/sign-in/email",
        { email: fixture.user.email, password: fixture.password },
        "",
      ),
    );
    await db.collection(physicalNames.two_factor).insertOne({
      _id: new ObjectId(),
      userId,
      secret: await symmetricEncrypt({ key: fixture.secret, data: secret }),
      backupCodes: "unused",
    });
  });
  afterAll(async () => {
    await db?.dropDatabase();
    await closeMongoClient();
  });

  test("only staff with TOTP may elevate", async () => {
    const notStaff = await elevate(totp(secret, step()));
    expect(notStaff.status).toBe(403);
    expect((await notStaff.json()).code).toBe("NOT_STAFF");
    await users().updateOne({ _id: userId }, { $set: { role: "admin" } });
    const noTotp = await elevate(totp(secret, step()));
    expect(noTotp.status).toBe(403);
    expect((await noTotp.json()).code).toBe("TOTP_REQUIRED");
    await users().updateOne(
      { _id: userId },
      { $set: { twoFactorEnabled: true } },
    );
    const wrong = await elevate("000000");
    expect([401, 403]).toContain(wrong.status);
  });

  test("a valid code returns a 60-second token bound to the nonce; the code can't be replayed", async () => {
    const code = totp(secret, step() - 1);
    const response = await elevate(code);
    expect(response.status).toBe(200);
    const url = new URL((await response.json()).url);
    expect(url.origin).toBe(adminOrigin);
    expect(url.pathname).toBe("/auth/callback");
    const token = url.searchParams.get("t")!;
    const row = await db
      .collection<{ _id: string; nonceHash: string; expiresAt: Date }>(
        physicalNames.admin_elevation_tokens,
      )
      .findOne({ _id: hashElevationSecret(token) });
    expect(row?.nonceHash).toBe(n);
    expect(row!.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(60_000);
    expect(row!.expiresAt.getTime() - Date.now()).toBeGreaterThan(50_000);
    const replay = await elevate(code);
    expect(replay.status).toBe(401);
    expect((await replay.json()).code).toBe("TOTP_ALREADY_USED");

    expect(await consumeAdminElevation(db, token, "wrong-nonce")).toBeNull();
    // A wrong nonce burns the token too.
    expect(await consumeAdminElevation(db, token, nonce)).toBeNull();
  });

  test("tokens are single-use and expire", async () => {
    const fresh = await elevate(totp(secret, step()));
    const token = new URL((await fresh.json()).url).searchParams.get("t")!;
    expect(await consumeAdminElevation(db, token, nonce)).toEqual({
      userId: String(userId),
      purpose: "login",
    });
    expect(await consumeAdminElevation(db, token, nonce)).toBeNull();
    const later = await elevate(totp(secret, step() + 1));
    const expiring = new URL((await later.json()).url).searchParams.get("t")!;
    expect(
      await consumeAdminElevation(
        db,
        expiring,
        nonce,
        new Date(Date.now() + 61_000),
      ),
    ).toBeNull();
  });

  test("an impersonated session can't elevate, even as staff", async () => {
    const token = crypto.randomUUID().replaceAll("-", "");
    await db
      .collection<{
        _id: string;
        userId: string;
        impersonatedBy: string;
        expiresAt: Date;
      }>(physicalNames.handoff_tokens)
      .insertOne({
        _id: hashHandoffToken(token),
        userId: String(userId),
        impersonatedBy: new ObjectId().toHexString(),
        expiresAt: new Date(Date.now() + 60_000),
      });
    // Staff can't be impersonated, so make the target a plain user first.
    await users().updateOne({ _id: userId }, { $unset: { role: "" } });
    const impersonated = cookies(
      await request(`/handoff?t=${token}`, undefined, ""),
    );
    await users().updateOne({ _id: userId }, { $set: { role: "admin" } });
    const response = await elevate(totp(secret, step() + 2), impersonated);
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("IMPERSONATION_FORBIDDEN");
  });

  test("staff may enrol TOTP without an advanced-auth workspace; others may not", async () => {
    await users().updateOne(
      { _id: userId },
      { $unset: { twoFactorEnabled: "", role: "" } },
    );
    await db.collection(physicalNames.two_factor).deleteMany({ userId });
    const refused = await request("/two-factor/enable", {
      password: fixture.password,
    });
    expect(refused.status).toBe(403);
    expect((await refused.json()).code).toBe("ADVANCED_AUTH_UNAVAILABLE");
    await users().updateOne({ _id: userId }, { $set: { role: "superadmin" } });
    const allowed = await request("/two-factor/enable", {
      password: fixture.password,
    });
    expect(allowed.status).toBe(200);
    expect((await allowed.json()).totpURI).toContain("otpauth://");
  });
});
