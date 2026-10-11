import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { mkdir, open, readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { createServer as createMailServer } from "node:http";
import { spawn } from "node:child_process";
import { hashPassword } from "better-auth/crypto";
import { chromium } from "playwright-core";
import { MongoClient, ObjectId } from "mongodb";
import { Redis } from "ioredis";
import {
  createBioPage,
  createLink,
  deleteLinks,
  createQr,
  ensurePersonalWorkspace,
  setLinkUtm,
  type ServiceContext,
} from "@shortn/core";
import { physicalNames } from "@shortn/db";
import { fxKeys } from "@shortn/billing";
import { parseEnv, webEnv, redirectEnv } from "@shortn/env";
import { checkQrDesignAndDownloads } from "./qr.browser-flows";
import { checkAnalyticsBrowser } from "./analytics.browser-flows";
import { checkBulkSelection } from "./selection.browser-flows";
import { checkHandoffAndAddPassword } from "./handoff.browser-flows";
import { checkEmailChange, type CapturedEmail } from "./email.browser-flows";
import {
  checkBillingFailures,
  type BillingRequest,
  type BillingFixture,
} from "./billing.browser-flows";
import { checkQrFilters, checkLinkDetails } from "./parity.browser-flows";
import {
  rejectInvalidUpload,
  uploadFixtureImage,
} from "./uploads.browser-flows";
import {
  S3Client,
  CreateBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  DeleteBucketCommand,
} from "@aws-sdk/client-s3";

// A production build must already exist. This suite never reads .env files,
// and rejects remote dependencies before creating its disposable database.
const appDir = fileURLToPath(new URL("../", import.meta.url));
const mongoUrl =
  process.env.DASHBOARD_MONGO_URL ??
  "mongodb://127.0.0.1:27020/?replicaSet=rs0";
const cacheUrl =
  process.env.DASHBOARD_REDIS_CACHE_URL ?? "redis://127.0.0.1:16380/15";
const durableUrl =
  process.env.DASHBOARD_REDIS_DURABLE_URL ?? "redis://127.0.0.1:16379/15";
for (const value of [mongoUrl, cacheUrl, durableUrl])
  assert(
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(value).hostname),
    "Dashboard checks require local dependencies.",
  );
await readFile(`${appDir}.next/BUILD_ID`, "utf8");
const run = crypto.randomUUID().replaceAll("-", "");
const database = `shortn_dashboard_test_${run}`;
const clientIp = `198.18.${parseInt(run.slice(0, 2), 16)}.${parseInt(run.slice(2, 4), 16)}`;
const port = Number(process.env.DASHBOARD_PORT ?? 3200);
assert(Number.isInteger(port) && port > 0 && port <= 65535);
const origin = `http://localhost:${port}`;
await new Promise<void>((resolve, reject) => {
  const probe = createServer();
  probe.once("error", () =>
    reject(new Error(`Dashboard test port ${port} is occupied.`)),
  );
  probe.listen(port, () => probe.close(() => resolve()));
});
const captureDir = process.env.DASHBOARD_SCREENSHOT_DIR;
const secret = () => randomBytes(32).toString("hex");
const runtime = {
  NODE_ENV: "production",
  MONGODB_URL: mongoUrl,
  MONGODB_DB: database,
  REDIS_CACHE_URL: cacheUrl,
  REDIS_DURABLE_URL: durableUrl,
  BETTER_AUTH_SECRET: secret(),
  BETTER_AUTH_URL: origin,
  LINK_ACCESS_SECRET: secret(),
  CONFIRMATION_TOKEN_SECRET: secret(),
  IP_HASH_SECRET: secret(),
  POLAR_ACCESS_TOKEN: secret(),
  POLAR_ENVIRONMENT: "sandbox",
  RESEND_API_KEY: "re_local_browser_check",
  MAIL_ALLOWLIST: "@example.org",
  PUBLIC_ORIGIN: origin,
  LINK_DOMAIN: "shortn.at",
  BILLING_WRITES: process.argv.includes("--billing-writes") ? "1" : "0",
  S3_ENDPOINT: "http://127.0.0.1:19000",
  S3_REGION: "us-east-1",
  S3_BUCKET: `shortn-browser-${run}`,
  S3_ACCESS_KEY_ID: "shortn-local",
  S3_SECRET_ACCESS_KEY: "shortn-local-development-secret",
};
const objectStore = new S3Client({
  endpoint: runtime.S3_ENDPOINT,
  region: runtime.S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: runtime.S3_ACCESS_KEY_ID,
    secretAccessKey: runtime.S3_SECRET_ACCESS_KEY,
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});
let storageCreated = false;

parseEnv(webEnv, runtime);
const client = await new MongoClient(mongoUrl).connect();
const db = client.db(database);
const cache = new Redis(cacheUrl);
const durable = new Redis(durableUrl);
const fixtureRate = JSON.stringify({
  eurPerUsd: 0.8,
  asOf: new Date().toISOString().slice(0, 10),
});
await cache.set(fxKeys.current, fixtureRate, "EX", 86400);
await cache.set(fxKeys.last, fixtureRate);
await cache.del(fxKeys.refresh);
const logPath = `/tmp/shortn-dashboard-${run}.log`;
const log = await open(logPath, "w");
let server: ReturnType<typeof spawn> | undefined;
let redirectServer: ReturnType<typeof spawn> | undefined;
const spoolPath = `/tmp/shortn-dashboard-${run}-click-spool.ndjson`;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let workspaceId: string | undefined;
const capturedEmails: CapturedEmail[] = [];
const billingRequests: BillingRequest[] = [];
const billingFixture: BillingFixture = {};
const billingServer = createMailServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  billingRequests.push({
    method: request.method ?? "GET",
    path: request.url ?? "/",
    body: JSON.parse(Buffer.concat(chunks).toString() || "{}"),
  });
  if (
    billingFixture.order &&
    request.method === "GET" &&
    request.url?.startsWith("/v1/orders")
  ) {
    if (request.url.endsWith("/invoice") && billingFixture.failInvoice) {
      response.writeHead(401, { "content-type": "application/json" });
      response.end(JSON.stringify({ detail: "Local invoice failure" }));
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify(
        request.url.includes("?")
          ? {
              items: [billingFixture.order],
              pagination: { total_count: 1, max_page: 1 },
            }
          : request.url.endsWith("/invoice")
            ? { url: billingFixture.invoiceUrl }
            : billingFixture.order,
      ),
    );
    return;
  }
  response.writeHead(401, { "content-type": "application/json" });
  response.end(
    JSON.stringify({ detail: "Local browser provider failure fixture" }),
  );
});
const mailServer = createMailServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  capturedEmails.push(JSON.parse(Buffer.concat(chunks).toString()));
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ id: crypto.randomUUID() }));
});
try {
  await new Promise<void>((resolve) =>
    billingServer.listen(0, "127.0.0.1", resolve),
  );
  const billingAddress = billingServer.address();
  assert(billingAddress && typeof billingAddress !== "string");
  const billingOrigin = `http://127.0.0.1:${billingAddress.port}`;
  billingFixture.invoiceUrl = "https://billing.example.org/invoice.pdf";
  await new Promise<void>((resolve) =>
    mailServer.listen(0, "127.0.0.1", resolve),
  );
  const mailAddress = mailServer.address();
  assert(mailAddress && typeof mailAddress !== "string");
  const mailOrigin = `http://127.0.0.1:${mailAddress.port}`;
  await objectStore.send(
    new CreateBucketCommand({ Bucket: runtime.S3_BUCKET }),
  );
  storageCreated = true;
  const userId = new ObjectId();
  const email = `dashboard-${run}@example.org`;
  const password = `Browser-check-${secret()}`;
  const now = new Date();
  await db.collection(physicalNames.user).insertOne({
    _id: userId,
    name: "Dashboard checks",
    username: "dashboardchecks",
    displayUsername: "dashboardchecks",
    email,
    emailVerified: true,
    image: null,
    sub: `authS|${run}`,
    createdAt: now,
    updatedAt: now,
  });
  await db.collection(physicalNames.account).insertOne({
    _id: new ObjectId(),
    userId,
    accountId: userId.toHexString(),
    providerId: "credential",
    password: await hashPassword(password),
    createdAt: now,
    updatedAt: now,
  });
  const workspace = await ensurePersonalWorkspace(db, {
    id: userId.toHexString(),
    name: "Dashboard checks",
    username: "dashboardchecks",
    email,
    sub: `authS|${run}`,
  });
  workspaceId = workspace._id.toHexString();
  const memberId = new ObjectId();
  await db.collection(physicalNames.user).insertOne({
    _id: memberId,
    name: "Member fixture",
    email: `member-${run}@example.org`,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  await db.collection(physicalNames.workspace_members).insertOne({
    _id: new ObjectId(),
    workspaceId: workspace._id,
    userId: memberId.toHexString(),
    role: "viewer",
    joinedAt: now,
  });
  await db.collection(physicalNames.subscriptions).insertOne({
    workspaceId: workspace._id,
    polarSubscriptionId: run,
    polarCustomerId: "00000000-0000-4000-8000-000000000003",
    status: "active",
    plan: "pro",
    currentPeriodStart: now,
    currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
    cancelAtPeriodEnd: false,
  });
  await db.collection(physicalNames.workspace_invites).insertOne({
    workspaceId: workspace._id,
    email: `pending-${run}@example.org`,
    role: "viewer",
    tokenHash: randomBytes(32).toString("hex"),
    invitedBy: userId.toHexString(),
    expiresAt: new Date(now.getTime() + 7 * 86400000),
    createdAt: now,
    updatedAt: now,
  });
  const ctx: ServiceContext = {
    db,
    cache,
    workspace,
    actor: { userId: userId.toHexString(), role: "owner" },
    linkDomain: "shortn.at",
  };
  const link = await createLink(ctx, {
    url: "https://example.org/dashboard",
    title: "Dashboard fixture",
    tags: ["Newsletter", "Print"],
  });
  assert(link.ok);
  assert(
    (
      await setLinkUtm(ctx, link.value.id, [
        { source: "newsletter", medium: "email", campaign: "Autumn" },
      ])
    ).ok,
  );
  const campaign = await db
    .collection(physicalNames.campaigns)
    .findOne({ workspaceId: workspace._id });
  assert(campaign);
  const bioLinkKey = `bio-${run}-long-custom-key-for-mobile`;
  const secondBioLink = await createLink(ctx, {
    url: "https://example.org/second-bio",
    key: bioLinkKey,
    title: "Second bio link",
  });
  assert(secondBioLink.ok);
  const qr = await createQr(ctx, {
    url: link.value.url,
    title: "QR fixture",
    tags: ["Print", "Event"],
    attachToLinkId: link.value.id,
  });
  assert(qr.ok);
  const bio = await createBioPage(ctx, {
    slug: `fixture-${run.slice(0, 12)}`,
    title: "Bio fixture",
    linkId: link.value.id,
  });
  assert(bio.ok);
  const env = {
    ...process.env,
    ...Object.fromEntries(Object.keys(webEnv.shape).map((key) => [key, ""])),
    ...runtime,
    RESEND_BASE_URL: mailOrigin,
    SHORTN_TEST_POLAR_RECEIVER: billingOrigin,
    NEXT_PUBLIC_APP_URL: origin,
    WEB_ASSET_ORIGIN: "",
  };
  server = spawn(
    "node",
    [
      "--import",
      fileURLToPath(new URL("./fixtures/polar-fetch.mjs", import.meta.url)),
      "node_modules/next/dist/bin/next",
      "start",
      "--port",
      String(port),
    ],
    { cwd: appDir, env, stdio: ["ignore", log.fd, log.fd], detached: true },
  );
  let exited = false;
  server.once("exit", () => {
    exited = true;
  });
  for (let attempt = 0; ; attempt++) {
    assert(!exited, `Dashboard server exited. See ${logPath}`);
    try {
      if ((await fetch(`${origin}/api/health`)).ok) break;
    } catch {
      /* Starting. */
    }
    assert(
      attempt < 60,
      `Dashboard server did not become healthy. See ${logPath}`,
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    extraHTTPHeaders: { "x-forwarded-for": clientIp },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin
      ? route.continue()
      : route.abort(),
  );
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) =>
    errors.push(`${page.url()}: ${error.message}`),
  );
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().includes("net::ERR_FAILED") &&
      !(
        message.location().url.includes("/api/uploads/") &&
        /status of (400|401|403|413|502|503)/.test(message.text())
      )
    )
      errors.push(`${page.url()}: ${message.text()}`);
  });
  await page.goto(`${origin}/login`);
  await page.locator('input[name="identifier"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(`**/${workspace.slug}/links`);
  const uploadDenials = await page.evaluate(async (slug) => {
    const unauthenticated = await fetch(
      `/api/uploads/${slug}?purpose=bio-image`,
      {
        method: "POST",
        credentials: "omit",
      },
    );
    const foreign = await fetch(
      "/api/uploads/unknown-workspace?purpose=bio-image",
      {
        method: "POST",
      },
    );
    const invalidPurpose = await fetch(`/api/uploads/${slug}?purpose=unknown`, {
      method: "POST",
    });
    return [unauthenticated.status, foreign.status, invalidPurpose.status];
  }, workspace.slug);
  assert.deepEqual(uploadDenials, [401, 403, 400]);
  const base = `/${workspace.slug}`;
  dashboardChecks: {
    const routes = [
      "/links",
      "/links/new",
      `/links/${link.value.id}`,
      ...[
        "analytics",
        "qr",
        "utm",
        "utm/new",
        "utm/0/edit",
        "utm/0/delete",
        "edit",
        "delete",
      ].map((tab) => `/links/${link.value.id}/${tab}`),
      "/analytics",
      "/analytics/countries",
      "/qr",
      "/qr/new",
      `/qr/${qr.value.id}`,
      ...["analytics", "design", "edit", "delete"].map(
        (tab) => `/qr/${qr.value.id}/${tab}`,
      ),
      "/campaigns",
      "/campaigns/new",
      `/campaigns/${campaign._id}`,
      ...["analytics", "builder", "edit", "delete"].map(
        (tab) => `/campaigns/${campaign._id}/${tab}`,
      ),
      "/bio",
      "/bio/new",
      `/bio/${bio.value.id}`,
      ...["profile", "links", "socials", "appearance", "delete"].map(
        (tab) => `/bio/${bio.value.id}/${tab}`,
      ),
      "/settings",
      "/settings/members",
      "/settings/members/invite",
      `/settings/members/${memberId}`,
      `/settings/members/${memberId}/remove`,
      "/settings/billing",
      "/settings/billing/plans",
      "/settings/account",
      ...["email", "password", "sign-in", "sessions"].map(
        (tab) => `/settings/account/${tab}`,
      ),
    ];
    for (const locale of process.argv.includes("--billing-only") ||
    process.argv.includes("--mutations-only")
      ? []
      : ["en", "pt", "es"]) {
      await context.addCookies([
        { name: "NEXT_LOCALE", value: locale, url: origin },
      ]);
      for (const path of routes) {
        const response = await page.goto(`${origin}${base}${path}`);
        assert(response?.ok(), `${locale} ${path}: ${response?.status()}`);
        assert.equal(
          new URL(page.url()).pathname,
          `${base}${path}`,
          `${locale} ${path} redirected unexpectedly`,
        );
        await page.locator("h1").waitFor();
        assert(await page.title(), `${path} has no title`);
        const body = await page.locator("body").innerText();
        if (path === "/settings/members") {
          const headings = {
            en: ["Expires", "Invited by"],
            pt: ["Expira", "Convidado por"],
            es: ["Caduca", "Invitado por"],
          }[locale]!;
          for (const name of headings)
            await page
              .getByRole("columnheader", { name, exact: true })
              .waitFor();
        }
        assert(
          !/MISSING_MESSAGE|FORMATTING_ERROR|Application error|NEXT_INTL_MESSAGE_FALLBACK/.test(
            body,
          ),
          `${locale} ${path}: rendering error`,
        );
        if (
          captureDir &&
          [
            "/links",
            "/analytics",
            "/qr",
            "/campaigns",
            "/bio",
            "/settings/account",
            "/settings/members",
            "/settings/billing/plans",
          ].includes(path)
        ) {
          await mkdir(captureDir, { recursive: true });
          for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 1000 });
            await page
              .waitForFunction(
                () => document.documentElement.scrollWidth <= innerWidth,
              )
              .catch(async (error) => {
                console.error(
                  locale,
                  path,
                  width,
                  await page.evaluate(() =>
                    [...document.querySelectorAll("body *")]
                      .filter((el) => {
                        const rect = el.getBoundingClientRect();
                        return rect.right > innerWidth && rect.width > 0;
                      })
                      .map((el) => ({
                        tag: el.tagName,
                        class: el.className,
                        text: el.textContent?.slice(0, 80),
                        right: el.getBoundingClientRect().right,
                      }))
                      .slice(0, 30),
                  ),
                );
                throw error;
              });
            await page.screenshot({
              path: `${captureDir}/${locale}-${path.replaceAll("/", "_")}-${width}.png`,
              fullPage: true,
              caret: "initial",
            });
          }
          await page.setViewportSize({ width: 1440, height: 1000 });
        }
      }
      console.log(`${locale}: ${routes.length} authenticated pages checked`);
    }
    await context.addCookies([
      { name: "NEXT_LOCALE", value: "en", url: origin },
    ]);
    const go = (path: string) => page.goto(`${origin}${base}${path}`);
    await checkBillingFailures({
      page,
      go,
      db,
      workspaceId: workspace._id,
      userId: userId.toHexString(),
      requests: billingRequests,
      writesEnabled: runtime.BILLING_WRITES === "1",
      captureDir,
      fixture: billingFixture,
    });
    if (process.argv.includes("--billing-only")) break dashboardChecks;
    for (const [key, message] of [
      ["api", "is reserved by Shortn"],
      [link.value.key, "is already taken"],
    ]) {
      await go("/links/new");
      await page
        .locator('input[name="url"]')
        .fill("https://example.org/key-validation");
      await page.locator('input[name="title"]').fill("Preserve this title");
      await page
        .locator('textarea[name="description"]')
        .fill("Preserve this description");
      await page.locator('input[name="key"]').fill(key!);
      await page
        .getByRole("button", { name: "Create link", exact: true })
        .click();
      await page.getByRole("alert").filter({ hasText: message }).waitFor();
      assert(
        (
          await page.getByRole("alert").filter({ hasText: message }).innerText()
        ).includes(key!),
      );
      assert.equal(
        await page.locator('input[name="url"]').inputValue(),
        "https://example.org/key-validation",
      );
      assert.equal(
        await page.locator('input[name="title"]').inputValue(),
        "Preserve this title",
      );
      assert.equal(
        await page.locator('textarea[name="description"]').inputValue(),
        "Preserve this description",
      );
      assert.equal(await page.locator('input[name="key"]').inputValue(), key);
    }
    await page.locator('input[name="key"]').fill(`retry-${run.slice(0, 12)}`);
    await page
      .getByRole("button", { name: "Create link", exact: true })
      .click();
    await page.waitForURL(/\/links\/[a-f0-9]{24}\?created=1$/);
    assert.equal(
      (
        await db
          .collection(physicalNames.links)
          .findOne({ urlCode: `retry-${run.slice(0, 12)}` })
      )?.title,
      "Preserve this title",
    );
    const retryLink = await db
      .collection(physicalNames.links)
      .findOne({ urlCode: `retry-${run.slice(0, 12)}` });
    assert(retryLink);
    assert((await deleteLinks(ctx, [retryLink._id.toHexString()])).ok);
    await checkBulkSelection({ page, go, captureDir });
    await checkQrFilters({ page, go, captureDir });
    await checkLinkDetails({
      page,
      go,
      db,
      linkId: link.value.id,
      creatorId: userId.toHexString(),
      captureDir,
    });
    const ownerMembership = {
      workspaceId: workspace._id,
      userId: userId.toHexString(),
    };
    try {
      await db
        .collection(physicalNames.workspace_members)
        .updateOne(ownerMembership, { $set: { role: "member" } });
      await db
        .collection(physicalNames.links)
        .updateOne(
          { _id: new ObjectId(secondBioLink.value.id) },
          { $set: { createdBy: memberId.toHexString() } },
        );
      await go("/links");
      assert.equal(
        await page
          .locator(`input[name="ids"][value="${secondBioLink.value.id}"]`)
          .count(),
        0,
      );
      assert.equal(
        await page
          .locator(`input[name="ids"][value="${link.value.id}"]`)
          .count(),
        1,
      );
      await page
        .getByRole("checkbox", { name: "Select this page", exact: true })
        .check();
      assert.equal(await page.locator('input[name="ids"]:checked').count(), 1);
      await db
        .collection(physicalNames.workspace_members)
        .updateOne(ownerMembership, { $set: { role: "viewer" } });
      for (const path of ["/links", "/qr"]) {
        await go(path);
        assert.equal(await page.locator('input[name="ids"]').count(), 0);
        assert.equal(
          await page
            .getByRole("button", { name: "Delete selected", exact: true })
            .count(),
          0,
        );
      }
    } finally {
      await db
        .collection(physicalNames.workspace_members)
        .updateOne(ownerMembership, { $set: { role: "owner" } });
      await db
        .collection(physicalNames.links)
        .updateOne(
          { _id: new ObjectId(secondBioLink.value.id) },
          { $set: { createdBy: userId.toHexString() } },
        );
    }
    console.log(
      "Bulk permissions passed: members select only their own links; viewers have no delete selection controls.",
    );
    await checkAnalyticsBrowser({
      page,
      go,
      db,
      workspaceId: workspace._id,
      linkId: link.value.id,
      linkKey: link.value.key,
      secondLinkId: secondBioLink.value.id,
      secondLinkKey: secondBioLink.value.key,
      qrId: qr.value.id,
      qrKey: qr.value.key,
      campaignId: campaign._id.toHexString(),
    });
    const storedLink = () =>
      db
        .collection(physicalNames.links)
        .findOne({ _id: new ObjectId(link.value.id) });
    await go("/links");
    await page.getByText("Pro plan", { exact: true }).waitFor();

    await go("/settings");
    await page.locator('input[name="name"]').fill("Renamed workspace");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.waitForURL("**/settings?saved=1");
    assert.equal(
      (
        await db
          .collection(physicalNames.workspaces)
          .findOne({ _id: workspace._id })
      )?.name,
      "Renamed workspace",
    );

    await go("/settings/account");
    await page.locator('input[name="username"]').fill("updatedusername");
    const accountImage = await uploadFixtureImage(page, "Avatar image");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByText("Saved", { exact: true }).waitFor();
    assert.equal(
      (await db.collection(physicalNames.user).findOne({ _id: userId }))
        ?.username,
      "updatedusername",
    );

    assert.equal(
      (await db.collection(physicalNames.user).findOne({ _id: userId }))?.image,
      accountImage,
    );

    await go(`/links/${link.value.id}/edit`);
    await page.locator('input[name="title"]').fill("Updated link title");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await page.waitForURL(`**/links/${link.value.id}?saved=1`);
    assert.equal((await storedLink())?.title, "Updated link title");

    await go(`/qr/${qr.value.id}/edit`);
    await page.locator('input[name="title"]').fill("Updated QR title");
    await page
      .getByRole("button", { name: "Save details", exact: true })
      .click();
    await page.waitForURL(`**/qr/${qr.value.id}?saved=1`);
    assert.equal(
      (
        await db
          .collection(physicalNames.qr_codes)
          .findOne({ _id: new ObjectId(qr.value.id) })
      )?.title,
      "Updated QR title",
    );

    await checkQrDesignAndDownloads({
      page,
      go,
      id: qr.value.id,
      key: qr.value.publicId || qr.value.key,
      shortUrl: qr.value.shortUrl,
      captureDir,
      setStoredLogo: (url) =>
        db
          .collection(physicalNames.qr_codes)
          .updateOne(
            { _id: new ObjectId(qr.value.id) },
            { $set: { "options.image": url, "design.image": url } },
          ),
      storedOptions: async () =>
        (
          await db
            .collection(physicalNames.qr_codes)
            .findOne({ _id: new ObjectId(qr.value.id) })
        )?.options,
    });

    await go(`/bio/${bio.value.id}/profile`);
    await page.locator('input[name="title"]').fill("Draft before upload");
    const bioAvatar = await uploadFixtureImage(page, "Avatar", async () => {
      await page.locator('input[name="title"]').fill("Updated bio title");
      assert.equal(
        await page
          .getByRole("button", { name: "Save profile", exact: true })
          .isDisabled(),
        true,
      );
    });
    await page
      .getByRole("button", { name: "Save profile", exact: true })
      .click();
    await page.waitForURL(`**/bio/${bio.value.id}?saved=profile`);
    assert.equal(
      (
        await db
          .collection(physicalNames.bio_pages)
          .findOne({ _id: new ObjectId(bio.value.id) })
      )?.title,
      "Updated bio title",
    );

    assert.equal(
      (
        await db
          .collection(physicalNames.bio_pages)
          .findOne({ _id: new ObjectId(bio.value.id) })
      )?.avatarUrl,
      bioAvatar,
    );
    const layoutProblems: string[] = [];
    const captureBio = async (name: string) => {
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.waitForTimeout(150);
        if (captureDir)
          await page.screenshot({
            path: `${captureDir}/bio-${name}-${width}.png`,
            fullPage: true,
            caret: "initial",
          });
        if (
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          )
        )
          layoutProblems.push(`${name}/${width} overflows`);
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    };
    const storedBio = () =>
      db
        .collection(physicalNames.bio_pages)
        .findOne({ _id: new ObjectId(bio.value.id) });
    await go(`/bio/${bio.value.id}/links`);
    await page.getByRole("button", { name: "Add link", exact: true }).click();
    await page
      .getByPlaceholder("Search by key, title or URL")
      .fill("Second bio link");
    await page.getByRole("option").filter({ hasText: bioLinkKey }).click();
    const secondTitle = page.getByRole("textbox", {
      name: `Button text for ${bioLinkKey}`,
      exact: true,
    });
    await secondTitle.fill("A new button title");
    await rejectInvalidUpload(page, `Image for ${bioLinkKey}`);
    assert.equal(await secondTitle.inputValue(), "A new button title");
    const buttonImage = await uploadFixtureImage(
      page,
      `Image for ${bioLinkKey}`,
    );
    await page
      .getByRole("button", { name: "Move A new button title up", exact: true })
      .click();
    const draftLinks = JSON.parse(
      await page.locator('input[name="links"]').inputValue(),
    );
    assert.equal(draftLinks[0].linkId, secondBioLink.value.id);
    assert.equal(
      await page
        .locator("aside [inert]")
        .getByText("A new button title", { exact: true })
        .textContent(),
      "A new button title",
    );
    await captureBio("links");
    await page.getByRole("button", { name: "Save links", exact: true }).click();
    await page.waitForURL(`**/bio/${bio.value.id}?saved=links`);
    assert.deepEqual(
      (await storedBio())?.links.map((item: { link: ObjectId }) =>
        item.link.toHexString(),
      ),
      [secondBioLink.value.id, link.value.id],
    );
    assert.equal((await storedBio())?.links[0].title, "A new button title");
    assert.equal((await storedBio())?.links[0].image, buttonImage);

    await go(`/bio/${bio.value.id}/socials`);
    await page.getByRole("button", { name: "Add social", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Instagram URL", exact: true })
      .fill("instagram.com/fixture");
    await page.getByRole("button", { name: "Add social", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Platform for social 2", exact: true })
      .click();
    await page.getByRole("option", { name: "GitHub", exact: true }).click();
    await page
      .getByRole("textbox", { name: "GitHub URL", exact: true })
      .fill("github.com/fixture");
    await captureBio("socials");
    await page
      .getByRole("button", { name: "Save socials", exact: true })
      .click();
    await page.waitForURL(`**/bio/${bio.value.id}?saved=socials`);
    assert.deepEqual((await storedBio())?.socials, [
      { platform: "instagram", url: "https://instagram.com/fixture" },
      { platform: "github", url: "https://github.com/fixture" },
    ]);

    await go(`/bio/${bio.value.id}/appearance`);
    await page
      .getByRole("textbox", { name: "Background", exact: true })
      .fill("#123456");
    await page
      .getByRole("radiogroup", { name: "Buttons", exact: true })
      .getByRole("radio", { name: "Pill", exact: true })
      .click();
    await page
      .getByRole("radiogroup", { name: "Header", exact: true })
      .getByRole("radio", { name: "Left", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Header colour", exact: true })
      .fill("#abcdef");
    assert.equal(
      await page
        .locator("aside [inert] > div")
        .evaluate((element) => getComputedStyle(element).backgroundColor),
      "rgb(18, 52, 86)",
    );
    assert(
      await page.locator("aside [inert]").evaluate((element) => {
        const preview = element.firstElementChild!;
        return (
          preview.getBoundingClientRect().height >=
          element.parentElement!.getBoundingClientRect().height
        );
      }),
      "The draft background fills the phone frame",
    );
    const headerImage = await uploadFixtureImage(page, "Header image");
    await captureBio("appearance");
    await page
      .getByRole("button", { name: "Save appearance", exact: true })
      .click();
    await page.waitForURL(`**/bio/${bio.value.id}?saved=appearance`);
    assert.equal((await storedBio())?.theme.background, "#123456");
    assert.equal((await storedBio())?.theme.buttonStyle, "pill");
    assert.equal((await storedBio())?.theme.header.headerStyle, "left-aligned");
    assert.equal(
      (await storedBio())?.theme.header.headerBackgroundColor,
      "#abcdef",
    );
    assert.equal(
      (await storedBio())?.theme.header.headerBackgroundImage,
      headerImage,
    );
    assert.deepEqual(layoutProblems, []);
    console.log(
      "Bio editing passed: link selection/order/custom titles, validation, socials and appearance.",
    );

    await go(`/campaigns/${campaign._id}/edit`);
    await page
      .locator('input[name="description"]')
      .count()
      .then(async (count) => {
        const field = count
          ? page.locator('input[name="description"]')
          : page.locator('textarea[name="description"]');
        await field.fill("Updated campaign description");
      });
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await page.waitForURL(`**/campaigns/${campaign._id}?saved=1`);
    assert.equal(
      (
        await db
          .collection(physicalNames.campaigns)
          .findOne({ _id: campaign._id })
      )?.description,
      "Updated campaign description",
    );

    await go(`/links/${link.value.id}/utm/0/edit`);
    await page.locator('input[name="source"]').fill("partner");
    await page
      .getByRole("button", { name: "Save variant", exact: true })
      .click();
    await page.waitForURL(`**/links/${link.value.id}/utm?saved=1`);
    assert.equal((await storedLink())?.utmLinks[0].source, "partner");
    await page.getByRole("link", { name: "Remove", exact: true }).click();
    await page.getByRole("link", { name: "Cancel", exact: true }).click();
    assert.equal((await storedLink())?.utmLinks.length, 1);
    await page.getByRole("link", { name: "Remove", exact: true }).click();
    await page
      .getByRole("button", { name: "Remove variant", exact: true })
      .click();
    await page.waitForURL(`**/links/${link.value.id}/utm?removed=1`);
    assert.equal((await storedLink())?.utmLinks.length, 0);
    assert.equal(
      await db
        .collection(physicalNames.campaigns)
        .countDocuments({ _id: campaign._id }),
      0,
    );

    await go("/links/new");
    await page
      .locator('input[name="url"]')
      .fill("https://example.org/created-through-ui");
    await page.locator('input[name="title"]').fill("Created through UI");
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Newsletter", exact: true }).click();
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Create link", exact: true })
      .click();
    await page.waitForURL(/\/links\/[a-f0-9]{24}\?created=1$/);
    const createdLink = await db
      .collection(physicalNames.links)
      .findOne({ workspaceId: workspace._id, title: "Created through UI" });
    assert(createdLink);
    assert.equal(createdLink.tags[0].tagName, "Newsletter");
    const shortUrl = `https://${createdLink.domain}/${createdLink.key}`;
    await page
      .getByRole("button", { name: "Copy short link", exact: true })
      .click();
    assert.equal(
      await page.evaluate(() => navigator.clipboard.readText()),
      shortUrl,
    );
    await page.evaluate(() =>
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: undefined,
      }),
    );
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Link copied" }).waitFor();
    assert.equal(
      await page.evaluate(() => navigator.clipboard.readText()),
      shortUrl,
    );

    await go("/qr/new");
    await page
      .locator('input[name="url"]')
      .fill("https://example.org/qr-through-ui");
    await page.locator('input[name="title"]').fill("Created QR through UI");
    await page
      .getByRole("button", { name: "Create QR code", exact: true })
      .click();
    await page.waitForURL(/\/qr\/[a-f0-9]{24}\?created=1$/);
    assert.equal(
      await db.collection(physicalNames.qr_codes).countDocuments({
        workspaceId: workspace._id,
        title: "Created QR through UI",
      }),
      1,
    );

    await go("/settings/members/invite");
    const invitedEmail = `invited-${run}@example.org`;
    await page.locator('input[name="email"]').fill(invitedEmail);
    await page.locator('input[name="role"][value="viewer"]').check();
    await page
      .getByRole("button", { name: "Send invite", exact: true })
      .click();
    await page.waitForURL("**/settings/members?invited=1");
    assert.equal(
      (
        await db
          .collection(physicalNames.workspace_invites)
          .findOne({ workspaceId: workspace._id, email: invitedEmail })
      )?.role,
      "viewer",
    );
    await go(`/settings/members/${memberId}`);
    await page.locator('input[name="role"][value="member"]').check();
    await page.getByRole("button", { name: "Save role", exact: true }).click();
    await page.waitForURL(`**/settings/members/${memberId}?saved=1`);
    assert.equal(
      (
        await db.collection(physicalNames.workspace_members).findOne({
          workspaceId: workspace._id,
          userId: memberId.toHexString(),
        })
      )?.role,
      "member",
    );
    await go(`/settings/members/${memberId}/remove`);
    await page
      .getByRole("button", { name: "Remove member", exact: true })
      .click();
    await page.waitForURL("**/settings/members?removed=1");
    assert.equal(
      await db.collection(physicalNames.workspace_members).countDocuments({
        workspaceId: workspace._id,
        userId: memberId.toHexString(),
      }),
      0,
    );
    const otherContext = await browser.newContext({
      extraHTTPHeaders: { "x-forwarded-for": clientIp },
    });
    const otherPage = await otherContext.newPage();
    await otherPage.goto(`${origin}/login`);
    await otherPage.locator('input[name="identifier"]').fill(email);
    await otherPage.locator('input[name="password"]').fill(password);
    await otherPage
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await otherPage.waitForURL(`**/${workspace.slug}/links`);
    await go("/settings/account/sessions");
    await page
      .getByRole("button", { name: "Sign out of other sessions", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Sign out of other sessions", exact: true })
      .waitFor({ state: "hidden" });
    assert.equal(
      await db.collection(physicalNames.session).countDocuments({ userId }),
      1,
    );
    await otherPage.goto(`${origin}${base}/links`);
    await otherPage.waitForURL("**/login");

    await go("/settings/account/password");
    const newPassword = `Browser1!${secret()}`;
    await page.locator('input[name="current"]').fill(password);
    await page.locator('input[name="next"]').fill(newPassword);
    await page
      .getByRole("button", { name: "Update password", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "Password updated" })
      .waitFor();
    await otherPage.locator('input[name="identifier"]').fill(email);
    await otherPage.locator('input[name="password"]').fill(newPassword);
    await otherPage
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await otherPage.waitForURL(`**/${workspace.slug}/links`);
    await otherContext.close();
    await checkHandoffAndAddPassword({
      browser,
      db,
      origin,
      captureDir,
      clientIp,
    });
    await checkEmailChange({
      browser,
      db,
      origin,
      emails: capturedEmails,
      authSecret: runtime.BETTER_AUTH_SECRET,
      captureDir,
      clientIp,
    });
    console.log(
      "Authenticated saves passed: workspace, profile, links, QR, bio, campaign, UTM, link/QR creation, copy/share, invites, member roles/removal, passwords and session revocation.",
    );
    assert.deepEqual(errors, []);
    const serverLog = await readFile(logPath, "utf8");
    assert(
      !/MISSING_MESSAGE|INVALID_MESSAGE|FORMATTING_ERROR/.test(serverLog),
      `Translation errors in ${logPath}`,
    );
    console.log("Authenticated dashboard route checks passed.");
    if (process.argv.includes("--public-links")) {
      const redirectPort = Number(process.env.DASHBOARD_REDIRECT_PORT ?? 3202);
      assert(
        Number.isInteger(redirectPort) &&
          redirectPort > 0 &&
          redirectPort <= 65535 &&
          redirectPort !== port,
      );
      await new Promise<void>((resolve, reject) => {
        const probe = createServer();
        probe.once("error", () =>
          reject(
            new Error(`Public flow test port ${redirectPort} is occupied.`),
          ),
        );
        probe.listen(redirectPort, () => probe.close(() => resolve()));
      });
      const redirectOrigin = `http://localhost:${redirectPort}`;
      const redirectRuntime = {
        ...process.env,
        ...Object.fromEntries(
          Object.keys(redirectEnv.shape).map((key) => [key, ""]),
        ),
        ...runtime,
        AUTH_SECRET: secret(),
        PORT: String(redirectPort),
        CLICK_SPOOL_PATH: spoolPath,
      };
      parseEnv(redirectEnv, redirectRuntime);
      redirectServer = spawn(
        process.execPath,
        ["--no-env-file", "src/index.ts"],
        {
          cwd: fileURLToPath(new URL("../../redirect/", import.meta.url)),
          env: redirectRuntime,
          stdio: ["ignore", log.fd, log.fd],
          detached: true,
        },
      );
      let redirectExited = false;
      redirectServer.once("exit", () => {
        redirectExited = true;
      });
      for (let attempt = 0; ; attempt++) {
        assert(!redirectExited, `Redirect exited. See ${logPath}`);
        try {
          if ((await fetch(`${redirectOrigin}/__health`)).ok) break;
        } catch {
          /* Starting. */
        }
        assert(attempt < 60, `Redirect did not become healthy. See ${logPath}`);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      const checks = spawn(
        process.execPath,
        ["--no-env-file", "test", "e2e/link-flows.test.ts"],
        {
          cwd: appDir,
          stdio: "inherit",
          env: {
            ...process.env,
            E2E_WEB: origin,
            E2E_REDIRECT: redirectOrigin,
            E2E_MONGO_URL: mongoUrl,
            E2E_MONGO_DB: database,
            E2E_REDIS_CACHE_URL: cacheUrl,
          },
        },
      );
      const code = await new Promise<number | null>((resolve, reject) => {
        checks.once("exit", resolve);
        checks.once("error", reject);
      });
      assert.equal(code, 0, "Public link flow checks failed");
    }
  }
} finally {
  await new Promise<void>((resolve) => billingServer.close(() => resolve()));
  await new Promise<void>((resolve) => mailServer.close(() => resolve()));
  await browser?.close();
  for (const child of [server, redirectServer])
    if (child?.pid) {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        /* Exited. */
      }
      await Promise.race([
        new Promise((resolve) => child.once("exit", resolve)),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        /* Exited. */
      }
    }
  const workspaceIds = (
    await db
      .collection(physicalNames.workspaces)
      .find({}, { projection: { _id: 1 } })
      .toArray()
  ).map((item) => item._id.toHexString());
  const clicks = await durable.xrange("clicks:stream", "-", "+");
  const ownedClicks = clicks
    .filter(([, fields]) =>
      fields.some((value) => workspaceIds.some((id) => value.includes(id))),
    )
    .map(([id]) => id);
  if (ownedClicks.length) await durable.xdel("clicks:stream", ...ownedClicks);
  await db.dropDatabase();
  await rm(spoolPath, { force: true });
  if (workspaceId)
    for (const redis of [cache, durable]) {
      const keys = await redis.keys(`*${workspaceId}*`);
      if (keys.length) await redis.del(...keys);
    }
  // Currency fixtures use the runner's dedicated local Redis database.
  await cache.del(...Object.values(fxKeys));
  cache.disconnect();
  durable.disconnect();
  await client.close();
  await log.close();
  if (storageCreated) {
    const objects = await objectStore.send(
      new ListObjectsV2Command({ Bucket: runtime.S3_BUCKET }),
    );
    if (objects.Contents?.length)
      await objectStore.send(
        new DeleteObjectsCommand({
          Bucket: runtime.S3_BUCKET,
          Delete: {
            Objects: objects.Contents.map((object) => ({ Key: object.Key! })),
          },
        }),
      );
    await objectStore.send(
      new DeleteBucketCommand({ Bucket: runtime.S3_BUCKET }),
    );
  }
  objectStore.destroy();
}
