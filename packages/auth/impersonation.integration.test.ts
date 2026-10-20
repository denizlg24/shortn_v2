import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ObjectId, type Db } from "mongodb";
import { closeMongoClient, getDb, physicalNames } from "@shortn/db";
import { createAuth, hashHandoffToken } from "./index";
import { impersonationRestricted } from "./impersonation";
import fixture from "./fixtures/better-auth-1.4.18.json";

const mongo = process.env.MONGO_TEST_URL;

test("account-security paths are restricted for impersonated sessions", () => {
  for (const path of [
    "/change-password",
    "/change-email",
    "/set-password",
    "/delete-user",
    "/revoke-other-sessions",
    "/two-factor/enable",
    "/passkey/generate-register-options",
    "/sso/register",
    "/oauth2/consent",
    "/oauth2/authorize",
    "/oauth2/continue",
    "/oauth2/update-consent",
    "/oauth2/delete-consent",
    "/mcp/select-workspace",
    "/api-key/create",
    "/customer/portal",
    "/customer/state",
    "/customer/orders/list",
    "/customer/subscriptions/list",
  ])
    expect(impersonationRestricted(path)).toBe(true);
  for (const path of ["/get-session", "/update-user", "/sign-out"])
    expect(impersonationRestricted(path)).toBe(false);
});

(mongo ? describe : describe.skip)("impersonation handoff and policy", () => {
  let db: Db, auth: ReturnType<typeof createAuth>;
  const userId = new ObjectId(fixture.user.id);
  const adminId = new ObjectId().toHexString();
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
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
  const handoff = async (mode?: "read" | "write") => {
    const token = crypto.randomUUID().replaceAll("-", "");
    await db
      .collection<{
        _id: string;
        userId: string;
        impersonatedBy: string;
        impersonationMode?: "read" | "write";
        expiresAt: Date;
      }>(physicalNames.handoff_tokens)
      .insertOne({
        _id: hashHandoffToken(token),
        userId: String(userId),
        impersonatedBy: adminId,
        ...(mode ? { impersonationMode: mode } : {}),
        expiresAt: new Date(Date.now() + 60_000),
      });
    return request(`/handoff?t=${token}&next=/w`);
  };

  beforeAll(async () => {
    if (!["localhost", "127.0.0.1"].includes(new URL(mongo!).hostname))
      throw new Error("Loopback Mongo required");
    const config = {
      url: mongo!,
      database: `shortn_impersonation_${crypto.randomUUID().replaceAll("-", "")}`,
    };
    db = await getDb(config);
    auth = createAuth({
      baseURL: fixture.origin,
      secret: fixture.secret,
      production: false,
      mongo: config,
      mcp: { resource: `${fixture.origin}/mcp` },
      polar: { accessToken: "synthetic-unused-token", server: "sandbox" },
      emails: {
        verifyEmail: async () => {},
        emailVerified: async () => {},
        resetPassword: async () => {},
        confirmEmailChange: async () => {},
      },
    });
    const now = new Date();
    await db.collection(physicalNames.user).insertOne({
      _id: userId,
      name: fixture.user.name,
      email: fixture.user.email,
      emailVerified: true,
      twoFactorEnabled: true,
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

  test("a token without a mode opens a read-only session; write is explicit", async () => {
    const read = await handoff();
    expect(read.status).toBe(302);
    expect(read.headers.get("location")).toBe("/w");
    const session = await (
      await request("/get-session", undefined, cookies(read))
    ).json();
    expect(session.session.impersonatedBy).toBe(adminId);
    expect(session.session.impersonationMode).toBe("read");
    const write = await handoff("write");
    const writeSession = await (
      await request("/get-session", undefined, cookies(write))
    ).json();
    expect(writeSession.session.impersonationMode).toBe("write");
  });

  test("neither mode can touch credentials, email, sessions or 2FA", async () => {
    for (const mode of ["read", "write"] as const) {
      const cookie = cookies(await handoff(mode));
      for (const [path, body] of [
        [
          "/change-password",
          { currentPassword: fixture.password, newPassword: "x".repeat(16) },
        ],
        ["/change-email", { newEmail: "staff@example.com" }],
        ["/revoke-other-sessions", {}],
        ["/two-factor/disable", { password: fixture.password }],
        ["/delete-user", {}],
      ] as const) {
        const response = await request(path, body, cookie);
        expect(response.status).toBe(403);
        // The two-factor policy refuses impersonation before this plugin.
        if (!path.startsWith("/two-factor/"))
          expect((await response.json()).code).toBe("IMPERSONATION_FORBIDDEN");
      }
    }
    const user = await db
      .collection(physicalNames.user)
      .findOne({ _id: userId });
    expect(user?.email).toBe(fixture.user.email);
    expect(user?.twoFactorEnabled).toBe(true);
  });

  test("neither mode can authorize an OAuth or MCP grant, even one consented before", async () => {
    for (const mode of ["read", "write"] as const) {
      const cookie = cookies(await handoff(mode));
      const authorize = await request(
        `/oauth2/authorize?${new URLSearchParams({
          response_type: "code",
          client_id: "any-client",
          redirect_uri: "http://127.0.0.1:9/callback",
          scope: "links:read",
          code_challenge: "x".repeat(43),
          code_challenge_method: "S256",
          resource: `${fixture.origin}/mcp`,
        })}`,
        undefined,
        cookie,
      );
      expect(authorize.status).toBe(403);
      expect((await authorize.json()).code).toBe("IMPERSONATION_FORBIDDEN");
      const select = await request(
        "/mcp/select-workspace",
        { workspaceId: new ObjectId().toHexString() },
        cookie,
      );
      expect(select.status).toBe(403);
      expect((await select.json()).code).toBe("IMPERSONATION_FORBIDDEN");
    }
  });

  test("neither mode reaches the billing customer portal", async () => {
    for (const mode of ["read", "write"] as const) {
      const cookie = cookies(await handoff(mode));
      for (const path of [
        "/customer/portal",
        "/customer/state",
        "/customer/orders/list",
        "/customer/subscriptions/list",
      ]) {
        const response = await request(path, undefined, cookie);
        expect(response.status).toBe(403);
        expect((await response.json()).code).toBe("IMPERSONATION_FORBIDDEN");
      }
    }
  });

  test("staff accounts can't be impersonated", async () => {
    await db
      .collection(physicalNames.user)
      .updateOne({ _id: userId }, { $set: { role: "admin" } });
    try {
      const before = await db
        .collection(physicalNames.session)
        .countDocuments({});
      const response = await handoff("write");
      expect(response.headers.get("location")).toBe("/login");
      expect(
        await db.collection(physicalNames.session).countDocuments({}),
      ).toBe(before);
    } finally {
      await db
        .collection(physicalNames.user)
        .updateOne({ _id: userId }, { $unset: { role: "" } });
    }
  });
});
