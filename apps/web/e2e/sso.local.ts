import { createHash } from "node:crypto";
import { strict as assert } from "node:assert";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";
import { MongoClient, ObjectId } from "mongodb";
import { physicalNames } from "@shortn/db";
import { z } from "zod";
import { startSsoTestProvider } from "../../../packages/auth/testing/sso-provider";

const login = z
  .object({
    origin: z.literal("http://localhost:3200"),
    email: z.string(),
    password: z.string(),
    userId: z.string(),
    workspaceId: z.string(),
    workspace: z.string(),
  })
  .parse(JSON.parse(await readFile("/tmp/shortn-p6-login.json", "utf8")));
const mongo = await new MongoClient(
    "mongodb://127.0.0.1:27020/?directConnection=true",
  ).connect(),
  db = mongo.db("shortn_p6_dev");
const idp = await startSsoTestProvider({
  email: login.email,
  appOrigin: login.origin,
});
const browser = await chromium.launch({ headless: true }),
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  }),
  page = await context.newPage();
const directory =
    process.env.SSO_CAPTURE_DIR ?? ".impeccable/review/p6-sso/first",
  captures: object[] = [],
  pageErrors: string[] = [];
const workspaceId = new ObjectId(),
  userId = new ObjectId(login.userId),
  slug = `sso-${workspaceId.toHexString().slice(-8)}`,
  settingsPath = `/${slug}/settings/sso`,
  accountPath = `/${slug}/settings/account/sign-in`;
const providerIds: string[] = [];
const viewerId = new ObjectId(),
  viewerEmail = `viewer-${viewerId.toHexString().slice(-6)}@example.test`;
const oauthClients: string[] = [];
const callback = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: () => new Response("Synthetic SSO OAuth callback"),
});
let ip = 90;
const freshIp = () =>
  context.setExtraHTTPHeaders({ "x-forwarded-for": `198.51.100.${ip++}` });
page.on("pageerror", (error) => pageErrors.push(error.message));
async function capture(name: string, width: number, ready = "#sso-providers") {
  if (process.env.SSO_NO_CAPTURES === "1") return;
  await page.setViewportSize({ width, height: 1000 });
  await page.locator(ready).waitFor();
  await page.evaluate(() => document.fonts.ready);
  const height = await page.evaluate(() => {
    let extra = 0;
    for (const node of document.querySelectorAll<HTMLElement>("*"))
      if (
        ["auto", "scroll"].includes(getComputedStyle(node).overflowY) &&
        node.clientHeight > 0
      ) {
        node.scrollTop = 0;
        extra = Math.max(extra, node.scrollHeight - node.clientHeight);
      }
    window.scrollTo(0, 0);
    return Math.ceil(1000 + extra + (extra ? 80 : 0));
  });
  if (height > 1000) await page.setViewportSize({ width, height });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  const file = `${directory}/${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  captures.push({
    file,
    width,
    viewportHeight: height,
    route: new URL(page.url()).pathname,
  });
}
async function passwordLogin(next = settingsPath, email = login.email) {
  await freshIp();
  await page.goto(`${login.origin}/login?next=${encodeURIComponent(next)}`);
  await page.locator('input[name="identifier"]').fill(email);
  await page.locator('input[name="password"]').fill(login.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname === next);
}
async function signOut() {
  await page.evaluate(async () => {
    const response = await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!response.ok) throw Error("Synthetic sign-out failed");
  });
}
async function verifyDns() {
  await page.locator("#sso-dns").waitFor();
  const values = await page.locator("#sso-dns dd").allTextContents();
  assert.equal(values.length, 2);
  idp.setProof(values[0]!.trim(), values[1]!.trim());
  await freshIp();
  await page
    .getByRole("button", { name: "Verify domain", exact: true })
    .click();
  await page
    .getByText("Domain verified. Members can now connect their accounts.", {
      exact: true,
    })
    .waitFor();
}
async function connectProvider(name: string) {
  await page.goto(login.origin + accountPath);
  await page.locator("#sso-connections").waitFor();
  await page
    .getByRole("button", { name: `Connect ${name}`, exact: true })
    .click();
  await freshIp();
  await page
    .getByRole("button", {
      name: "Agree and continue to provider",
      exact: true,
    })
    .click();
  await page.waitForURL((url) => url.pathname === accountPath);
  await page
    .locator("#sso-connections")
    .getByRole("button", { name: `Disconnect ${name}`, exact: true })
    .waitFor();
}
try {
  await mkdir(directory, { recursive: true });
  const now = new Date();
  await db
    .collection(physicalNames.workspaces)
    .insertOne({
      _id: workspaceId,
      slug,
      name: "P6 Workplace",
      ownerUserId: login.userId,
      personal: false,
      plan: "enterprise",
      addOns: [],
      defaultDomain: "shortn.at",
      platformFeatures: { advancedAuth: true, mcp: true },
      createdAt: now,
      updatedAt: now,
    });
  await db
    .collection(physicalNames.workspace_members)
    .insertOne({
      workspaceId,
      userId: login.userId,
      role: "owner",
      createdAt: now,
      updatedAt: now,
    });
  await db
    .collection(physicalNames.subscriptions)
    .insertOne({
      workspaceId,
      plan: "enterprise",
      status: "active",
      polarSubscriptionId: `synthetic-sso-${workspaceId}`,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 86400000),
      cancelAtPeriodEnd: false,
    });
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", url: login.origin },
  ]);
  await passwordLogin();
  await page.locator("#sso-providers").waitFor();
  await capture("owner-empty-en-light-1440", 1440);
  await capture("owner-empty-en-light-390", 390);
  await page.goto(`${login.origin}/${login.workspace}/settings/sso`);
  await page
    .getByText("SSO is available in Enterprise team workspaces.", {
      exact: true,
    })
    .waitFor();
  await capture("personal-gate-en-light-390", 390);
  await page.goto(login.origin + settingsPath);
  await page
    .getByRole("button", { name: "Add identity provider", exact: true })
    .click();
  await page.locator('input[name="ssoName"]').fill("Workforce OIDC");
  await page.locator('input[name="ssoDomain"]').fill("example.test");
  await page.locator('input[name="ssoIssuer"]').fill(idp.issuer);
  await page.locator('input[name="ssoClientId"]').fill("synthetic-client");
  await page
    .locator('input[name="ssoClientSecret"]')
    .fill("synthetic-oidc-secret");
  await capture("oidc-form-en-light-1440", 1440, "#sso-create");
  await capture("oidc-form-en-light-390", 390, "#sso-create");
  await freshIp();
  await page
    .getByRole("button", { name: "Create provider", exact: true })
    .click();
  await page.locator("#sso-dns").waitFor();
  const oidc = (await db
    .collection(physicalNames.sso_providers)
    .findOne({ workspaceId, displayName: "Workforce OIDC" }))!;
  assert(oidc);
  providerIds.push(oidc.providerId);
  assert(oidc.oidcConfig.startsWith("shortn-sso:v1:"));
  await freshIp();
  await page
    .getByRole("button", { name: "Verify domain", exact: true })
    .click();
  await page
    .getByText(
      "The DNS record could not be verified. Check its name and value, allow time for DNS updates, and try again.",
      { exact: true },
    )
    .waitFor();
  await capture("dns-error-en-light-390", 390, "#sso-dns");
  await verifyDns();
  await connectProvider("Workforce OIDC");
  await page.goto(login.origin + settingsPath);
  await page
    .getByRole("button", { name: "Add identity provider", exact: true })
    .click();
  await page.getByRole("radio", { name: "SAML 2.0", exact: true }).check();
  await page.locator('input[name="ssoName"]').fill("Workforce SAML");
  await page.locator('input[name="ssoDomain"]').fill("example.test");
  await page.locator('textarea[name="ssoMetadata"]').fill(idp.samlMetadata);
  await capture("saml-form-en-light-1440", 1440, "#sso-create");
  await capture("saml-form-en-light-390", 390, "#sso-create");
  await freshIp();
  await page
    .getByRole("button", { name: "Create provider", exact: true })
    .click();
  await page.locator("#sso-dns").waitFor();
  const saml = (await db
    .collection(physicalNames.sso_providers)
    .findOne({ workspaceId, displayName: "Workforce SAML" }))!;
  assert(saml);
  providerIds.push(saml.providerId);
  await capture("dns-record-en-light-390", 390, "#sso-dns");
  await verifyDns();
  await page.goto(login.origin + accountPath);
  await page
    .getByRole("button", { name: "Connect Workforce SAML", exact: true })
    .click();
  await capture("member-consent-en-light-390", 390, "#sso-connections");
  await capture("member-consent-en-light-1440", 1440, "#sso-connections");
  await freshIp();
  await page
    .getByRole("button", {
      name: "Agree and continue to provider",
      exact: true,
    })
    .click();
  await page.waitForURL((url) => url.pathname === accountPath);
  await page
    .getByRole("button", { name: "Disconnect Workforce SAML", exact: true })
    .waitFor();
  const session = await page.evaluate(async () =>
    (await fetch("/api/auth/get-session")).json(),
  );
  assert.equal(session.session.ssoProviderId, String(saml._id));
  await signOut();
  const credential = (await db
    .collection(physicalNames.account)
    .findOne({ userId, providerId: "credential" }))!;
  await db
    .collection(physicalNames.user)
    .insertOne({
      _id: viewerId,
      name: "P6 Viewer",
      email: viewerEmail,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
  await db
    .collection(physicalNames.account)
    .insertOne({
      userId: viewerId,
      accountId: String(viewerId),
      providerId: "credential",
      password: credential.password,
      createdAt: now,
      updatedAt: now,
    });
  await db
    .collection(physicalNames.workspace_members)
    .insertOne({
      workspaceId,
      userId: String(viewerId),
      role: "viewer",
      createdAt: now,
      updatedAt: now,
    });
  await passwordLogin(settingsPath, viewerEmail);
  await page
    .getByText("Only the workspace owner can configure identity providers.", {
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Add identity provider", exact: true })
      .count(),
    0,
  );
  await capture("viewer-gate-en-light-390", 390);
  idp.setEmail(viewerEmail);
  await connectProvider("Workforce OIDC");
  const viewerSession = await page.evaluate(async () =>
    (await fetch("/api/auth/get-session")).json(),
  );
  assert.equal(viewerSession.user.id, String(viewerId));
  assert.equal(viewerSession.session.ssoProviderId, String(oidc._id));
  await capture("viewer-connected-en-light-390", 390, "#sso-connections");
  await signOut();
  idp.setEmail(login.email);
  await passwordLogin();
  const active = await page.evaluate(async () =>
    (await fetch("/api/auth/get-session")).json(),
  );
  await db
    .collection(physicalNames.session)
    .updateOne(
      { _id: new ObjectId(active.session.id) },
      { $set: { createdAt: new Date(Date.now() - 360000) } },
    );
  await page
    .getByRole("button", { name: "Add identity provider", exact: true })
    .click();
  await page.locator('input[name="ssoName"]').fill("Freshness check");
  await page.locator('input[name="ssoDomain"]').fill("example.test");
  await page.locator('input[name="ssoIssuer"]').fill(idp.issuer);
  await page.locator('input[name="ssoClientId"]').fill("synthetic-client");
  await page
    .locator('input[name="ssoClientSecret"]')
    .fill("synthetic-oidc-secret");
  await freshIp();
  await page
    .getByRole("button", { name: "Create provider", exact: true })
    .click();
  await page
    .getByText("Sign in again before changing workplace SSO.", { exact: true })
    .waitFor();
  await capture("owner-fresh-error-en-light-390", 390, "#sso-create");
  await db
    .collection(physicalNames.session)
    .updateOne(
      { _id: new ObjectId(active.session.id) },
      { $set: { createdAt: new Date(active.session.createdAt) } },
    );
  await page.reload();
  const synthetic = Array.from({ length: 23 }, (_, index) => ({
    _id: new ObjectId(),
    workspaceId,
    userId,
    providerId: `synthetic-sso-page-${index}`,
    displayName:
      index === 0
        ? "Recognizable identity provider name with a deliberately long label".slice(
            0,
            64,
          )
        : `Synthetic provider ${index + 1}`,
    domain: "example.test",
    domainVerified: true,
    identityIssuer: idp.issuer,
    oidcConfig: "synthetic-non-authenticating",
    createdAt: now,
  }));
  await db.collection(physicalNames.sso_providers).insertMany(synthetic);
  await page.reload();
  await page.locator("#sso-providers").waitFor();
  assert.equal(await page.locator("#sso-providers li").count(), 10);
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await page.getByText("Page 2 of 3", { exact: true }).waitFor();
  assert.equal(await page.locator("#sso-providers li").count(), 10);
  await capture("owner-pagination-en-light-390", 390);
  const discovery = await page.evaluate(
    async (slug) =>
      (
        await fetch(`/api/auth/shortn/sso/discover?workspace=${slug}&page=3`)
      ).json(),
    slug,
  );
  assert.equal(discovery.rows.length, 5);
  assert.equal(discovery.total, 25);
  assert(
    discovery.rows.every(
      (row: Record<string, unknown>) =>
        !("oidcConfig" in row) && !("samlConfig" in row),
    ),
  );
  await db
    .collection(physicalNames.sso_providers)
    .deleteMany({ _id: { $in: synthetic.map((row) => row._id) } });

  for (const locale of ["en", "pt", "es"])
    for (const theme of ["light", "dark"]) {
      await context.addCookies([
        { name: "NEXT_LOCALE", value: locale, url: login.origin },
      ]);
      await page.evaluate(
        (value) => localStorage.setItem("theme", value),
        theme,
      );
      await page.goto(login.origin + settingsPath);
      await page.locator("#sso-providers").waitFor();
      await page.waitForFunction(
        (value) =>
          document.documentElement.classList.contains("dark") ===
          (value === "dark"),
        theme,
      );
      for (const width of [1440, 390])
        await capture(`owner-verified-${locale}-${theme}-${width}`, width);
    }
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", url: login.origin },
  ]);
  await page.goto(login.origin + accountPath);
  await capture("member-connected-en-dark-390", 390, "#sso-connections");
  await capture("member-connected-en-dark-1440", 1440, "#sso-connections");
  await signOut();
  await page.goto(login.origin + "/login");
  await page
    .getByRole("link", { name: "Sign in with workplace SSO", exact: true })
    .click();
  await page.locator('input[name="ssoWorkspace"]').fill(slug);
  await freshIp();
  await page
    .getByRole("button", { name: "Find identity providers", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Workforce OIDC OIDC", exact: true })
    .waitFor();
  await capture(
    "login-provider-en-dark-1440",
    1440,
    'input[name="ssoWorkspace"]',
  );
  await capture(
    "login-provider-en-dark-390",
    390,
    'input[name="ssoWorkspace"]',
  );
  await freshIp();
  await page
    .getByRole("button", { name: "Workforce OIDC OIDC", exact: true })
    .click();
  await page.waitForURL(
    (url) => url.pathname !== "/login/sso" && url.origin === login.origin,
  );
  assert(!new URL(page.url()).pathname.startsWith("/login"));
  await signOut();
  await page.goto(
    `${login.origin}/login/sso?next=${encodeURIComponent(accountPath)}`,
  );
  await page.locator('input[name="ssoWorkspace"]').fill(slug);
  await freshIp();
  await page
    .getByRole("button", { name: "Find identity providers", exact: true })
    .click();
  await freshIp();
  await page
    .getByRole("button", { name: "Workforce SAML SAML", exact: true })
    .click();
  await page.waitForURL((url) => url.pathname === accountPath);
  await page.locator("#sso-connections").waitFor();
  for (const protocol of ["OIDC", "SAML"]) {
    await signOut();
    const redirect = `http://127.0.0.1:${callback.port}/callback`,
      resource = "http://localhost:3203/mcp",
      verifier = "synthetic-sso-pkce-verifier-".repeat(3);
    const registration = await fetch(
      `${login.origin}/api/auth/oauth2/register`,
      {
        method: "POST",
        headers: {
          Origin: login.origin,
          "Content-Type": "application/json",
          "x-forwarded-for": `203.0.113.${ip++}`,
        },
        body: JSON.stringify({
          application_type: "native",
          client_name: `Synthetic SSO ${protocol} MCP client`,
          redirect_uris: [redirect],
          grant_types: ["authorization_code"],
          response_types: ["code"],
          token_endpoint_auth_method: "none",
        }),
      },
    );
    assert.equal(registration.status, 201);
    const clientId = (await registration.json()).client_id;
    oauthClients.push(clientId);
    const query = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
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
    await page
      .getByRole("link", { name: "Sign in with workplace SSO", exact: true })
      .click();
    if (protocol === "SAML") {
      await page.waitForURL((url) => url.pathname === "/login/sso");
      const failed = new URL(page.url());
      failed.searchParams.set("error", "SSO_ACCOUNT_NOT_CONNECTED");
      await page.goto(failed.href);
      await page.locator('input[name="ssoWorkspace"]').waitFor();
    }
    await page.locator('input[name="ssoWorkspace"]').fill(slug);
    await freshIp();
    await page
      .getByRole("button", { name: "Find identity providers", exact: true })
      .click();
    await freshIp();
    await page
      .getByRole("button", {
        name: `Workforce ${protocol} ${protocol}`,
        exact: true,
      })
      .click();
    await page.waitForURL((url) => url.pathname === "/auth/mcp/workspace");
    await page
      .locator('select[name="workspace"]')
      .selectOption(String(workspaceId));
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
        "x-forwarded-for": `203.0.113.${ip++}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        redirect_uri: redirect,
        code,
        code_verifier: verifier,
        resource,
      }),
    });
    assert.equal(tokens.status, 200);
    assert.equal(typeof (await tokens.json()).access_token, "string");
    await page.goto(login.origin + accountPath);
    console.log(
      `Signed MCP ${protocol} browser round trip, workspace consent and PKCE exchange passed`,
    );
  }
  await page
    .getByRole("button", { name: "Disconnect Workforce SAML", exact: true })
    .click();
  await capture("disconnect-confirm-en-dark-390", 390, "#sso-connections");
  await freshIp();
  await page
    .getByRole("button", { name: "Disconnect and sign out", exact: true })
    .click();
  await page.waitForURL((url) => url.pathname === "/login");
  assert.equal(
    await db
      .collection(physicalNames.sso_bindings)
      .countDocuments({ userId, providerId: saml.providerId }),
    0,
  );
  assert.equal(
    await db.collection(physicalNames.session).countDocuments({ userId }),
    0,
  );
  await passwordLogin();
  await db
    .collection(physicalNames.workspaces)
    .updateOne(
      { _id: workspaceId },
      { $set: { "platformFeatures.advancedAuth": false } },
    );
  await page.reload();
  await capture("flag-gate-en-dark-390", 390);
  assert.equal(
    await page
      .getByRole("button", { name: "Add identity provider", exact: true })
      .count(),
    0,
  );
  const hidden = await page.evaluate(
    async (slug) =>
      (await fetch(`/api/auth/shortn/sso/discover?workspace=${slug}`)).json(),
    slug,
  );
  assert.equal(hidden.total, 0);
  await db
    .collection(physicalNames.workspaces)
    .updateOne(
      { _id: workspaceId },
      { $set: { "platformFeatures.advancedAuth": true } },
    );
  await db
    .collection(physicalNames.subscriptions)
    .updateOne({ workspaceId }, { $set: { status: "canceled" } });
  await page.reload();
  await capture("enterprise-gate-en-dark-390", 390);
  await page
    .getByRole("button", { name: "Remove Workforce SAML", exact: true })
    .click();
  await capture("remove-confirm-en-dark-390", 390);
  await freshIp();
  await page
    .getByRole("button", { name: "Remove provider", exact: true })
    .click();
  await page.getByText("Provider removed.", { exact: true }).waitFor();
  assert.equal(
    await db
      .collection(physicalNames.sso_providers)
      .countDocuments({ _id: saml._id }),
    0,
  );
  assert.equal(pageErrors.length, 0, pageErrors.join("\n"));
  await writeFile(
    `${directory}/captures.json`,
    JSON.stringify(captures, null, 2) + "\n",
  );
  console.log(
    "Browser owner OIDC/SAML registration, actual DNS proof, explicit connection, signed external login and shared sessions passed",
  );
} catch (error) {
  console.error("Browser page errors:", pageErrors);
  console.error("Page:", page.url());
  console.error(
    "Alerts:",
    await page.locator('[role="alert"]').allTextContents(),
  );
  throw error;
} finally {
  callback.stop(true);
  for (const clientId of oauthClients)
    for (const name of [
      physicalNames.oauth_clients,
      physicalNames.oauth_client_resources,
      physicalNames.oauth_consents,
      physicalNames.oauth_access_tokens,
      physicalNames.oauth_refresh_tokens,
    ])
      await db.collection(name).deleteMany({ clientId });
  const rows = await db
    .collection(physicalNames.sso_providers)
    .find({ workspaceId }, { projection: { _id: 1, providerId: 1 } })
    .toArray();
  await db.collection(physicalNames.sso_bindings).deleteMany({ workspaceId });
  await db
    .collection(physicalNames.sso_link_intents)
    .deleteMany({ workspaceId });
  await db
    .collection(physicalNames.account)
    .deleteMany({
      userId: { $in: [login.userId, userId] },
      providerId: { $in: rows.map((row) => row.providerId) },
    });
  await db
    .collection(physicalNames.session)
    .deleteMany({ ssoProviderId: { $in: rows.map((row) => String(row._id)) } });
  await db
    .collection(physicalNames.session)
    .deleteMany({ userId: { $in: [String(viewerId), viewerId] } });
  await db
    .collection(physicalNames.account)
    .deleteMany({ userId: { $in: [String(viewerId), viewerId] } });
  await db.collection(physicalNames.user).deleteOne({ _id: viewerId });
  await db
    .collection(physicalNames.workspace_members)
    .deleteMany({ userId: String(viewerId) });
  await db
    .collection(physicalNames.workspaces)
    .deleteMany({ ownerUserId: String(viewerId), personal: true });
  await db.collection(physicalNames.sso_providers).deleteMany({ workspaceId });
  await db.collection(physicalNames.subscriptions).deleteMany({ workspaceId });
  await db
    .collection(physicalNames.workspace_members)
    .deleteMany({ workspaceId });
  await db.collection(physicalNames.workspaces).deleteOne({ _id: workspaceId });
  await browser.close();
  await idp.stop();
  await mongo.close();
}
