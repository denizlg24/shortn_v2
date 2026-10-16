import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium, type BrowserContext, type Page } from "playwright-core";
import { MongoClient, ObjectId } from "mongodb";
import { collection, physicalNames } from "@shortn/db";
import { apiScopes } from "@shortn/core";
import { z } from "zod";

const login = z
  .object({
    email: z.string(),
    password: z.string(),
    origin: z.literal("http://localhost:3200"),
    api: z.literal("http://localhost:3203"),
    userId: z.string(),
    workspaceId: z.string(),
  })
  .parse(JSON.parse(await readFile("/tmp/shortn-p6-login.json", "utf8")));
const mongo = await new MongoClient(
    "mongodb://127.0.0.1:27020/?directConnection=true",
  ).connect(),
  db = mongo.db("shortn_p6_dev");
const browser = await chromium.launch({ headless: true }),
  directory = ".impeccable/review/p6-oauth";
await mkdir(directory, { recursive: true });
const captures: object[] = [],
  errors: string[] = [];
const viewerWorkspace = new ObjectId(),
  memberId = new ObjectId();
let clientId: string | undefined;
const callbacks: URL[] = [];
const callback = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: (request) => {
    callbacks.push(new URL(request.url));
    return new Response(
      "<!doctype html><title>Synthetic OAuth callback</title><p>Connection returned to the synthetic app.</p>",
      { headers: { "Content-Type": "text/html" } },
    );
  },
});
const redirectUri = `http://127.0.0.1:${callback.port}/callback/${"newsletter-editorial-".repeat(18)}?source=synthetic`;
const verifier = "synthetic-browser-pkce-verifier-".repeat(3);
const clientName =
  "São João editorial workspace connection — edición semanal — "
    .repeat(5)
    .slice(0, 200);
const path = (url: URL) => url.pathname;
const scope = [...apiScopes, "offline_access"].join(" ");
async function start(
  context: BrowserContext,
  page: Page,
  requestedScope = scope,
) {
  await db
    .collection(physicalNames.session)
    .updateMany(
      { userId: new ObjectId(login.userId) },
      { $unset: { mcpWorkspaceId: "" } },
    );
  const query = new URLSearchParams({
    response_type: "code",
    client_id: clientId!,
    redirect_uri: redirectUri,
    scope: requestedScope,
    state: crypto.randomUUID(),
    resource: `${login.api}/mcp`,
    prompt: "consent",
    code_challenge_method: "S256",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
  });
  await page.goto(`${login.origin}/api/auth/oauth2/authorize?${query}`);
  if (new URL(page.url()).pathname === "/login") {
    await page.locator('input[name="identifier"]').fill(login.email);
    await page.locator('input[name="password"]').fill(login.password);
    await page.locator('button[type="submit"]').click();
  }
  await page.waitForURL((url) => path(url) === "/auth/mcp/workspace");
  await page.locator('select[name="workspace"]').waitFor();
  return context;
}
async function consent(page: Page, workspace = login.workspaceId) {
  await page.locator('select[name="workspace"]').selectOption(workspace);
  await page.locator('button[value="continue"]').click();
  await page.waitForURL((url) => path(url) === "/auth/mcp/consent");
  await page.locator('button[value="allow"]').waitFor();
}
async function capture(page: Page, name: string, width: number) {
  await page.setViewportSize({ width, height: 1000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(
    () => document.documentElement.scrollWidth <= innerWidth,
  );
  const file = `${directory}/${name}.png`;
  const screenshot = await page.screenshot({ path: file, fullPage: true });
  captures.push({
    file,
    width,
    height: screenshot.readUInt32BE(20),
    viewportHeight: 1000,
    route: new URL(page.url()).pathname,
    fullPage: true,
  });
}
try {
  await collection(db, "workspaces").insertOne({
    _id: viewerWorkspace,
    name:
      "Vida Económica — edição editorial internacional — São João — " +
      "workspace ".repeat(12),
    slug: `oauth-viewer-${crypto.randomUUID().slice(0, 8)}`,
    ownerUserId: new ObjectId().toHexString(),
    personal: false,
    platformFeatures: { mcp: true },
    createdAt: new Date(),
  });
  await collection(db, "workspace_members").insertOne({
    _id: memberId,
    workspaceId: viewerWorkspace,
    userId: login.userId,
    role: "viewer",
    createdAt: new Date(),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const registration = await context.request.post(
    `${login.origin}/api/auth/oauth2/register`,
    {
      data: {
        client_name: clientName,
        application_type: "native",
        redirect_uris: [redirectUri],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      },
    },
  );
  assert.equal(registration.status(), 201);
  clientId = z
    .object({ client_id: z.string() })
    .parse(await registration.json()).client_id;
  const metadata = await context.request.get(
    `${login.origin}/.well-known/oauth-authorization-server/api/auth`,
  );
  assert.equal(metadata.status(), 200);
  assert.equal((await metadata.json()).issuer, `${login.origin}/api/auth`);
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", url: login.origin },
  ]);
  await start(context, page);
  assert.equal(
    await page.locator('select[name="workspace"] option').count(),
    3,
  );
  const disclosure = page.locator("details summary");
  await disclosure.focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("details").getAttribute("open"), "");
  assert((await page.locator("details").textContent())?.includes(redirectUri));
  await capture(page, "callback-expanded-en-light-390", 390);
  await disclosure.focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("details").getAttribute("open"), null);
  await page
    .locator('select[name="workspace"]')
    .selectOption(login.workspaceId);
  await page.locator('button[value="continue"]').focus();
  await page.keyboard.press("Enter");
  await page.waitForURL((url) => path(url) === "/auth/mcp/consent");
  assert.equal(
    await page.locator('input[name="workspace"]').inputValue(),
    login.workspaceId,
  );
  await page.locator('button[value="allow"]').click();
  await page.waitForURL((url) => url.origin === new URL(redirectUri).origin);
  const returned = callbacks.at(-1)!;
  assert(returned.searchParams.has("code"));
  const tokensResponse = await fetch(`${login.origin}/api/auth/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      redirect_uri: redirectUri,
      code: returned.searchParams.get("code")!,
      code_verifier: verifier,
      resource: `${login.api}/mcp`,
    }).toString(),
  });
  if (tokensResponse.status !== 200) {
    const error = await tokensResponse.json();
    throw new Error(
      `Token exchange rejected: ${tokensResponse.status} ${error.code ?? error.error ?? "unknown"}`,
    );
  }
  const token = z
    .object({ access_token: z.string() })
    .parse(await tokensResponse.json()).access_token;
  const mcp = await context.request.post(`${login.api}/mcp`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-11-25",
    },
    data: {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "get_usage", arguments: {} },
    },
  });
  assert.equal(mcp.status(), 200);
  assert.equal((await mcp.json()).result.isError, undefined);
  console.log(
    "Browser email login, workspace selection, consent, PKCE exchange and real OAuth MCP call passed",
  );
  await start(context, page);
  const beforeCancel = await db
    .collection(physicalNames.oauth_consents)
    .countDocuments({ clientId });
  await page.locator('button[value="cancel"]').click();
  await page.waitForURL((url) => url.origin === new URL(redirectUri).origin);
  assert.equal(callbacks.at(-1)!.searchParams.get("error"), "access_denied");
  assert.equal(
    await db
      .collection(physicalNames.oauth_consents)
      .countDocuments({ clientId }),
    beforeCancel,
  );
  await start(context, page);
  await consent(page);
  await db
    .collection(physicalNames.session)
    .updateMany(
      { userId: new ObjectId(login.userId) },
      { $set: { mcpWorkspaceId: viewerWorkspace.toHexString() } },
    );
  await page.locator('button[value="allow"]').click();
  await page.locator('form [role="alert"]').waitFor();
  assert.equal(new URL(page.url()).pathname, "/auth/mcp/consent");
  const alertText = await page.locator('form [role="alert"]').textContent();
  assert(alertText?.includes("selection changed"), String(alertText));
  await capture(page, "stale-selection-en-390", 390);
  console.log(
    "Cancel without a selection and stale workspace approval rejection passed",
  );
  // A synthetic empty membership set verifies that only cancellation is enabled.
  const memberships = await collection(db, "workspace_members")
    .find({ userId: login.userId })
    .toArray();
  const detachedUser = new ObjectId().toHexString();
  try {
    await collection(db, "workspace_members").updateMany(
      { _id: { $in: memberships.map((member) => member._id) } },
      { $set: { userId: detachedUser } },
    );
    await page.goto(
      `${login.origin}/auth/mcp/workspace?${new URL(page.url()).searchParams}`,
    );
    assert.equal(await page.locator('select[name="workspace"]').count(), 0);
    assert.equal(
      await page.locator('button[value="continue"]').isDisabled(),
      true,
    );
    await capture(page, "empty-workspace-en-light-390", 390);
    await page.locator('button[value="cancel"]').focus();
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => url.origin === new URL(redirectUri).origin);
    assert.equal(callbacks.at(-1)!.searchParams.get("error"), "access_denied");
  } finally {
    await collection(db, "workspace_members").updateMany(
      {
        _id: { $in: memberships.map((member) => member._id) },
        userId: detachedUser,
      },
      { $set: { userId: login.userId } },
    );
  }
  console.log(
    "Keyboard disclosure, primary submission and empty-workspace cancellation passed",
  );
  for (const locale of ["en", "es", "pt"] as const) {
    await context.addCookies([
      { name: "NEXT_LOCALE", value: locale, url: login.origin },
    ]);
    for (const theme of ["light", "dark"] as const) {
      await page.evaluate(
        (theme) => localStorage.setItem("theme", theme),
        theme,
      );
      await start(context, page);
      for (const width of [1440, 390])
        await capture(page, `${locale}-workspace-${theme}-${width}`, width);
      await consent(page, viewerWorkspace.toHexString());
      for (const width of [1440, 390])
        await capture(page, `${locale}-consent-${theme}-${width}`, width);
      assert(
        await page
          .locator("html")
          .evaluate(
            (element, theme) =>
              element.classList.contains("dark") === (theme === "dark"),
            theme,
          ),
      );
    }
  }
  await page.goto(`${login.origin}/auth/mcp/consent?sig=invalid`);
  await capture(page, "invalid-pt-dark-390", 390);
  assert.equal(await page.locator('button[value="allow"]').count(), 0);
  // A fresh session proves username continuation rather than reusing email login.
  const usernameContext = await browser.newContext();
  const usernamePage = await usernameContext.newPage();
  const query = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "links:read",
    state: crypto.randomUUID(),
    resource: `${login.api}/mcp`,
    code_challenge_method: "S256",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
  });
  await usernamePage.goto(`${login.origin}/api/auth/oauth2/authorize?${query}`);
  await usernamePage.locator('input[name="identifier"]').fill("p6platform");
  await usernamePage.locator('input[name="password"]').fill(login.password);
  await usernamePage.locator('button[type="submit"]').click();
  await usernamePage.waitForURL((url) => path(url) === "/auth/mcp/workspace");
  await usernameContext.close();
  assert.deepEqual(errors, []);
  await writeFile(
    `${directory}/captures.json`,
    JSON.stringify(captures, null, 2),
  );
  console.log(
    `${captures.length} OAuth captures passed localization/theme/mobile overflow checks; username login continuation passed`,
  );
  await context.close();
} finally {
  await browser.close();
  callback.stop(true);
  if (clientId)
    for (const name of [
      physicalNames.oauth_clients,
      physicalNames.oauth_client_resources,
      physicalNames.oauth_consents,
      physicalNames.oauth_access_tokens,
      physicalNames.oauth_refresh_tokens,
    ])
      await db.collection(name).deleteMany({ clientId });
  await collection(db, "workspace_members").deleteOne({ _id: memberId });
  await collection(db, "workspaces").deleteOne({ _id: viewerWorkspace });
  await mongo.close();
}
