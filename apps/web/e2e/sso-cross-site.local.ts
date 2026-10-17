import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { getServers, setServers } from "node:dns/promises";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright-core";
import { MongoClient, ObjectId } from "mongodb";
import { z } from "zod";
import { createAuth } from "../../../packages/auth";
import { physicalNames, closeMongoClient } from "@shortn/db";
import { startSsoTestProvider } from "../../../packages/auth/testing/sso-provider";

const login = z
  .object({
    email: z.string().endsWith("@example.test"),
    password: z.string(),
    userId: z.string(),
  })
  .parse(JSON.parse(await readFile("/tmp/shortn-p6-login.json", "utf8")));
const appOrigin = "https://localhost:3210",
  providerId = "synthetic-cross-site-saml",
  workspaceId = new ObjectId();
const mongoUrl = "mongodb://127.0.0.1:27020/?directConnection=true",
  mongo = await new MongoClient(mongoUrl).connect(),
  db = mongo.db("shortn_p6_dev");
const peer = await startSsoTestProvider({
  email: login.email,
  appOrigin,
  port: 3208,
  tls: true,
});
const servers = getServers();
setServers(["127.0.0.1:53207"]);
const auth = createAuth({
  baseURL: appOrigin,
  secret: randomBytes(48).toString("base64url"),
  production: true,
  trustedOrigins: [appOrigin, peer.origin],
  mongo: { url: mongoUrl, database: db.databaseName },
  polar: { accessToken: "synthetic-unused-token", server: "sandbox" },
  emails: {
    verifyEmail: async () => {},
    emailVerified: async () => {},
    resetPassword: async () => {},
    confirmEmailChange: async () => {},
  },
});
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 3210,
  tls: { key: peer.tlsPrivateKey, cert: peer.tlsCertificate },
  fetch: (request) =>
    new URL(request.url).pathname.startsWith("/api/auth/")
      ? auth.handler(request)
      : new Response("<!doctype html><title>Synthetic HTTPS SSO test</title>", {
          headers: { "Content-Type": "text/html" },
        }),
});
// Trust only the ephemeral certificates in this isolated browser context. Node's
// certificate validation and the production authentication configuration stay on.
const browser = await chromium.launch({ headless: true }),
  context = await browser.newContext({ ignoreHTTPSErrors: true }),
  page = await context.newPage();
const sessions: ObjectId[] = [];
let ip = 1,
  callbackCookies: string[] | undefined;
async function invoke(path: string, body: Record<string, unknown>) {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": `192.0.2.${ip++}` });
  return page.evaluate(
    async ({ path, body }) => {
      const response = await fetch(`/api/auth${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await response.text();
      return { status: response.status, data: text ? JSON.parse(text) : null };
    },
    { path, body },
  );
}
page.on("request", async (request) => {
  if (
    new URL(request.url()).pathname ===
    `/api/auth/sso/saml2/sp/acs/${providerId}`
  ) {
    assert.equal(request.method(), "POST");
    callbackCookies =
      (await request.allHeaders()).cookie
        ?.split(";")
        .map((entry) => entry.trim().split("=")[0]!) ?? [];
  }
});
try {
  await db
    .collection(physicalNames.workspaces)
    .insertOne({
      _id: workspaceId,
      ownerUserId: login.userId,
      personal: false,
      platformFeatures: { advancedAuth: true },
    });
  await db
    .collection(physicalNames.workspace_members)
    .insertOne({ workspaceId, userId: login.userId, role: "owner" });
  await db
    .collection(physicalNames.subscriptions)
    .insertOne({ workspaceId, plan: "enterprise", status: "active" });
  await page.goto(appOrigin);
  assert.equal(
    (
      await invoke("/sign-in/email", {
        email: login.email,
        password: login.password,
      })
    ).status,
    200,
  );
  const initial = await page.evaluate(async () =>
    (await fetch("/api/auth/get-session")).json(),
  );
  sessions.push(new ObjectId(initial.session.id));
  const registered = await invoke("/sso/register", {
    providerId,
    workspaceId: String(workspaceId),
    displayName: "Synthetic cross-site SAML",
    domain: "example.test",
    issuer: appOrigin + "/saml/sp",
    samlConfig: {
      issuer: appOrigin + "/saml/sp",
      entryPoint: peer.origin + "/saml/sso",
      idpMetadata: { metadata: peer.samlMetadata },
      mapping: { email: "email", name: "email" },
    },
  });
  assert.equal(registered.status, 200, JSON.stringify(registered.data));
  peer.setProof(
    `_shortn-sso-${providerId}.example.test`,
    registered.data.domainVerificationToken,
  );
  assert.equal(
    (await invoke("/sso/verify-domain", { providerId })).status,
    204,
  );
  assert.equal(
    (await invoke("/shortn/sso/link-intent", { providerId })).status,
    200,
  );
  const started = await invoke("/sign-in/sso", {
    providerId,
    providerType: "saml",
    callbackURL: appOrigin + "/cross-site-done",
  });
  assert.equal(started.status, 200);
  const cookies = await context.cookies(appOrigin + "/api/auth/sign-in/sso");
  for (const name of [
    "__Secure-shortn_sso_link",
    "__Secure-shortn_auth_.relay_state",
  ]) {
    const cookie = cookies.find((entry) => entry.name === name);
    assert(cookie, `Missing ${name}`);
    assert.equal(cookie.secure, true);
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.sameSite, "None");
  }
  await page.goto(started.data.url);
  await page.waitForURL(appOrigin + "/cross-site-done");
  assert(callbackCookies?.includes("__Secure-shortn_sso_link"));
  assert(callbackCookies?.some((name) => name.endsWith("relay_state")));
  assert(
    !callbackCookies?.some((name) => name.endsWith("session_token")),
    "Lax session cookie must be absent on a cross-site POST",
  );
  const session = await page.evaluate(async () =>
    (await fetch("/api/auth/get-session")).json(),
  );
  assert.equal(session.user.id, login.userId);
  assert.equal(session.session.ssoWorkspaceId, String(workspaceId));
  console.log(
    "Cross-site HTTPS SAML POST sends Secure/None relay and linking cookies, omits Lax session cookie, and creates a verified bound session",
  );
} finally {
  await db
    .collection(physicalNames.session)
    .deleteMany({ _id: { $in: sessions } });
  const provider = await db
    .collection(physicalNames.sso_providers)
    .findOne({ workspaceId });
  await db
    .collection(physicalNames.session)
    .deleteMany({
      userId: new ObjectId(login.userId),
      ...(provider
        ? { ssoProviderId: String(provider._id) }
        : { ssoWorkspaceId: String(workspaceId) }),
    });
  await db.collection(physicalNames.account).deleteMany({ providerId });
  for (const name of [
    physicalNames.sso_bindings,
    physicalNames.sso_link_intents,
    physicalNames.sso_providers,
    physicalNames.workspace_members,
    physicalNames.subscriptions,
  ])
    await db.collection(name).deleteMany({ workspaceId });
  await db.collection(physicalNames.workspaces).deleteOne({ _id: workspaceId });
  await browser.close();
  server.stop(true);
  await peer.stop();
  setServers(servers);
  await closeMongoClient();
  await mongo.close();
}
