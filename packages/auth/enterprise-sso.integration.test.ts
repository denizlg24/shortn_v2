import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";
import { IdentityProvider, ServiceProvider } from "samlify";
import { createHash, randomUUID } from "node:crypto";
import { createSocket } from "node:dgram";
import { getServers, setServers } from "node:dns/promises";
import { betterAuth } from "better-auth";
import { makeSignature } from "better-auth/crypto";
import { createAuth } from "./index";
import { legacyPasswordGate } from "./legacy-password-gate";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { physicalNames, ssoSessionActive, closeMongoClient } from "@shortn/db";
import { ssoAuthorityCollections } from "./sso-authority";
import { ssoConnectionPage, ssoProviderPage } from "./sso-views";
import fixture from "./fixtures/better-auth-1.4.18.json";

const mongo = process.env.MONGO_TEST_URL;
(mongo ? describe : describe.skip)(
  "Enterprise OIDC protocol and explicit linking",
  () => {
    const origin = "http://localhost:3450",
      userId = new ObjectId(fixture.user.id),
      workspaceId = new ObjectId(),
      jar = new Map<string, string>();
    let db: Db,
      client: MongoClient,
      auth: ReturnType<typeof createAuth>,
      idp: ReturnType<typeof Bun.serve>,
      secretKey: CryptoKey,
      issuer: string,
      dnsProof = "",
      proof = "",
      providerRow: ObjectId;
    let subject = "member-stable-subject",
      nonce = "",
      challenge = "",
      validToken = true;
    const serverList = getServers(),
      dns = createSocket("udp4"),
      codes = new Set<string>();
    let requestIp = 1;
    const provider = "enterprise-fixture",
      samlProvider = "enterprise-saml-fixture";
    let keyDirectory = "",
      samlIdp: ReturnType<typeof IdentityProvider>,
      samlSp: ReturnType<typeof ServiceProvider>,
      signingCert = "",
      privateKey = "";
    const samlAcs = `${origin}/api/auth/sso/saml2/sp/acs/${samlProvider}`;
    async function beginSaml() {
      const response = await request("/sign-in/sso", {
        providerId: samlProvider,
        providerType: "saml",
        callbackURL: "/saml-connected",
        errorCallbackURL: "/saml-failed",
      });
      expect(response.status).toBe(200);
      const target = new URL((await response.json()).url);
      const xml = inflateRawSync(
        Buffer.from(target.searchParams.get("SAMLRequest")!, "base64"),
      ).toString("utf8");
      const id = /\bID="([^"]+)"/.exec(xml)?.[1];
      expect(typeof id).toBe("string");
      return { id: id!, relay: target.searchParams.get("RelayState")! };
    }
    async function assertion(
      requestId: string,
      options: { wrongAudience?: boolean; wrongIssuer?: boolean } = {},
    ) {
      const idp = options.wrongIssuer
        ? IdentityProvider({
            entityID: issuer + "/wrong-idp",
            privateKey,
            signingCert,
            singleSignOnService: [
              {
                Binding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
                Location: issuer + "/saml/sso",
              },
            ],
          })
        : samlIdp;
      const sp = options.wrongAudience
        ? ServiceProvider({
            entityID: origin + "/wrong-audience",
            wantAssertionsSigned: true,
            assertionConsumerService: [
              {
                Binding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
                Location: samlAcs,
              },
            ],
          })
        : samlSp;
      return (
        await idp.createLoginResponse(
          sp,
          { extract: { request: { id: requestId } } },
          "post",
          { email: "member@synthetic.invalid" },
        )
      ).context;
    }
    async function postSaml(response: string, relay: string) {
      return absorb(
        await auth.handler(
          new Request(samlAcs, {
            method: "POST",
            headers: {
              "x-forwarded-for": `192.0.2.${requestIp++}`,
              Origin: issuer,
              Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              SAMLResponse: response,
              RelayState: relay,
            }),
          }),
        ),
      );
    }
    const reachedSaml = (response: Response) =>
      new URL(response.headers.get("location") ?? "/", origin).pathname ===
      "/saml-connected";
    function absorb(response: Response) {
      for (const header of response.headers.getSetCookie()) {
        const item = header.split(";")[0]!,
          split = item.indexOf("=");
        const key = item.slice(0, split),
          value = item.slice(split + 1);
        if (value) jar.set(key, value);
        else jar.delete(key);
      }
      return response;
    }
    async function request(path: string, body?: Record<string, unknown>) {
      return absorb(
        await auth.handler(
          new Request(`${origin}/api/auth${path}`, {
            method: body ? "POST" : "GET",
            headers: {
              "x-forwarded-for": `192.0.2.${requestIp++}`,
              Origin: origin,
              Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
              ...(body ? { "Content-Type": "application/json" } : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
          }),
        ),
      );
    }
    const login = () =>
      request("/sign-in/email", {
        email: "member@synthetic.invalid",
        password: fixture.password,
      });
    async function begin() {
      const response = await request("/sign-in/sso", {
        providerId: provider,
        callbackURL: "/connected",
        errorCallbackURL: "/failed",
      });
      expect(response.status).toBe(200);
      const url = new URL((await response.json()).url);
      nonce = url.searchParams.get("nonce") ?? "";
      challenge = url.searchParams.get("code_challenge") ?? "";
      expect(challenge).not.toBe("");
      const code = randomUUID();
      codes.add(code);
      return `/sso/callback/${provider}?${new URLSearchParams({ state: url.searchParams.get("state")!, code })}`;
    }
    beforeAll(async () => {
      if (!["localhost", "127.0.0.1"].includes(new URL(mongo!).hostname))
        throw Error("Loopback Mongo required");
      client = await new MongoClient(mongo!).connect();
      db = client.db(`shortn_sso_protocol_${randomUUID().replaceAll("-", "")}`);
      const pair = await generateKeyPair("RS256");
      secretKey = pair.privateKey;
      const jwk = {
        ...(await exportJWK(pair.publicKey)),
        kid: "synthetic-sso",
        alg: "RS256",
        use: "sig",
      };
      idp = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        async fetch(req) {
          const url = new URL(req.url);
          if (url.pathname === "/.well-known/openid-configuration")
            return Response.json({
              issuer,
              authorization_endpoint: issuer + "/authorize",
              token_endpoint: issuer + "/token",
              jwks_uri: issuer + "/jwks",
              response_types_supported: ["code"],
              subject_types_supported: ["public"],
              id_token_signing_alg_values_supported: ["RS256"],
              token_endpoint_auth_methods_supported: ["client_secret_post"],
            });
          if (url.pathname === "/jwks") return Response.json({ keys: [jwk] });
          if (url.pathname === "/token") {
            const body = new URLSearchParams(await req.text());
            if (
              !codes.delete(body.get("code") ?? "") ||
              createHash("sha256")
                .update(body.get("code_verifier") ?? "")
                .digest("base64url") !== challenge
            )
              return Response.json({ error: "invalid_grant" }, { status: 400 });
            const token = await new SignJWT({
              email: "member@synthetic.invalid",
              email_verified: true,
              name: "Provider profile",
              ...(nonce ? { nonce } : {}),
            })
              .setProtectedHeader({ alg: "RS256", kid: "synthetic-sso" })
              .setIssuer(
                validToken ? issuer : "https://wrong.synthetic.invalid",
              )
              .setSubject(subject)
              .setAudience("synthetic-client")
              .setIssuedAt()
              .setExpirationTime("5m")
              .sign(secretKey);
            return Response.json({
              access_token: "synthetic-unused-provider-access",
              token_type: "Bearer",
              expires_in: 300,
              id_token: token,
            });
          }
          return new Response("Synthetic IdP", { status: 404 });
        },
      });
      issuer = `http://127.0.0.1:${idp.port}`;
      dns.on("message", (query, remote) => {
        let end = 12;
        while (query[end]) end += 1 + query[end]!;
        end += 5;
        const txt = Buffer.from(dnsProof),
          header = Buffer.from(query.subarray(0, 12));
        header.writeUInt16BE(0x8180, 2);
        header.writeUInt16BE(1, 6);
        const answer = Buffer.alloc(13);
        answer.writeUInt16BE(0xc00c);
        answer.writeUInt16BE(16, 2);
        answer.writeUInt16BE(1, 4);
        answer.writeUInt32BE(0, 6);
        answer.writeUInt16BE(txt.length + 1, 10);
        answer[12] = txt.length;
        dns.send(
          Buffer.concat([header, query.subarray(12, end), answer, txt]),
          remote.port,
          remote.address,
        );
      });
      await new Promise<void>((resolve) => dns.bind(0, "127.0.0.1", resolve));
      const address = dns.address();
      if (typeof address === "string") throw Error("Unexpected DNS socket");
      setServers([`127.0.0.1:${address.port}`]);
      auth = createAuth({
        baseURL: origin,
        secret: fixture.secret,
        production: false,
        trustedOrigins: [origin, issuer],
        mongo: { url: mongo!, database: db.databaseName },
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
        email: "member@synthetic.invalid",
        name: "Preserved local profile",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      });
      await db.collection(physicalNames.account).insertOne({
        userId,
        accountId: String(userId),
        providerId: "credential",
        password: fixture.account.password,
        createdAt: now,
        updatedAt: now,
      });
      await db.collection(physicalNames.workspaces).insertOne({
        _id: workspaceId,
        ownerUserId: String(userId),
        personal: false,
        slug: "synthetic-sso",
        name: "Synthetic workspace",
        platformFeatures: { advancedAuth: true },
      });
      await db
        .collection(physicalNames.workspace_members)
        .insertOne({ workspaceId, userId: String(userId), role: "owner" });
      await db
        .collection(physicalNames.subscriptions)
        .insertOne({ workspaceId, plan: "enterprise", status: "active" });
      await db
        .collection(ssoAuthorityCollections.binding)
        .createIndex(
          { providerRecordId: 1, issuer: 1, subject: 1 },
          { unique: true },
        );
      await db
        .collection(ssoAuthorityCollections.binding)
        .createIndex({ providerRecordId: 1, userId: 1 }, { unique: true });
      expect((await login()).status).toBe(200);
    });
    afterAll(async () => {
      if (keyDirectory)
        await rm(keyDirectory, { recursive: true, force: true });
      setServers(serverList);
      dns.close();
      idp?.stop(true);
      await db?.dropDatabase();
      await client?.close();
      await closeMongoClient();
    });
    test("registration requires current Enterprise owner authority and encrypts configuration", async () => {
      const body = {
        providerId: provider,
        workspaceId: String(workspaceId),
        identityIssuer: "https://untrusted.synthetic.invalid",
        issuer,
        domain: "synthetic.invalid",
        oidcConfig: {
          clientId: "synthetic-client",
          clientSecret: "synthetic-private-secret",
        },
      };
      await db
        .collection(physicalNames.subscriptions)
        .updateMany({ workspaceId }, { $set: { status: "canceled" } });
      expect((await request("/sso/register", body)).status).toBe(403);
      await db
        .collection(physicalNames.subscriptions)
        .updateMany({ workspaceId }, { $set: { status: "active" } });
      const registered = await request("/sso/register", body);
      expect(registered.status).toBe(200);
      const data = await registered.json();
      proof = data.domainVerificationToken;
      expect(typeof proof).toBe("string");
      expect(data.oidcConfig).toBeUndefined();
      const row = await db
        .collection("ssoProvider")
        .findOne({ providerId: provider });
      expect(row).not.toBeNull();
      providerRow = row!._id;
      expect(row!.identityIssuer).toBe(issuer);
      expect(row!.oidcConfig).toStartWith("shortn-sso:v1:");
      expect(row!.oidcConfig).not.toContain("synthetic-private-secret");
    });
    test("DNS proof is required and unverified providers cannot begin authentication", async () => {
      expect(
        (
          await request("/sign-in/sso", {
            providerId: provider,
            callbackURL: "/connected",
          })
        ).status,
      ).toBe(403);
      dnsProof = "wrong-proof";
      expect(
        (await request("/sso/verify-domain", { providerId: provider })).status,
      ).not.toBe(204);
      expect(
        (await db.collection("ssoProvider").findOne({ _id: providerRow }))
          ?.domainVerified,
      ).toBe(false);
      dnsProof = proof;
      expect(
        (await request("/sso/verify-domain", { providerId: provider })).status,
      ).toBe(204);
    });
    test("a verified OIDC identity still cannot silently link a local account", async () => {
      await request("/sign-out", {});
      const callback = await begin();
      const response = await request(callback);
      expect(response.headers.get("location")).toContain(
        "SSO_ACCOUNT_NOT_CONNECTED",
      );
      expect(
        await db.collection(ssoAuthorityCollections.binding).countDocuments(),
      ).toBe(0);
    });
    test("explicit recent-session consent completes signed OIDC and consumes the intent", async () => {
      expect((await login()).status).toBe(200);
      expect(
        (await request("/shortn/sso/link-intent", { providerId: provider }))
          .status,
      ).toBe(200);
      const callback = await begin(),
        response = await request(callback);
      expect(response.headers.get("location")).toBe("/connected");
      expect(
        await db.collection(ssoAuthorityCollections.intent).countDocuments(),
      ).toBe(0);
      const binding = await db
        .collection(ssoAuthorityCollections.binding)
        .findOne({});
      expect(binding?.userId).toEqual(userId);
      expect(binding?.subject).toBe(subject);
      const session = await (await request("/get-session")).json();
      expect(session.session.ssoProviderId).toBe(String(providerRow));
      expect(session.session.ssoWorkspaceId).toBe(String(workspaceId));
      expect(
        (await db.collection(physicalNames.user).findOne({ _id: userId }))
          ?.name,
      ).toBe("Preserved local profile");
      expect((await request(callback)).headers.get("location")).not.toBe(
        "/connected",
      );
    });
    test("discovery and connection views paginate, isolate tenants and omit secrets", async () => {
      const providers = Array.from({ length: 24 }, (_, index) => ({
        _id: new ObjectId(),
        workspaceId,
        userId,
        providerId: `view-${index}`,
        displayName: `Synthetic provider ${index}`,
        domain: "synthetic.invalid",
        domainVerified: true,
        identityIssuer: issuer,
        oidcConfig: "secret-ciphertext-never-returned",
      }));
      await db.collection(physicalNames.sso_providers).insertMany(providers);
      const otherProvider = new ObjectId();
      await db.collection(physicalNames.sso_providers).insertOne({
        _id: otherProvider,
        workspaceId: new ObjectId(),
        providerId: "another-tenant",
        domainVerified: true,
      });
      const bindings = providers.map((row) => ({
        providerRecordId: row._id,
        providerId: row.providerId,
        workspaceId,
        userId,
        issuer,
        subject: "private-subject",
      }));
      await db.collection(physicalNames.sso_bindings).insertMany(bindings);
      const stranger = new ObjectId();
      await db.collection(physicalNames.sso_bindings).insertOne({
        userId: stranger,
        providerRecordId: otherProvider,
        providerId: "another-tenant",
        issuer,
        subject: "private-stranger",
      });
      try {
        const first = await ssoProviderPage(db, workspaceId, 1, true),
          last = await ssoProviderPage(db, workspaceId, 999, true);
        expect(first.rows).toHaveLength(10);
        expect(first.total).toBe(25);
        expect(last.rows).toHaveLength(5);
        expect(last.page).toBe(3);
        expect(JSON.stringify(first)).not.toContain("ciphertext");
        expect(JSON.stringify(first)).not.toContain("identityIssuer");
        expect(JSON.stringify(first)).not.toContain("another-tenant");
        const own = await ssoConnectionPage(db, String(userId), 3);
        expect(own.rows).toHaveLength(5);
        expect(own.total).toBe(25);
        expect(own.rows.every((row) => row.available)).toBe(true);
        expect(JSON.stringify(own)).not.toContain("private-subject");
        expect(JSON.stringify(own)).not.toContain("issuer");
        const discovery = await (
          await request("/shortn/sso/discover?workspace=synthetic-sso&page=3")
        ).json();
        expect(discovery.rows).toHaveLength(5);
        expect(discovery.total).toBe(25);
        await db
          .collection(physicalNames.workspaces)
          .updateOne(
            { _id: workspaceId },
            { $set: { "platformFeatures.advancedAuth": false } },
          );
        expect(
          (
            await (
              await request("/shortn/sso/discover?workspace=synthetic-sso")
            ).json()
          ).total,
        ).toBe(0);
        expect(
          (await ssoConnectionPage(db, String(userId), 1)).rows.every(
            (row) => !row.available,
          ),
        ).toBe(true);
        expect(
          (
            await (
              await request("/shortn/sso/discover?workspace=does-not-exist")
            ).json()
          ).total,
        ).toBe(0);
        expect(
          (
            await request("/sign-in/sso", {
              providerId: provider,
              callbackURL: "/connected",
              oauth_query: "sig=forged&exp=9999999999",
            })
          ).status,
        ).toBe(400);
      } finally {
        await db
          .collection(physicalNames.workspaces)
          .updateOne(
            { _id: workspaceId },
            { $set: { "platformFeatures.advancedAuth": true } },
          );
        await db.collection(physicalNames.sso_bindings).deleteMany({
          providerId: {
            $in: [...providers.map((row) => row.providerId), "another-tenant"],
          },
        });
        await db.collection(physicalNames.sso_providers).deleteMany({
          _id: { $in: [...providers.map((row) => row._id), otherProvider] },
        });
      }
    });
    test("linked subjects authenticate; a changed subject or issuer cannot inherit the binding", async () => {
      await request("/sign-out", {});
      expect((await request(await begin())).headers.get("location")).toBe(
        "/connected",
      );
      await request("/sign-out", {});
      subject = "other-subject";
      expect((await request(await begin())).headers.get("location")).toContain(
        "SSO_ACCOUNT_NOT_CONNECTED",
      );
      subject = "member-stable-subject";
      validToken = false;
      expect((await request(await begin())).headers.get("location")).not.toBe(
        "/connected",
      );
      validToken = true;
    });
    test("a banned user's signed OIDC callback opens no session", async () => {
      await request("/sign-out", {});
      const users = db.collection(physicalNames.user);
      await users.updateOne({ _id: userId }, { $set: { banned: true } });
      try {
        const location = (await request(await begin())).headers.get("location");
        expect(location).toContain("ACCOUNT_SUSPENDED");
        expect(await (await request("/get-session")).json()).toBeNull();
      } finally {
        await users.updateOne({ _id: userId }, { $unset: { banned: "" } });
      }
      expect((await request(await begin())).headers.get("location")).toBe(
        "/connected",
      );
    });
    test("flag changes immediately reject shared SSO sessions; owners can delete after entitlement loss", async () => {
      expect((await request(await begin())).headers.get("location")).toBe(
        "/connected",
      );
      const active = await (await request("/get-session")).json();
      expect(active.session.ssoProviderId).toBe(String(providerRow));
      await db
        .collection(physicalNames.workspaces)
        .updateOne(
          { _id: workspaceId },
          { $set: { "platformFeatures.advancedAuth": false } },
        );
      expect(await (await request("/get-session")).json()).toBeNull();
      expect(
        await db
          .collection(physicalNames.session)
          .countDocuments({ token: active.session.token }),
      ).toBe(0);
      await db
        .collection(physicalNames.workspaces)
        .updateOne(
          { _id: workspaceId },
          { $set: { "platformFeatures.advancedAuth": true } },
        );
      expect((await login()).status).toBe(200);
      const ordinary = await (await request("/get-session")).json();
      expect(ordinary.session.ssoProviderId).toBeUndefined();
      expect(
        (
          await request("/sso/update-provider", {
            providerId: provider,
            workspaceId: String(new ObjectId()),
          })
        ).status,
      ).toBe(403);
      await db
        .collection(physicalNames.subscriptions)
        .updateMany({ workspaceId }, { $set: { status: "canceled" } });
      expect(
        (
          await request("/sign-in/sso", {
            providerId: provider,
            callbackURL: "/connected",
          })
        ).status,
      ).toBe(403);
      expect(
        (await request("/sso/delete-provider", { providerId: provider }))
          .status,
      ).toBe(200);
      expect(
        await db.collection("ssoProvider").countDocuments({ _id: providerRow }),
      ).toBe(0);
      expect(
        await db.collection(ssoAuthorityCollections.binding).countDocuments(),
      ).toBe(0);
      expect(
        await db
          .collection(physicalNames.account)
          .countDocuments({ providerId: provider }),
      ).toBe(0);
    });

    test("SAML registration pins metadata authority, encrypts configuration and verifies DNS", async () => {
      await db
        .collection(physicalNames.subscriptions)
        .updateMany({ workspaceId }, { $set: { status: "active" } });
      expect((await login()).status).toBe(200);
      keyDirectory = await mkdtemp(join(tmpdir(), "shortn-saml-fixture-"));
      const generated = Bun.spawn(
        [
          "openssl",
          "req",
          "-x509",
          "-newkey",
          "rsa:2048",
          "-sha256",
          "-nodes",
          "-days",
          "1",
          "-subj",
          "/CN=synthetic.invalid",
          "-keyout",
          join(keyDirectory, "key.pem"),
          "-out",
          join(keyDirectory, "cert.pem"),
        ],
        { stdout: "ignore", stderr: "pipe" },
      );
      if ((await generated.exited) !== 0)
        throw Error(await new Response(generated.stderr).text());
      signingCert = await readFile(join(keyDirectory, "cert.pem"), "utf8");
      privateKey = await readFile(join(keyDirectory, "key.pem"), "utf8");
      samlIdp = IdentityProvider({
        entityID: issuer + "/saml/idp",
        privateKey,
        signingCert,
        singleSignOnService: [
          {
            Binding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
            Location: issuer + "/saml/sso",
          },
        ],
      });
      samlSp = ServiceProvider({
        entityID: origin + "/saml/sp",
        wantAssertionsSigned: true,
        assertionConsumerService: [
          {
            Binding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
            Location: samlAcs,
          },
        ],
      });
      const registered = await request("/sso/register", {
        providerId: samlProvider,
        workspaceId: String(workspaceId),
        identityIssuer: "https://untrusted.synthetic.invalid",
        issuer: origin + "/saml/sp",
        domain: "synthetic.invalid",
        samlConfig: {
          issuer: origin + "/saml/sp",
          entryPoint: issuer + "/saml/sso",
          audience: origin + "/saml/sp",
          cert: signingCert,
          idpMetadata: { metadata: samlIdp.getMetadata() },
          spMetadata: { metadata: samlSp.getMetadata() },
        },
      });
      expect(registered.status).toBe(200);
      const data = await registered.json();
      dnsProof = data.domainVerificationToken;
      expect(data.samlConfig).toBeUndefined();
      const row = await db
        .collection("ssoProvider")
        .findOne({ providerId: samlProvider });
      expect(row?.identityIssuer).toBe(issuer + "/saml/idp");
      expect(row?.samlConfig).toStartWith("shortn-sso:v1:");
      expect(row?.samlConfig).not.toContain(signingCert);
      expect(
        (await request("/sso/verify-domain", { providerId: samlProvider }))
          .status,
      ).toBe(204);
    });
    test("signed SAML authentication requires explicit local account consent", async () => {
      await request("/sign-out", {});
      const pending = await beginSaml();
      const denied = await postSaml(await assertion(pending.id), pending.relay);
      expect(reachedSaml(denied)).toBe(false);
      expect(denied.headers.get("location")).toContain(
        "SSO_ACCOUNT_NOT_CONNECTED",
      );
      expect((await login()).status).toBe(200);
      expect(
        (await request("/shortn/sso/link-intent", { providerId: samlProvider }))
          .status,
      ).toBe(200);
      const linking = await beginSaml(),
        signed = await assertion(linking.id),
        response = await postSaml(signed, linking.relay);
      expect(reachedSaml(response)).toBe(true);
      const row = await db
        .collection(ssoAuthorityCollections.binding)
        .findOne({ providerId: samlProvider });
      expect(row?.subject).toBe("member@synthetic.invalid");
      expect(row?.issuer).toBe(issuer + "/saml/idp");
      expect(row?.userId).toEqual(userId);
      expect(
        await db.collection(ssoAuthorityCollections.intent).countDocuments(),
      ).toBe(0);
      expect(reachedSaml(await postSaml(signed, linking.relay))).toBe(false);
    });
    test("signed MCP continuation is stored for native SAML relay-state identifiers", async () => {
      const clientId = "synthetic-saml-state-client",
        redirectUri = "http://127.0.0.1:3999/callback";
      await db
        .collection(physicalNames.oauth_clients)
        .insertOne({ clientId, redirectUris: [redirectUri], disabled: false });
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "links:read",
        exp: String(Math.floor(Date.now() / 1000) + 300),
        ba_iat: String(Date.now()),
      });
      const canonical = new URLSearchParams(
        [...params].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      );
      params.set(
        "sig",
        await makeSignature(canonical.toString(), fixture.secret),
      );
      try {
        for (let index = 0; index < 12; index++) {
          const response = await request("/sign-in/sso", {
            providerId: samlProvider,
            providerType: "saml",
            callbackURL: "/saml-connected",
            oauth_query: params.toString(),
          });
          expect(response.status).toBe(200);
          const relay = new URL((await response.json()).url).searchParams.get(
            "RelayState",
          )!;
          const saved = await db
            .collection(physicalNames.verification)
            .findOne({ identifier: `shortn-sso-oauth:${relay}` });
          expect(saved).not.toBeNull();
          expect(JSON.parse(saved!.value)).toEqual({
            query: params.toString(),
            providerId: samlProvider,
          });
        }
      } finally {
        await db
          .collection(physicalNames.oauth_clients)
          .deleteMany({ clientId });
      }
    });
    test("SAML rejects tampering, missing signatures, wrong request, issuer and audience", async () => {
      await request("/sign-out", {});
      for (const scenario of [
        "tamper",
        "unsigned",
        "wrong-request",
        "wrong-issuer",
        "wrong-audience",
      ]) {
        const pending = await beginSaml();
        let signed = await assertion(
          scenario === "wrong-request" ? "_unrecognized-request" : pending.id,
          {
            wrongAudience: scenario === "wrong-audience",
            wrongIssuer: scenario === "wrong-issuer",
          },
        );
        if (scenario === "tamper" || scenario === "unsigned") {
          let xml = Buffer.from(signed, "base64").toString("utf8");
          xml =
            scenario === "tamper"
              ? xml.replaceAll(
                  "member@synthetic.invalid",
                  "attacker@synthetic.invalid",
                )
              : xml.replace(/<ds:Signature[\s\S]*?<\/ds:Signature>/g, "");
          signed = Buffer.from(xml).toString("base64");
        }
        expect(reachedSaml(await postSaml(signed, pending.relay))).toBe(false);
        expect(await (await request("/get-session")).json()).toBeNull();
      }
      const pending = await beginSaml();
      expect(
        reachedSaml(await postSaml(await assertion(pending.id), pending.relay)),
      ).toBe(true);
    });

    test("legacy rejects a credential-bound SSO session after its account is disconnected", async () => {
      const legacy = betterAuth({
        baseURL: origin,
        secret: fixture.secret,
        database: mongodbAdapter(db, { client }),
        advanced: { cookiePrefix: "shortn_auth_", useSecureCookies: false },
        plugins: [
          legacyPasswordGate(
            async () => false,
            undefined,
            (session, owner) => ssoSessionActive(db, session, owner),
          ),
        ],
      });
      const cookie = [...jar]
        .map(([key, value]) => `${key}=${value}`)
        .join("; ");
      const requestLegacy = () =>
        legacy.handler(
          new Request(`${origin}/api/auth/get-session`, {
            headers: { Origin: origin, Cookie: cookie },
          }),
        );
      const session = await (await requestLegacy()).json();
      expect(session.user.id).toBe(String(userId));
      expect(typeof session.session.ssoProviderId).toBe("string");
      await db
        .collection(physicalNames.account)
        .deleteMany({ userId, providerId: samlProvider });
      expect(await ssoSessionActive(db, session.session, String(userId))).toBe(
        false,
      );
      expect(await (await requestLegacy()).json()).toBeNull();
      expect(await (await request("/get-session")).json()).toBeNull();
    });

    test("production SAML correlation and linking cookies use Secure and SameSite=None", async () => {
      const secure = createAuth({
        baseURL: origin,
        secret: fixture.secret,
        production: true,
        trustedOrigins: [origin, issuer],
        mongo: { url: mongo!, database: db.databaseName },
        polar: { accessToken: "synthetic-unused-token", server: "sandbox" },
        emails: {
          verifyEmail: async () => {},
          emailVerified: async () => {},
          resetPassword: async () => {},
          confirmEmailChange: async () => {},
        },
      });
      const cookies = new Map<string, string>();
      const invoke = async (path: string, body: Record<string, unknown>) => {
        const response = await secure.handler(
          new Request(origin + "/api/auth" + path, {
            method: "POST",
            headers: {
              Origin: origin,
              Cookie: [...cookies]
                .map(([key, value]) => `${key}=${value}`)
                .join("; "),
              "Content-Type": "application/json",
              "x-forwarded-for": `192.0.2.${requestIp++}`,
            },
            body: JSON.stringify(body),
          }),
        );
        for (const header of response.headers.getSetCookie()) {
          const pair = header.split(";")[0]!,
            split = pair.indexOf("=");
          cookies.set(pair.slice(0, split), pair.slice(split + 1));
        }
        return response;
      };
      expect(
        (
          await invoke("/sign-in/email", {
            email: "member@synthetic.invalid",
            password: fixture.password,
          })
        ).status,
      ).toBe(200);
      const prepared = await invoke("/shortn/sso/link-intent", {
        providerId: samlProvider,
      });
      expect(prepared.status).toBe(200);
      const proof = prepared.headers
        .getSetCookie()
        .find((value) => value.includes("__Secure-shortn_sso_link="))!;
      expect(proof).toContain("HttpOnly");
      expect(proof).toContain("Secure");
      expect(proof).toContain("SameSite=None");
      const start = await invoke("/sign-in/sso", {
        providerId: samlProvider,
        providerType: "saml",
        callbackURL: "/saml-connected",
      });
      expect(start.status).toBe(200);
      const relay = start.headers
        .getSetCookie()
        .find((value) => value.includes("relay_state="))!;
      expect(relay).toContain("HttpOnly");
      expect(relay).toContain("Secure");
      expect(relay).toContain("SameSite=None");
    });
    test("explicit disconnection withdraws consent, preserves a fallback and revokes all sessions", async () => {
      // The previous legacy test removed the account, while its proof binding
      // remains. A fresh protocol flow can recreate that account for this test.
      const pending = await beginSaml();
      expect(
        reachedSaml(await postSaml(await assertion(pending.id), pending.relay)),
      ).toBe(true);
      const ssoAccount = (await db
        .collection(physicalNames.account)
        .findOne({ userId, providerId: samlProvider }))!;
      const blocked = await request("/unlink-account", {
        accountId: String(ssoAccount._id),
      });
      expect(blocked.status).toBe(403);
      expect((await blocked.json()).code).toBe("SSO_DISCONNECT_REQUIRED");
      const credential = (await db
        .collection(physicalNames.account)
        .findOne({ userId, providerId: "credential" }))!;
      await db
        .collection(physicalNames.account)
        .deleteOne({ _id: credential._id });
      const last = await request("/shortn/sso/disconnect", {
        providerId: samlProvider,
      });
      expect(last.status).toBe(403);
      expect((await last.json()).code).toBe("LAST_SIGN_IN_METHOD");
      expect(
        await db
          .collection(ssoAuthorityCollections.binding)
          .countDocuments({ providerId: samlProvider }),
      ).toBe(1);
      await db.collection(physicalNames.account).insertOne(credential);
      expect(
        (await request("/shortn/sso/disconnect", { providerId: samlProvider }))
          .status,
      ).toBe(200);
      expect(
        await db
          .collection(ssoAuthorityCollections.binding)
          .countDocuments({ providerId: samlProvider }),
      ).toBe(0);
      expect(
        await db
          .collection(physicalNames.account)
          .countDocuments({ userId, providerId: samlProvider }),
      ).toBe(0);
      expect(
        await db.collection(physicalNames.session).countDocuments({ userId }),
      ).toBe(0);
      const after = await beginSaml();
      expect(
        reachedSaml(await postSaml(await assertion(after.id), after.relay)),
      ).toBe(false);
    });
  },
);
