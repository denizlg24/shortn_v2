import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { physicalNames } from "./collections";
import { ssoSessionActive } from "./sso-session";

const mongo = process.env.MONGO_TEST_URL;
if (!mongo && process.env.REQUIRE_INTEGRATION === "1")
  throw new Error("MONGO_TEST_URL required");

(mongo ? describe : describe.skip)("SSO session tenant authority", () => {
  let client: MongoClient, db: Db;
  const workspaceId = new ObjectId(),
    providerId = new ObjectId(),
    userId = new ObjectId().toHexString();
  const session = {
    ssoProviderId: providerId.toHexString(),
    ssoWorkspaceId: workspaceId.toHexString(),
  };
  const setOverride = (fields: Record<string, unknown> | null) =>
    db.collection(physicalNames.workspaces).updateOne(
      { _id: workspaceId },
      fields
        ? {
            $set: {
              entitlementOverride: {
                reason: "r",
                grantedBy: "staff",
                grantedAt: new Date(),
                ...fields,
              },
            },
          }
        : { $unset: { entitlementOverride: "" } },
    );

  beforeAll(async () => {
    if (!["127.0.0.1", "localhost"].includes(new URL(mongo!).hostname))
      throw new Error("Loopback Mongo required");
    client = await new MongoClient(mongo!).connect();
    db = client.db(
      `shortn_sso_session_${crypto.randomUUID().replaceAll("-", "")}`,
    );
    await db.collection(physicalNames.workspaces).insertOne({
      _id: workspaceId,
      personal: false,
      platformFeatures: { advancedAuth: true },
    });
    await db
      .collection(physicalNames.workspace_members)
      .insertOne({ workspaceId, userId, role: "member" });
    await db.collection(physicalNames.sso_providers).insertOne({
      _id: providerId,
      workspaceId,
      domainVerified: true,
      providerId: "fixture",
      identityIssuer: "https://idp.example",
    });
    await db.collection(physicalNames.sso_bindings).insertOne({
      providerRecordId: providerId.toHexString(),
      providerId: "fixture",
      workspaceId,
      issuer: "https://idp.example",
      userId: new ObjectId(userId),
      subject: "subject-1",
    });
    await db.collection(physicalNames.account).insertOne({
      userId: new ObjectId(userId),
      providerId: "fixture",
      accountId: "subject-1",
    });
  });
  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
  });

  test("an Enterprise subscription or an unexpired Enterprise comp keeps the session", async () => {
    expect(await ssoSessionActive(db, session, userId)).toBe(false);
    await db.collection(physicalNames.subscriptions).insertOne({
      workspaceId,
      plan: "enterprise",
      status: "active",
    });
    expect(await ssoSessionActive(db, session, userId)).toBe(true);
    await db.collection(physicalNames.subscriptions).deleteMany({});
    await setOverride({ plan: "enterprise" });
    expect(await ssoSessionActive(db, session, userId)).toBe(true);
    await setOverride({
      plan: "enterprise",
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(await ssoSessionActive(db, session, userId)).toBe(false);
    await setOverride({ plan: "pro" });
    expect(await ssoSessionActive(db, session, userId)).toBe(false);
    await setOverride(null);
  });
});
