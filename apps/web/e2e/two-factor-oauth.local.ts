import { strict as assert } from "node:assert";
import { createHash, createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright-core";
import { MongoClient, ObjectId } from "mongodb";
import { physicalNames } from "@shortn/db";
import { z } from "zod";

const login = z
  .object({
    origin: z.literal("http://localhost:3200"),
    api: z.literal("http://localhost:3203"),
    email: z.string(),
    password: z.string(),
    workspaceId: z.string(),
    userId: z.string(),
    workspace: z.string(),
  })
  .parse(JSON.parse(await readFile("/tmp/shortn-p6-login.json", "utf8")));
const mongo = await new MongoClient(
    "mongodb://127.0.0.1:27020/?directConnection=true",
  ).connect(),
  db = mongo.db("shortn_p6_dev");
const browser = await chromium.launch({ headless: true }),
  context = await browser.newContext(),
  page = await context.newPage();
const userId = new ObjectId(login.userId),
  workspaceId = new ObjectId(login.workspaceId),
  previous = await db
    .collection(physicalNames.workspaces)
    .findOne({ _id: workspaceId });
const callback = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: () => new Response("Synthetic second-factor OAuth callback"),
});
const redirect = `http://127.0.0.1:${callback.port}/callback`,
  resource = `${login.api}/mcp`,
  verifier = "synthetic-second-factor-pkce-".repeat(3);
let clientId: string | undefined,
  ip = 170;
const freshIp = () =>
  context.setExtraHTTPHeaders({ "x-forwarded-for": `192.0.2.${ip++}` });
async function invoke(path: string, body: Record<string, unknown>) {
  await freshIp();
  return page.evaluate(
    async ({ path, body }) => {
      const response = await fetch(`/api/auth${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return { status: response.status, data: await response.json() };
    },
    { path, body },
  );
}
function totp(encoded: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
    bits = [...encoded.replace(/=+$/, "")]
      .map((value) => alphabet.indexOf(value).toString(2).padStart(5, "0"))
      .join("");
  const secret = Buffer.from(
    Array.from({ length: Math.floor(bits.length / 8) }, (_, index) =>
      parseInt(bits.slice(index * 8, index * 8 + 8), 2),
    ),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", secret).update(counter).digest(),
    offset = digest[digest.length - 1]! & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
try {
  await db
    .collection(physicalNames.user)
    .updateOne({ _id: userId }, { $set: { twoFactorEnabled: false } });
  await db.collection(physicalNames.two_factor).deleteMany({ userId });
  await db
    .collection(physicalNames.workspaces)
    .updateOne(
      { _id: workspaceId },
      { $set: { "platformFeatures.advancedAuth": true } },
    );
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", url: login.origin },
  ]);
  await freshIp();
  await page.goto(`${login.origin}/login`);
  await page.locator('input[name="identifier"]').fill(login.email);
  await page.locator('input[name="password"]').fill(login.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname !== "/login");
  const setup = await invoke("/two-factor/enable", {
    password: login.password,
  });
  assert.equal(setup.status, 200);
  const secret = new URL(setup.data.totpURI).searchParams.get("secret")!;
  assert.equal(
    (await invoke("/two-factor/verify-totp", { code: totp(secret) })).status,
    200,
  );
  assert.equal((await invoke("/sign-out", {})).status, 200);
  const registration = await fetch(`${login.origin}/api/auth/oauth2/register`, {
    method: "POST",
    headers: {
      Origin: login.origin,
      "Content-Type": "application/json",
      "x-forwarded-for": "192.0.2.220",
    },
    body: JSON.stringify({
      application_type: "native",
      client_name: "Synthetic second-factor MCP client",
      redirect_uris: [redirect],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });
  assert.equal(registration.status, 201);
  clientId = (await registration.json()).client_id;
  const query = new URLSearchParams({
    response_type: "code",
    client_id: clientId!,
    redirect_uri: redirect,
    scope: "links:read",
    resource,
    code_challenge_method: "S256",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
  });
  await freshIp();
  await page.goto(`${login.origin}/api/auth/oauth2/authorize?${query}`);
  await page.waitForURL(
    (url) => url.pathname === "/login" && url.searchParams.has("sig"),
  );
  await page.locator('input[name="identifier"]').fill(login.email);
  await page.locator('input[name="password"]').fill(login.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(
    (url) =>
      url.pathname === "/login/two-factor" && url.searchParams.has("sig"),
  );
  assert.equal(await page.locator('select[name="workspace"]').count(), 0);
  await page
    .getByRole("button", { name: "Use a recovery code", exact: true })
    .click();
  await page.locator('input[name="code"]').fill(setup.data.backupCodes[0]);
  await freshIp();
  await page
    .getByRole("button", { name: "Verify and sign in", exact: true })
    .click();
  await page.waitForURL((url) => url.pathname === "/auth/mcp/workspace");
  await page
    .locator('select[name="workspace"]')
    .selectOption(login.workspaceId);
  await page.locator('button[value="continue"]').click();
  await page.waitForURL((url) => url.pathname === "/auth/mcp/consent");
  await page.locator('button[value="allow"]').click();
  await page.waitForURL(
    (url) =>
      url.origin === new URL(redirect).origin && url.searchParams.has("code"),
  );
  const code = new URL(page.url()).searchParams.get("code")!;
  const tokens = await fetch(`${login.origin}/api/auth/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "x-forwarded-for": "192.0.2.221",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId!,
      redirect_uri: redirect,
      code,
      code_verifier: verifier,
      resource,
    }),
  });
  assert.equal(tokens.status, 200);
  assert.equal(typeof (await tokens.json()).access_token, "string");
  console.log(
    "Browser MCP OAuth preserves its signed request across password and second-factor login, then completes workspace consent and PKCE exchange",
  );
} finally {
  if (clientId)
    for (const name of [
      physicalNames.oauth_clients,
      physicalNames.oauth_client_resources,
      physicalNames.oauth_consents,
      physicalNames.oauth_access_tokens,
      physicalNames.oauth_refresh_tokens,
    ])
      await db.collection(name).deleteMany({ clientId });
  await db
    .collection(physicalNames.workspaces)
    .updateOne(
      { _id: workspaceId },
      { $set: { platformFeatures: previous?.platformFeatures ?? {} } },
    );
  await db
    .collection(physicalNames.user)
    .updateOne({ _id: userId }, { $set: { twoFactorEnabled: false } });
  await db.collection(physicalNames.two_factor).deleteMany({ userId });
  callback.stop(true);
  await browser.close();
  await mongo.close();
}
