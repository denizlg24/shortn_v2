// Local-only browser and query-plan checks. Start apps/admin with the same local DB first.
import { strict as assert } from "node:assert";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";
import { MongoClient, ObjectId } from "mongodb";
import {
  createAdminSession,
  ensurePersonalWorkspace,
  createLink,
  type ServiceContext,
} from "@shortn/core";
import { physicalNames, desiredIndexes } from "@shortn/db";
import { Redis } from "ioredis";
const mongo =
  process.env.MONGODB_URL ?? "mongodb://127.0.0.1:27031/?directConnection=true";
const redis = process.env.REDIS_CACHE_URL ?? "redis://127.0.0.1:16391";
assert(
  [mongo, redis].every((value) =>
    ["127.0.0.1", "localhost"].includes(new URL(value).hostname),
  ),
  "Local dependencies required",
);
const client = await new MongoClient(mongo).connect();
const db = client.db(process.env.MONGODB_DB ?? "shortn_admin_finish_browser");
const cache = new Redis(redis);
const staff = new ObjectId();
assert(
  db.databaseName.startsWith("shortn_admin_"),
  "Use a disposable shortn_admin_ database",
);
const origin = process.env.ADMIN_ORIGIN ?? "http://localhost:3005";
assert(new URL(origin).hostname === "localhost", "Local app required");
const ua = "shortn-admin-console-test";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ??
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const context = await browser.newContext({
  userAgent: ua,
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const artifacts =
  process.env.ADMIN_SCREENSHOT_DIR ?? "/tmp/shortn-admin-finish-review";
await mkdir(artifacts, { recursive: true });
try {
  for (const key of [
    "user",
    "workspaces",
    "links",
    "workspace_daily",
    "link_reports",
    "admin_audit_log",
  ] as const)
    await db
      .collection(physicalNames[key])
      .createIndexes(desiredIndexes[physicalNames[key]]!);
  await db.collection(physicalNames.user).insertOne({
    _id: staff,
    email: `admin-${staff}@example.com`,
    role: "superadmin",
    twoFactorEnabled: true,
    emailVerified: true,
  });
  const { token } = await createAdminSession(db, {
    userId: String(staff),
    userAgent: ua,
  });
  await context.addCookies([
    { name: "shortn_admin", value: token, url: origin },
  ]);
  const target = new ObjectId();
  await db.collection(physicalNames.user).insertOne({
    _id: target,
    email: `target-${target}@example.com`,
    name: "Account support example",
  });
  const workspace = await ensurePersonalWorkspace(db, {
    id: String(target),
    name: "Operations test workspace",
  });
  const service: ServiceContext = {
    db,
    cache,
    linkDomain: "shortn.at",
    workspace,
    actor: { userId: String(target), role: "owner" },
  };
  const made = await createLink(service, {
    url: "https://example.com/very-long-destination-for-responsive-layout-checks",
  });
  assert(made.ok);
  const linkId = made.value.id;
  const count = await db
    .collection(physicalNames.user)
    .estimatedDocumentCount();
  if (count < 200000) {
    for (let offset = 0; offset < 200000; offset += 5000)
      await db.collection(physicalNames.user).insertMany(
        Array.from({ length: 5000 }, (_, n) => ({
          _id: new ObjectId(),
          email: `fixture-${offset + n}@example.com`,
          role: (offset + n) % 500 === 0 ? "admin" : "user",
          banned: (offset + n) % 100 === 0,
          twoFactorEnabled: (offset + n) % 20 === 0,
          emailVerified: true,
        })),
      );
  }
  const linkCount = await db
    .collection(physicalNames.links)
    .countDocuments({ workspaceId: workspace._id });
  if (linkCount < 10000)
    for (let offset = 0; offset < 10000; offset += 1000)
      await db.collection(physicalNames.links).insertMany(
        Array.from({ length: 1000 }, (_, n) => ({
          _id: new ObjectId(),
          workspaceId: workspace._id,
          key: `large-${staff}-${offset + n}`,
          domain: "shortn.at",
          urlCode: `large-${staff}-${offset + n}`,
          longUrl: "https://example.com/news/article",
          destHostRev: "com.example",
          safetyStatus: (offset + n) % 20 === 0 ? "suspicious" : "safe",
          createdAt: new Date(),
          tags: [],
        })),
      );
  for (const filter of [
    { role: "admin" },
    { banned: true },
    { twoFactorEnabled: true },
  ]) {
    const plan = await db
      .collection(physicalNames.user)
      .find(filter)
      .sort({ _id: -1 })
      .limit(50)
      .explain("executionStats");
    assert(!JSON.stringify(plan.queryPlanner.winningPlan).includes("COLLSCAN"));
  }
  console.log("ok  indexed facets on 200k users; 10k-link library seeded");
  const routes = [
    "/",
    "/users",
    "/workspaces",
    "/links",
    "/reports",
    "/domains",
    "/webhooks",
    "/billing",
    "/billing?view=events",
    "/billing?view=reconcile",
    "/billing?view=overrides",
    "/jobs",
    "/contacts",
    "/feedback",
    "/audit",
    `/users/${target}`,
    `/workspaces/${workspace._id}`,
    `/links/${linkId}`,
    `/users/${target}/ban`,
    `/workspaces/${workspace._id}/override`,
    `/users/${target}/delete`,
  ];
  for (const route of routes) {
    const response = await page.goto(`${origin}${route}`);
    assert(response?.ok(), `${route} returned ${response?.status()}`);
    await page.locator("h1").waitFor();
    assert(!(await page.getByText("Application error").count()));
    console.log(`ok  ${route}`);
  }
  await page.goto(`${origin}/users/${target}/ban`);
  await page.getByLabel("Reason (internal, audited)").fill("Browser test ban");
  await page
    .locator('input[name="confirm"]')
    .fill(`target-${target}@example.com`);
  await page.getByRole("button", { name: "ban", exact: true }).click();
  await page.waitForURL(`**/users/${target}`);
  assert(
    (await db.collection(physicalNames.user).findOne({ _id: target }))
      ?.banned === true,
  );
  await page.goto(`${origin}/users/${target}/unban`);
  await page
    .getByLabel("Reason (internal, audited)")
    .fill("Browser test complete");
  await page.getByRole("button", { name: "unban", exact: true }).click();
  await page.waitForURL(`**/users/${target}`);
  assert(
    !(await db.collection(physicalNames.user).findOne({ _id: target }))?.banned,
  );
  await page.evaluate(
    (id) =>
      sessionStorage.setItem(
        "shortn-admin-selection:links",
        JSON.stringify([id]),
      ),
    linkId,
  );
  for (const operation of ["takedown", "restore"]) {
    await page.goto(`${origin}/links/bulk`);
    await page
      .getByRole("button", { name: "Freeze selection for review" })
      .click();
    await page.waitForURL((url) => url.searchParams.has("selection"));
    await page.locator('select[name="operation"]').selectOption(operation);
    await page.locator('select[name="category"]').selectOption("spam");
    await page
      .getByLabel("Reason (internal, audited)")
      .fill(`Browser bulk ${operation}`);
    await page.locator('input[name="confirm"]').fill("1");
    await page.getByRole("button", { name: "Apply to frozen links" }).click();
    await page.getByText("Succeeded", { exact: true }).waitFor();
    const stored = await db
      .collection(physicalNames.links)
      .findOne({ _id: new ObjectId(linkId) });
    assert(
      operation === "takedown"
        ? stored?.moderation?.state === "taken_down"
        : !stored?.moderation,
    );
  }
  await page.goto(`${origin}/links/bulk`);
  await page
    .getByLabel("Destination hostname (includes subdomains)")
    .fill("example.com");
  await page.getByRole("button", { name: "Freeze matching links" }).click();
  await page.getByRole("alert").filter({ hasText: "more than 1000" }).waitFor();
  await page.evaluate(() =>
    sessionStorage.removeItem("shortn-admin-selection:links"),
  );
  console.log("ok  frozen bulk takedown/restore and host-wide operation cap");
  await page.goto(`${origin}/links?workspace=${workspace._id}`);
  assert((await page.locator("tbody tr[data-row]").count()) <= 50);
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await page.waitForURL((url) => url.searchParams.has("after"));
  assert(new URL(page.url()).searchParams.has("after"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/workspaces/${workspace._id}/override`);
  assert(
    await page
      .locator("h1")
      .evaluate((node) => node.scrollWidth <= node.clientWidth),
    "Action title should remain readable on mobile",
  );
  if (process.env.ADMIN_SKIP_SCREENSHOTS !== "1")
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      for (const route of [
        "/links",
        "/users",
        `/workspaces/${workspace._id}/override`,
      ]) {
        await page.goto(`${origin}${route}`);
        await page.locator("h1").waitFor();
        await page.screenshot({
          path: `${artifacts}/${route.replaceAll("/", "-")}-${viewport.width}.png`,
          fullPage: true,
        });
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          `Overflow: ${route} ${viewport.width}`,
        );
      }
    }
  assert.deepEqual(errors, []);
  console.log(`ok  actions, pagination, responsive screenshots: ${artifacts}`);
} finally {
  await context.close();
  await browser.close();
  await db.collection(physicalNames.user).deleteOne({ _id: staff });
  await db
    .collection(physicalNames.admin_sessions)
    .deleteMany({ userId: String(staff) });
  await client.close();
  cache.disconnect();
}
