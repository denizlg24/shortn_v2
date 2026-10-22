import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { randomBytes } from "node:crypto";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { sso, type SSOUserResolutionInput } from "@better-auth/sso";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { physicalNames } from "@shortn/db";
import {
  hashSsoLinkNonce,
  resolveWorkspaceSsoIdentity,
  ssoAuthorityCollections,
  ssoAuthoritySchema,
  ssoProviderFields,
} from "./sso-authority";

const url = process.env.MONGO_TEST_URL;
(url ? describe : describe.skip)(
  "transactional canonical Enterprise SSO identity authority",
  () => {
    let client: MongoClient,
      db: Db,
      adapter: Awaited<ReturnType<typeof betterAuth>["$context"]>["adapter"];
    const userId = new ObjectId(),
      otherUser = new ObjectId(),
      workspaceId = new ObjectId(),
      providerId = new ObjectId(),
      sessionId = new ObjectId();
    const nonce = randomBytes(32).toString("base64url"),
      now = new Date();
    const identity = (
      subject = "case-sensitive-Subject",
    ): SSOUserResolutionInput => ({
      protocol: "oidc",
      providerId: "enterprise-fixture",
      accountKey: {
        issuer: "https://idp.synthetic.invalid",
        accountId: subject,
      },
      providerUser: {
        email: "member@synthetic.invalid",
        emailVerified: true,
        name: "Synthetic member",
      },
      providerClaims: {},
      verifiedIdTokenClaims: {},
      providerReference: {
        providerId: "enterprise-fixture",
        source: { type: "persisted", recordId: String(providerId) },
        authenticationConfigurationFingerprint: "synthetic-reference",
      },
    });
    const resolve = (input = identity(), proof?: string) =>
      adapter.transaction((database) =>
        resolveWorkspaceSsoIdentity(input, { database }, proof, now),
      );
    const intent = () =>
      db.collection(ssoAuthorityCollections.intent).insertOne({
        nonceHash: hashSsoLinkNonce(nonce),
        providerId: "enterprise-fixture",
        providerRecordId: String(providerId),
        workspaceId,
        userId,
        sessionId,
        createdAt: now,
        expiresAt: new Date(now.getTime() + 300000),
      });
    beforeAll(async () => {
      if (!["localhost", "127.0.0.1"].includes(new URL(url!).hostname))
        throw Error("Loopback Mongo required");
      client = await new MongoClient(url!).connect();
      db = client.db(
        `shortn_sso_authority_${crypto.randomUUID().replaceAll("-", "")}`,
      );
      const options: BetterAuthOptions = {
        baseURL: "http://localhost:3450",
        secret: "synthetic-sso-authority-secret-at-least-32-characters",
        database: mongodbAdapter(db, { client }),
        session: {
          additionalFields: {
            impersonatedBy: { type: "string", required: false, input: false },
          },
        },
        plugins: [
          sso({
            domainVerification: { enabled: true },
            schema: { ssoProvider: { additionalFields: ssoProviderFields } },
          }),
          ssoAuthoritySchema,
        ],
      };
      const auth = betterAuth(options);
      adapter = (await auth.$context).adapter;
      await db
        .collection(ssoAuthorityCollections.binding)
        .createIndex(
          { providerRecordId: 1, issuer: 1, subject: 1 },
          { unique: true },
        );
      await db
        .collection(ssoAuthorityCollections.binding)
        .createIndex({ providerRecordId: 1, userId: 1 }, { unique: true });
      await db
        .collection(ssoAuthorityCollections.intent)
        .createIndex({ nonceHash: 1 }, { unique: true });
    });
    beforeEach(async () => {
      for (const name of [
        physicalNames.user,
        physicalNames.session,
        physicalNames.workspaces,
        physicalNames.workspace_members,
        physicalNames.subscriptions,
        "ssoProvider",
        ssoAuthorityCollections.binding,
        ssoAuthorityCollections.intent,
      ])
        await db.collection(name).deleteMany({});
      await db.collection(physicalNames.user).insertMany([
        {
          _id: userId,
          email: "member@synthetic.invalid",
          emailVerified: true,
          name: "Local preserved profile",
          createdAt: now,
          updatedAt: now,
        },
        {
          _id: otherUser,
          email: "other@synthetic.invalid",
          emailVerified: true,
        },
      ]);
      await db.collection(physicalNames.session).insertOne({
        _id: sessionId,
        userId,
        createdAt: now,
        expiresAt: new Date(now.getTime() + 3600000),
        token: "synthetic-session",
      });
      await db.collection(physicalNames.workspaces).insertOne({
        _id: workspaceId,
        ownerUserId: String(userId),
        personal: false,
        platformFeatures: { advancedAuth: true },
      });
      await db
        .collection(physicalNames.workspace_members)
        .insertOne({ workspaceId, userId: String(userId), role: "owner" });
      await db
        .collection(physicalNames.subscriptions)
        .insertOne({ workspaceId, plan: "enterprise", status: "active" });
      await db.collection("ssoProvider").insertOne({
        _id: providerId,
        providerId: "enterprise-fixture",
        userId,
        workspaceId,
        identityIssuer: "https://idp.synthetic.invalid",
        issuer: "https://idp.synthetic.invalid",
        domain: "synthetic.invalid",
        domainVerified: true,
      });
    });
    afterAll(async () => {
      await db?.dropDatabase();
      await client?.close();
    });
    test("email/domain equality never silently links an existing global account", async () => {
      expect(await resolve()).toEqual({
        action: "reject",
        code: "SSO_ACCOUNT_NOT_CONNECTED",
      });
      expect(
        await db.collection(ssoAuthorityCollections.binding).countDocuments(),
      ).toBe(0);
      expect(await db.collection(physicalNames.user).countDocuments()).toBe(2);
    });
    test("explicit fresh-session consent creates an exact binding and preserves the local profile", async () => {
      await intent();
      expect(await resolve(identity(), nonce)).toEqual({
        action: "link",
        userId: String(userId),
        profile: "preserve",
      });
      const row = await db
        .collection(ssoAuthorityCollections.binding)
        .findOne({});
      expect(row?.userId).toEqual(userId);
      expect(row?.workspaceId).toEqual(workspaceId);
      expect(row?.issuer).toBe(identity().accountKey.issuer);
      expect(row?.subject).toBe(identity().accountKey.accountId);
      expect(
        await db.collection(ssoAuthorityCollections.intent).countDocuments(),
      ).toBe(0);
      expect(
        (await db.collection(physicalNames.user).findOne({ _id: userId }))
          ?.name,
      ).toBe("Local preserved profile");
      expect(await resolve()).toEqual({
        action: "link",
        userId: String(userId),
        profile: "preserve",
      });
      expect(await resolve(identity("case-sensitive-subject"))).toEqual({
        action: "reject",
        code: "SSO_ACCOUNT_NOT_CONNECTED",
      });
    });
    test("linking consent cannot switch to a subject bound to a different local account", async () => {
      await intent();
      expect((await resolve(identity(), nonce)).action).toBe("link");
      const otherSession = new ObjectId(),
        otherNonce = randomBytes(32).toString("base64url");
      await db
        .collection(physicalNames.workspace_members)
        .insertOne({ workspaceId, userId: String(otherUser), role: "member" });
      await db.collection(physicalNames.session).insertOne({
        _id: otherSession,
        userId: otherUser,
        createdAt: now,
        expiresAt: new Date(now.getTime() + 3600000),
        token: "synthetic-other-session",
      });
      await db.collection(ssoAuthorityCollections.intent).insertOne({
        nonceHash: hashSsoLinkNonce(otherNonce),
        providerId: "enterprise-fixture",
        providerRecordId: String(providerId),
        workspaceId,
        userId: otherUser,
        sessionId: otherSession,
        createdAt: now,
        expiresAt: new Date(now.getTime() + 300000),
      });
      expect(await resolve(identity(), otherNonce)).toEqual({
        action: "reject",
        code: "SSO_LINK_ACCOUNT_MISMATCH",
      });
      expect(
        (await db.collection(ssoAuthorityCollections.binding).findOne({}))
          ?.userId,
      ).toEqual(userId);
      expect(
        await db
          .collection(ssoAuthorityCollections.intent)
          .countDocuments({ userId: otherUser }),
      ).toBe(1);
    });
    test("canonical membership, flags, current subscription and provider proof gate every sign-in", async () => {
      await intent();
      expect((await resolve(identity(), nonce)).action).toBe("link");
      for (const [collection, filter, update, reset] of [
        [
          physicalNames.workspaces,
          { _id: workspaceId },
          { $set: { personal: true } },
          { $set: { personal: false } },
        ],
        [
          physicalNames.workspaces,
          { _id: workspaceId },
          { $set: { "platformFeatures.advancedAuth": false } },
          { $set: { "platformFeatures.advancedAuth": true } },
        ],
        [
          physicalNames.subscriptions,
          { workspaceId },
          { $set: { status: "canceled" } },
          { $set: { status: "active" } },
        ],
        [
          "ssoProvider",
          { _id: providerId },
          { $set: { domainVerified: false } },
          { $set: { domainVerified: true } },
        ],
      ] as const) {
        await db.collection(collection).updateOne(filter, update);
        expect((await resolve()).action).toBe("reject");
        await db.collection(collection).updateOne(filter, reset);
      }
      await db
        .collection(physicalNames.workspace_members)
        .deleteMany({ workspaceId });
      expect((await resolve()).action).toBe("reject");
    });
    test("a complimentary Enterprise plan satisfies SSO authority until it expires", async () => {
      await db
        .collection(physicalNames.subscriptions)
        .updateMany({ workspaceId }, { $set: { status: "canceled" } });
      const comp = (expiresAt?: Date) =>
        db.collection(physicalNames.workspaces).updateOne(
          { _id: workspaceId },
          {
            $set: {
              entitlementOverride: {
                plan: "enterprise",
                reason: "design partner",
                grantedBy: "staff",
                grantedAt: now,
                ...(expiresAt ? { expiresAt } : {}),
              },
            },
          },
        );
      await comp();
      await intent();
      expect((await resolve(identity(), nonce)).action).toBe("link");
      // Resolution runs on the fixture clock, not the wall clock.
      await comp(new Date(now.getTime() - 1000));
      expect((await resolve()).action).toBe("reject");
      // A comp below Enterprise doesn't grant SSO.
      await comp(new Date(now.getTime() + 86_400_000));
      await db
        .collection(physicalNames.workspaces)
        .updateOne(
          { _id: workspaceId },
          { $set: { "entitlementOverride.plan": "pro" } },
        );
      expect((await resolve()).action).toBe("reject");
    });
    test("expired, revoked, impersonated or different-account consent cannot bind a subject", async () => {
      await intent();
      await db
        .collection(physicalNames.session)
        .updateOne(
          { _id: sessionId },
          { $set: { createdAt: new Date(now.getTime() - 300001) } },
        );
      expect((await resolve(identity(), nonce)).action).toBe("reject");
      await db
        .collection(physicalNames.session)
        .updateOne(
          { _id: sessionId },
          { $set: { createdAt: now, impersonatedBy: String(otherUser) } },
        );
      expect((await resolve(identity(), nonce)).action).toBe("reject");
      await db
        .collection(physicalNames.session)
        .updateOne({ _id: sessionId }, { $unset: { impersonatedBy: "" } });
      const differentEmail = identity();
      differentEmail.providerUser.email = "other@synthetic.invalid";
      expect(await resolve(differentEmail, nonce)).toEqual({
        action: "reject",
        code: "SSO_LINK_EMAIL_MISMATCH",
      });
      await db.collection(physicalNames.session).deleteOne({ _id: sessionId });
      expect((await resolve(identity(), nonce)).action).toBe("reject");
      expect(
        await db.collection(ssoAuthorityCollections.binding).countDocuments(),
      ).toBe(0);
    });
    test("a single consent cannot concurrently bind different provider subjects", async () => {
      await intent();
      const results = await Promise.all([
        resolve(identity("first-subject"), nonce),
        resolve(identity("second-subject"), nonce),
      ]);
      expect(results.filter((result) => result.action === "link")).toHaveLength(
        1,
      );
      expect(
        await db.collection(ssoAuthorityCollections.binding).countDocuments(),
      ).toBe(1);
      expect(
        await db.collection(ssoAuthorityCollections.intent).countDocuments(),
      ).toBe(0);
    });
    test("concurrent membership removal fences a previously read authorization decision", async () => {
      await intent();
      let first = true;
      let release!: () => void, ready!: () => void;
      const paused = new Promise<void>((resolve) => {
        ready = resolve;
      });
      const continueAfterRemoval = new Promise<void>((resolve) => {
        release = resolve;
      });
      const pending = adapter.transaction(async (database) => {
        const guarded = new Proxy(database, {
          get(target, name, receiver) {
            if (name === "update")
              return async (...args: Parameters<typeof database.update>) => {
                if (first) {
                  first = false;
                  ready();
                  await continueAfterRemoval;
                }
                return target.update(...args);
              };
            return Reflect.get(target, name, receiver);
          },
        });
        return resolveWorkspaceSsoIdentity(
          identity(),
          { database: guarded },
          nonce,
          now,
        );
      });
      await paused;
      await db
        .collection(physicalNames.workspace_members)
        .deleteMany({ workspaceId });
      release();
      expect((await pending).action).toBe("reject");
      expect(
        await db.collection(ssoAuthorityCollections.binding).countDocuments(),
      ).toBe(0);
      expect(
        await db.collection(ssoAuthorityCollections.intent).countDocuments(),
      ).toBe(1);
    });
    test("failed finalization rolls back binding, consent consumption and authority writes", async () => {
      await intent();
      await expect(
        adapter.transaction(async (database) => {
          expect(
            (
              await resolveWorkspaceSsoIdentity(
                identity(),
                { database },
                nonce,
                now,
              )
            ).action,
          ).toBe("link");
          throw Error("synthetic finalization failure");
        }),
      ).rejects.toThrow("synthetic finalization failure");
      expect(
        await db.collection(ssoAuthorityCollections.binding).countDocuments(),
      ).toBe(0);
      expect(
        await db.collection(ssoAuthorityCollections.intent).countDocuments(),
      ).toBe(1);
      expect(
        (
          await db
            .collection(physicalNames.workspaces)
            .findOne({ _id: workspaceId })
        )?.authFence,
      ).toBeUndefined();
      // The canonical member user ID remains a string throughout adapter access.
      expect(
        (
          await db
            .collection(physicalNames.workspace_members)
            .findOne({ workspaceId })
        )?.userId,
      ).toBe(String(userId));
    });
  },
);
