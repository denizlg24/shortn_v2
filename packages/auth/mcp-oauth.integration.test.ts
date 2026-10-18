import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { ObjectId, type Db } from "mongodb";
import { createRemoteJWKSet, customFetch } from "jose";
import { hashPassword, symmetricDecrypt } from "better-auth/crypto";
import {
  getDb,
  closeMongoClient,
  collection,
  physicalNames,
  syncIndexes,
  legacyCollectionKeys,
} from "@shortn/db";
import { authenticateMcpOAuth, ensurePersonalWorkspace } from "@shortn/core";
import { createAuth, mcpOAuthRequest } from "./index";
import { backfillMcpResourceLinks } from "./mcp-resource-migration";

const mongo = process.env.MONGO_TEST_URL,
  origin = "http://localhost:3400",
  resource = "http://localhost:3403/mcp";
(mongo ? describe : describe.skip)(
  "MCP OAuth provider and live workspace grants",
  () => {
    let db: Db,
      auth: ReturnType<typeof createAuth>,
      cookie: string,
      userId: ObjectId,
      workspaceId: ObjectId;
    let clientId: string;
    const redirect = "http://127.0.0.1:43210/callback",
      verifier = "synthetic-pkce-verifier-".repeat(3);
    const issuer = `${origin}/api/auth`;
    const request = (
      path: string,
      body?: Record<string, unknown>,
      extra: Record<string, string> = {},
    ) =>
      auth.handler(
        new Request(`${issuer}${path}`, {
          method: body ? "POST" : "GET",
          headers: {
            ...(cookie ? { Cookie: cookie } : {}),
            Origin: origin,
            ...(body
              ? {
                  "Content-Type":
                    path === "/oauth2/token"
                      ? "application/x-www-form-urlencoded"
                      : "application/json",
                }
              : {}),
            ...extra,
          },
          ...(body
            ? {
                body:
                  path === "/oauth2/token"
                    ? new URLSearchParams(
                        Object.entries(body).map(([key, value]) => [
                          key,
                          String(value),
                        ]),
                      ).toString()
                    : JSON.stringify(body),
              }
            : {}),
        }),
      );
    const location = async (response: Response) => {
      const header = response.headers.get("Location");
      if (header) return new URL(header, origin);
      const body = await response.json();
      if (!body.url && !body.uri)
        throw new Error(`OAuth redirect missing (${response.status})`);
      return new URL(body.url ?? body.uri, origin);
    };
    const authorize = async (scope = "links:read offline_access") => {
      await db
        .collection(physicalNames.session)
        .updateOne({ userId }, { $unset: { mcpWorkspaceId: "" } });
      const query = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirect,
        scope,
        state: "synthetic-client-state",
        prompt: "consent",
        resource,
        code_challenge_method: "S256",
        code_challenge: createHash("sha256")
          .update(verifier)
          .digest("base64url"),
      });
      const selected = await location(
        await request(`/oauth2/authorize?${query}`),
      );
      expect(selected.pathname).toBe("/auth/mcp/workspace");
      const preview = await mcpOAuthRequest(
        db,
        selected.searchParams.toString(),
        "synthetic-oauth-auth-secret-".repeat(3),
      );
      expect(preview?.clientId).toBe(clientId);
      expect(
        await mcpOAuthRequest(
          db,
          selected.searchParams.toString() + "&scope=links:write",
          "synthetic-oauth-auth-secret-".repeat(3),
        ),
      ).toBeNull();
      expect(
        await mcpOAuthRequest(
          db,
          selected.searchParams.toString(),
          "wrong-secret",
        ),
      ).toBeNull();
      expect(
        await mcpOAuthRequest(
          db,
          selected.searchParams.toString(),
          "synthetic-oauth-auth-secret-".repeat(3),
          new Date(Date.now() + 301000),
        ),
      ).toBeNull();

      expect(
        (
          await request("/mcp/select-workspace", {
            workspaceId: workspaceId.toHexString(),
          })
        ).status,
      ).toBe(200);
      const continued = await location(
        await request("/oauth2/continue", {
          postLogin: true,
          oauth_query: selected.searchParams.toString(),
        }),
      );
      expect(continued.pathname).toBe("/auth/mcp/consent");
      return continued;
    };
    const approve = async () => {
      const consent = await authorize();
      return location(
        await request(
          "/oauth2/consent",
          { accept: true, oauth_query: consent.searchParams.toString() },
          { "x-shortn-workspace": workspaceId.toHexString() },
        ),
      );
    };
    const exchange = (code: string, override: Record<string, unknown> = {}) =>
      request(
        "/oauth2/token",
        {
          grant_type: "authorization_code",
          client_id: clientId,
          code,
          code_verifier: verifier,
          redirect_uri: redirect,
          resource,
          ...override,
        },
        { Cookie: "" },
      );
    beforeAll(async () => {
      if (!["localhost", "127.0.0.1"].includes(new URL(mongo!).hostname))
        throw new Error("Loopback Mongo required");
      const database = `shortn_oauth_${crypto.randomUUID().replaceAll("-", "")}`;
      db = await getDb({ url: mongo!, database });
      for (const key of legacyCollectionKeys)
        await db.createCollection(physicalNames[key]);
      await syncIndexes(db, { log: () => {} });
      auth = createAuth({
        baseURL: origin,
        secret: "synthetic-oauth-auth-secret-".repeat(3),
        production: false,
        mongo: { url: mongo!, database },
        polar: { accessToken: "synthetic-unused-token", server: "sandbox" },
        emails: {
          verifyEmail: async () => {},
          emailVerified: async () => {},
          resetPassword: async () => {},
          confirmEmailChange: async () => {},
        },
        mcp: { resource },
      });
      userId = new ObjectId();
      const now = new Date();
      await db.collection(physicalNames.user).insertOne({
        _id: userId,
        email: "oauth@example.invalid",
        name: "OAuth fixture",
        username: "oauthfixture",
        displayUsername: "oauthfixture",
        emailVerified: true,
        sub: `oauth|${userId}`,
        createdAt: now,
        updatedAt: now,
      });
      await db.collection(physicalNames.account).insertOne({
        userId,
        providerId: "credential",
        accountId: String(userId),
        password: await hashPassword("synthetic-oauth-password"),
        createdAt: now,
        updatedAt: now,
      });
      const workspace = await ensurePersonalWorkspace(db, {
        id: String(userId),
        name: "OAuth fixture",
      });
      workspaceId = workspace._id;
      await collection(db, "workspaces").updateOne(
        { _id: workspaceId },
        { $set: { platformFeatures: { mcp: true } } },
      );
      const signedIn = await request("/sign-in/email", {
        email: "oauth@example.invalid",
        password: "synthetic-oauth-password",
      });
      expect(signedIn.status).toBe(200);
      cookie = signedIn.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      expect(Boolean(cookie)).toBe(true);
      const registration = await request(
        "/oauth2/register",
        {
          client_name: "Synthetic MCP client",
          application_type: "native",
          redirect_uris: [redirect],
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          token_endpoint_auth_method: "none",
        },
        { Cookie: "" },
      );
      expect(registration.status).toBe(201);
      const registered = await registration.json();
      clientId = registered.client_id;
      expect(typeof clientId).toBe("string");
      // Creates every legacy collection and syncs every index before the
      // registration round trip; bun's 5 s hook default is too tight on CI.
    }, 60_000);
    afterAll(async () => {
      await db?.dropDatabase();
      await closeMongoClient();
    });
    test("public client registration cannot skip consent or disable PKCE", async () => {
      const metadata = {
        client_name: "Self asserted client",
        application_type: "native",
        redirect_uris: [redirect],
        grant_types: ["authorization_code"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      };
      const unsafe = await request(
        "/oauth2/register",
        {
          ...metadata,
          skip_consent: true,
          require_pkce: false,
        },
        { Cookie: "" },
      );
      expect(unsafe.status).toBe(400);
      const response = await request("/oauth2/register", metadata, {
        Cookie: "",
      });
      expect(response.status).toBe(201);
      const registered = await response.json();
      const prior = clientId;
      clientId = registered.client_id;
      expect(typeof clientId).toBe("string");
      try {
        await authorize("links:read");
        const query = new URLSearchParams({
          response_type: "code",
          client_id: clientId,
          redirect_uri: redirect,
          scope: "links:read",
          resource,
        });
        const invalid = await location(
          await request(`/oauth2/authorize?${query}`),
        );
        expect(invalid.searchParams.get("error")).toBe("invalid_request");
        expect(invalid.searchParams.has("code")).toBe(false);
      } finally {
        clientId = prior;
      }
    });
    test("pre-upgrade client resource migration is explicit, bounded and idempotent", async () => {
      const links = db.collection(physicalNames.oauth_client_resources);
      await links.deleteOne({ clientId, resourceId: resource });
      const dryRun = await backfillMcpResourceLinks(db, resource);
      expect(dryRun.missing).toBe(1);
      expect(dryRun.linked).toBe(0);
      expect(
        await links.countDocuments({ clientId, resourceId: resource }),
      ).toBe(0);
      expect((await backfillMcpResourceLinks(db, resource, true)).linked).toBe(
        1,
      );
      expect((await backfillMcpResourceLinks(db, resource, true)).missing).toBe(
        0,
      );
      await expect(
        backfillMcpResourceLinks(db, "https://unconfigured.invalid/mcp", true),
      ).rejects.toThrow();
    });
    test("workspace selection is authenticated and refuses foreign or disabled workspaces", async () => {
      expect(
        (
          await request(
            "/mcp/select-workspace",
            { workspaceId: workspaceId.toHexString() },
            { Cookie: "" },
          )
        ).status,
      ).toBe(401);
      expect(
        (
          await request("/mcp/select-workspace", {
            workspaceId: new ObjectId().toHexString(),
          })
        ).status,
      ).toBe(403);
      await collection(db, "workspaces").updateOne(
        { _id: workspaceId },
        { $set: { "platformFeatures.mcp": false } },
      );
      try {
        expect(
          (
            await request("/mcp/select-workspace", {
              workspaceId: workspaceId.toHexString(),
            })
          ).status,
        ).toBe(403);
      } finally {
        await collection(db, "workspaces").updateOne(
          { _id: workspaceId },
          { $set: { "platformFeatures.mcp": true } },
        );
      }
    });
    test("consent rejects stale workspace reviews, forged scopes and query tampering", async () => {
      const consent = await authorize("links:read");
      const query = consent.searchParams.toString(),
        headers = { "x-shortn-workspace": workspaceId.toHexString() };
      expect(
        (await request("/oauth2/consent", { accept: true, oauth_query: query }))
          .status,
      ).toBe(409);
      expect(
        (
          await request(
            "/oauth2/consent",
            { accept: true, oauth_query: query },
            { "x-shortn-workspace": new ObjectId().toHexString() },
          )
        ).status,
      ).toBe(409);
      expect(
        (
          await request(
            "/oauth2/consent",
            { accept: true, scope: "links:write", oauth_query: query },
            headers,
          )
        ).status,
      ).toBeGreaterThanOrEqual(400);
      const tampered = new URLSearchParams(query);
      tampered.set("scope", "links:write");
      expect(
        (
          await request(
            "/oauth2/consent",
            { accept: true, oauth_query: tampered.toString() },
            headers,
          )
        ).status,
      ).toBeGreaterThanOrEqual(400);
      const denied = await location(
        await request(
          "/oauth2/consent",
          { accept: false, oauth_query: query },
          headers,
        ),
      );
      expect(denied.searchParams.get("error")).toBe("access_denied");
      expect(denied.searchParams.has("code")).toBe(false);
    });
    test("token exchange binds resource, client, redirect and PKCE; codes cannot be reused", async () => {
      for (const override of [
        { resource: "https://attacker.invalid/mcp" },
        { client_id: "foreign-client" },
        { redirect_uri: "http://127.0.0.1:43210/other" },
        { code_verifier: "invalid-verifier".repeat(4) },
      ]) {
        const granted = await approve();
        expect(
          (await exchange(granted.searchParams.get("code")!, override)).status,
        ).toBeGreaterThanOrEqual(400);
      }
      const granted = await approve(),
        code = granted.searchParams.get("code")!;
      expect((await exchange(code)).status).toBe(200);
      expect((await exchange(code)).status).toBeGreaterThanOrEqual(400);
    });
    test("refresh rotates credentials without changing rate identity and rejects replay or removed members", async () => {
      const granted = await approve();
      const tokens = await (
        await exchange(granted.searchParams.get("code")!)
      ).json();
      expect(typeof tokens.refresh_token).toBe("string");
      const refresh = (token: string, client = clientId) =>
        request(
          "/oauth2/token",
          {
            grant_type: "refresh_token",
            refresh_token: token,
            client_id: client,
            resource,
          },
          { Cookie: "" },
        );
      expect(
        (await refresh(tokens.refresh_token, "foreign-client")).status,
      ).toBeGreaterThanOrEqual(400);
      const renewedResponse = await refresh(tokens.refresh_token);
      expect(renewedResponse.status).toBe(200);
      const renewed = await renewedResponse.json();
      expect(renewed.refresh_token).not.toBe(tokens.refresh_token);
      const jwks = createRemoteJWKSet(new URL(`${issuer}/jwks`), {
        [customFetch]: async (input, init) =>
          auth.handler(new Request(String(input), init)),
      });
      const config = { issuer, resource, jwks };
      const original = await authenticateMcpOAuth(
          db,
          tokens.access_token,
          config,
        ),
        next = await authenticateMcpOAuth(db, renewed.access_token, config);
      expect(
        original.ok && next.ok && original.value.keyId === next.value.keyId,
      ).toBe(true);
      expect(
        (await refresh(tokens.refresh_token)).status,
      ).toBeGreaterThanOrEqual(400);
      const records = await db
        .collection(physicalNames.oauth_refresh_tokens)
        .find({ clientId })
        .toArray();
      expect(JSON.stringify(records)).not.toContain(renewed.refresh_token);
      const members = collection(db, "workspace_members"),
        member = (await members.findOne({
          workspaceId,
          userId: userId.toHexString(),
        }))!;
      await members.deleteOne({ _id: member._id });
      try {
        expect(
          (await authenticateMcpOAuth(db, renewed.access_token, config)).ok,
        ).toBe(false);
        expect(
          (await refresh(renewed.refresh_token)).status,
        ).toBeGreaterThanOrEqual(400);
      } finally {
        await members.insertOne(member);
      }
    });
    test("live validation rejects disabled clients, scope withdrawal, logout and wrong issuer/audience", async () => {
      const granted = await approve();
      const tokens = await (
        await exchange(granted.searchParams.get("code")!)
      ).json();
      const jwks = createRemoteJWKSet(new URL(`${issuer}/jwks`), {
        [customFetch]: async (input, init) =>
          auth.handler(new Request(String(input), init)),
      });
      const config = { issuer, resource, jwks };
      const resources = db.collection(physicalNames.oauth_resources);
      await resources.updateOne(
        { identifier: resource },
        { $set: { disabled: true } },
      );
      expect(
        (await authenticateMcpOAuth(db, tokens.access_token, config)).ok,
      ).toBe(false);
      await resources.updateOne(
        { identifier: resource },
        { $set: { disabled: false } },
      );
      const links = db.collection(physicalNames.oauth_client_resources);
      const link = (await links.findOne({ clientId }))!;
      await links.deleteOne({ _id: link._id });
      expect(
        (await authenticateMcpOAuth(db, tokens.access_token, config)).ok,
      ).toBe(false);
      await links.insertOne(link);
      const sourceSession = (await db
        .collection(physicalNames.session)
        .findOne({ userId }))!;
      await db
        .collection(physicalNames.session)
        .updateOne(
          { _id: sourceSession._id },
          { $set: { passkeyId: new ObjectId().toHexString() } },
        );
      expect(
        (await authenticateMcpOAuth(db, tokens.access_token, config)).ok,
      ).toBe(false);
      await db
        .collection(physicalNames.session)
        .updateOne({ _id: sourceSession._id }, { $unset: { passkeyId: "" } });
      const ssoTenant = new ObjectId(),
        ssoProvider = new ObjectId(),
        ssoAccount = new ObjectId(),
        ssoSubscription = new ObjectId();
      const ssoProviderName = "synthetic-sso-mcp",
        identityIssuer = "https://idp.synthetic.invalid",
        subject = "synthetic-exact-subject";
      await db.collection(physicalNames.workspaces).insertOne({
        _id: ssoTenant,
        ownerUserId: String(userId),
        personal: false,
        platformFeatures: { advancedAuth: true },
      });
      await db.collection(physicalNames.workspace_members).insertOne({
        workspaceId: ssoTenant,
        userId: String(userId),
        role: "member",
      });
      await db.collection(physicalNames.subscriptions).insertOne({
        _id: ssoSubscription,
        workspaceId: ssoTenant,
        plan: "enterprise",
        status: "active",
      });
      await db.collection(physicalNames.sso_providers).insertOne({
        _id: ssoProvider,
        workspaceId: ssoTenant,
        providerId: ssoProviderName,
        identityIssuer,
        domainVerified: true,
      });
      await db.collection(physicalNames.sso_bindings).insertOne({
        providerRecordId: String(ssoProvider),
        providerId: ssoProviderName,
        workspaceId: ssoTenant,
        issuer: identityIssuer,
        subject,
        userId,
      });
      const boundAccount = {
        _id: ssoAccount,
        userId,
        providerId: ssoProviderName,
        accountId: subject,
      };
      await db.collection(physicalNames.account).insertOne(boundAccount);
      await db.collection(physicalNames.session).updateOne(
        { _id: sourceSession._id },
        {
          $set: {
            ssoProviderId: String(ssoProvider),
            ssoWorkspaceId: String(ssoTenant),
          },
        },
      );
      try {
        expect(
          (await authenticateMcpOAuth(db, tokens.access_token, config)).ok,
        ).toBe(true);
        // The OAuth grant's target workspace stays authorized. Loss of the
        // separate SSO source tenant must still invalidate the bearer token.
        await db
          .collection(physicalNames.workspaces)
          .updateOne(
            { _id: ssoTenant },
            { $set: { "platformFeatures.advancedAuth": false } },
          );
        expect(
          (await authenticateMcpOAuth(db, tokens.access_token, config)).ok,
        ).toBe(false);
        await db
          .collection(physicalNames.workspaces)
          .updateOne(
            { _id: ssoTenant },
            { $set: { "platformFeatures.advancedAuth": true } },
          );
        await db
          .collection(physicalNames.subscriptions)
          .updateOne(
            { _id: ssoSubscription },
            { $set: { status: "canceled" } },
          );
        expect(
          (await authenticateMcpOAuth(db, tokens.access_token, config)).ok,
        ).toBe(false);
        await db
          .collection(physicalNames.subscriptions)
          .updateOne({ _id: ssoSubscription }, { $set: { status: "active" } });
        await db
          .collection(physicalNames.account)
          .deleteOne({ _id: ssoAccount });
        expect(
          (await authenticateMcpOAuth(db, tokens.access_token, config)).ok,
        ).toBe(false);
        await db.collection(physicalNames.account).insertOne(boundAccount);
        await db
          .collection(physicalNames.sso_providers)
          .deleteOne({ _id: ssoProvider });
        expect(
          (await authenticateMcpOAuth(db, tokens.access_token, config)).ok,
        ).toBe(false);
      } finally {
        await db
          .collection(physicalNames.session)
          .updateOne(
            { _id: sourceSession._id },
            { $unset: { ssoProviderId: "", ssoWorkspaceId: "" } },
          );
        await db
          .collection(physicalNames.sso_bindings)
          .deleteMany({ workspaceId: ssoTenant });
        await db
          .collection(physicalNames.sso_providers)
          .deleteOne({ _id: ssoProvider });
        await db
          .collection(physicalNames.account)
          .deleteOne({ _id: ssoAccount });
        await db
          .collection(physicalNames.subscriptions)
          .deleteOne({ _id: ssoSubscription });
        await db
          .collection(physicalNames.workspace_members)
          .deleteMany({ workspaceId: ssoTenant });
        await db
          .collection(physicalNames.workspaces)
          .deleteOne({ _id: ssoTenant });
      }

      expect(
        (await authenticateMcpOAuth(db, tokens.access_token, config)).ok,
      ).toBe(true);
      expect(
        (
          await authenticateMcpOAuth(db, tokens.access_token, {
            ...config,
            issuer: "https://attacker.invalid/api/auth",
          })
        ).ok,
      ).toBe(false);
      expect(
        (
          await authenticateMcpOAuth(db, tokens.access_token, {
            ...config,
            resource: "https://attacker.invalid/mcp",
          })
        ).ok,
      ).toBe(false);
      expect(
        (await authenticateMcpOAuth(db, tokens.access_token + "x", config)).ok,
      ).toBe(false);
      expect(
        (
          await authenticateMcpOAuth(
            db,
            tokens.access_token,
            config,
            new Date(Date.now() + 601000),
          )
        ).ok,
      ).toBe(false);
      await db
        .collection(physicalNames.oauth_clients)
        .updateOne({ clientId }, { $set: { disabled: true } });
      expect(
        (await authenticateMcpOAuth(db, tokens.access_token, config)).ok,
      ).toBe(false);
      await db
        .collection(physicalNames.oauth_clients)
        .updateOne({ clientId }, { $set: { disabled: false } });
      const consents = db.collection(physicalNames.oauth_consents),
        consent = (await consents.findOne({ clientId }))!;
      await consents.updateOne({ _id: consent._id }, { $set: { scopes: [] } });
      expect(
        (await authenticateMcpOAuth(db, tokens.access_token, config)).ok,
      ).toBe(false);
      await consents.updateOne(
        { _id: consent._id },
        { $set: { scopes: consent.scopes } },
      );
      const sessions = db.collection(physicalNames.session),
        session = (await sessions.findOne({ userId }))!;
      await sessions.updateOne(
        { _id: session._id },
        { $set: { expiresAt: new Date(0) } },
      );
      try {
        expect(
          (await authenticateMcpOAuth(db, tokens.access_token, config)).ok,
        ).toBe(false);
      } finally {
        await sessions.updateOne(
          { _id: session._id },
          { $set: { expiresAt: session.expiresAt } },
        );
      }
    });
    test("PKCE consent issues a verifiable, workspace-bound token with live grants", async () => {
      const consent = await authorize();
      const granted = await location(
        await request(
          "/oauth2/consent",
          { accept: true, oauth_query: consent.searchParams.toString() },
          { "x-shortn-workspace": workspaceId.toHexString() },
        ),
      );
      expect(granted.origin + granted.pathname).toBe(redirect);
      expect(granted.searchParams.get("state")).toBe("synthetic-client-state");
      const code = granted.searchParams.get("code")!;
      const tokenResponse = await request("/oauth2/token", {
        grant_type: "authorization_code",
        client_id: clientId,
        code,
        code_verifier: verifier,
        redirect_uri: redirect,
        resource,
      });
      expect(tokenResponse.status).toBe(200);
      const tokens = await tokenResponse.json();
      expect(typeof tokens.access_token).toBe("string");
      const jwks = createRemoteJWKSet(new URL(`${issuer}/jwks`), {
        [customFetch]: async (input, init) =>
          auth.handler(new Request(String(input), init)),
      });
      const principal = await authenticateMcpOAuth(db, tokens.access_token, {
        issuer,
        resource,
        jwks,
      });
      expect(principal.ok).toBe(true);
      if (!principal.ok) throw new Error(principal.error);
      expect(principal.value.workspace._id.equals(workspaceId)).toBe(true);
      expect(principal.value.oauthClientId).toBe(clientId);
      await collection(db, "workspace_members").updateOne(
        { workspaceId, userId: userId.toHexString() },
        { $set: { role: "viewer" } },
      );
      const downgraded = await authenticateMcpOAuth(db, tokens.access_token, {
        issuer,
        resource,
        jwks,
      });
      expect(downgraded.ok && downgraded.value.actor.role).toBe("viewer");
      await collection(db, "workspace_members").updateOne(
        { workspaceId, userId: userId.toHexString() },
        { $set: { role: "owner" } },
      );
      await db
        .collection(physicalNames.oauth_consents)
        .deleteMany({ clientId });
      expect(
        (
          await authenticateMcpOAuth(db, tokens.access_token, {
            issuer,
            resource,
            jwks,
          })
        ).ok,
      ).toBe(false);
    });
    test("password OAuth cannot continue until the second factor is verified", async () => {
      await collection(db, "workspaces").updateOne(
        { _id: workspaceId },
        { $set: { "platformFeatures.advancedAuth": true } },
      );
      const secretKey = "synthetic-oauth-auth-secret-".repeat(3);
      const enrollment = await request("/two-factor/enable", {
        password: "synthetic-oauth-password",
      });
      expect(enrollment.status).toBe(200);
      const recovery = (await enrollment.json()).backupCodes;
      const factor = (await db
        .collection(physicalNames.two_factor)
        .findOne({ userId }))!;
      const secret = await symmetricDecrypt({
        key: secretKey,
        data: factor.secret,
      });
      const setup = await request("/two-factor/verify-totp", {
        code: (await auth.api.generateTOTP({ body: { secret } })).code,
      });
      expect(setup.status).toBe(200);
      const query = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirect,
        scope: "links:read",
        resource,
        code_challenge_method: "S256",
        code_challenge: createHash("sha256")
          .update(verifier)
          .digest("base64url"),
      });
      const login = await location(
        await request(`/oauth2/authorize?${query}`, undefined, { Cookie: "" }),
      );
      expect(login.pathname).toBe("/login");
      const primary = await request(
        "/sign-in/email",
        {
          email: "oauth@example.invalid",
          password: "synthetic-oauth-password",
          oauth_query: login.searchParams.toString(),
        },
        { Cookie: "" },
      );
      expect((await primary.json()).twoFactorRedirect).toBe(true);
      const challenge = primary.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      expect(
        await (
          await request("/get-session", undefined, { Cookie: challenge })
        ).json(),
      ).toBeNull();
      const verified = await request(
        "/two-factor/verify-backup-code",
        { code: recovery[0], oauth_query: login.searchParams.toString() },
        { Cookie: challenge },
      );
      expect((await location(verified)).pathname).toBe("/auth/mcp/workspace");
      const signedCookie = verified.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      expect(
        (
          await (
            await request("/get-session", undefined, { Cookie: signedCookie })
          ).json()
        ).user.id,
      ).toBe(userId.toHexString());
    });
  },
);
