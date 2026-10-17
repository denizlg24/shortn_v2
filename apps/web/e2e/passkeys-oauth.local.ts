import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
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
  fetch: () => new Response("Synthetic passkey OAuth callback"),
});
const redirect = `http://127.0.0.1:${callback.port}/callback`,
  resource = `${login.api}/mcp`,
  verifier = "synthetic-passkey-pkce-".repeat(3);
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
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  await page.goto(
    `${login.origin}/${login.workspace}/settings/account/sign-in`,
  );
  await page.locator('input[name="passkeyName"]').fill("Synthetic MCP passkey");
  await freshIp();
  await page.getByRole("button", { name: "Add passkey", exact: true }).click();
  await page
    .getByText("Passkey added. You can use it the next time you sign in.", {
      exact: true,
    })
    .waitFor();
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
      client_name: "Synthetic passkey MCP client",
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
  const passkey = page.getByRole("button", {
    name: "Sign in with a passkey",
    exact: true,
  });
  await passkey.focus();
  await freshIp();
  await page.keyboard.press("Enter");
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
    "Browser MCP OAuth preserves its signed request across verified passkey login, then completes workspace consent and PKCE exchange",
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
  await db
    .collection(physicalNames.passkeys)
    .deleteMany({ userId, name: "Synthetic MCP passkey" });
  callback.stop(true);
  await browser.close();
  await mongo.close();
}
