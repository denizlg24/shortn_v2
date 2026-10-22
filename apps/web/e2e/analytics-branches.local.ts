/** Native Next/session/analytics checks; isolated synthetic workspace only. */
import { strict as assert } from "node:assert";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium, type Page } from "playwright-core";
import { MongoClient, ObjectId } from "mongodb";
import Redis from "ioredis";
import { collection, physicalNames } from "@shortn/db";
import { queryAnalytics, type ServiceContext } from "@shortn/core";
const login = JSON.parse(await readFile("/tmp/shortn-p6-login.json", "utf8"));
assert.equal(login.origin, "http://localhost:3200");
const mongo = await new MongoClient(
    "mongodb://127.0.0.1:27020/?directConnection=true",
  ).connect(),
  db = mongo.db("shortn_p6_dev"),
  cache = new Redis("redis://127.0.0.1:16380/6");
const foreignWorkspaceId = new ObjectId();
const workspaceId = new ObjectId(),
  slug = `branches-${crypto.randomUUID()}`,
  directory = "test-results/captures/p6-analytics-branches",
  captures: object[] = [],
  errors: string[] = [];
const workspace = {
  _id: workspaceId,
  name: "Synthetic branch analytics",
  slug,
  personal: false,
  ownerUserId: login.userId,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const ctx: ServiceContext = {
  db,
  cache,
  workspace,
  actor: { userId: login.userId, role: "owner" },
  linkDomain: "shortn.invalid",
};
const userFilter = { _id: new ObjectId(login.userId) },
  previousUser = await db.collection(physicalNames.user).findOne(userFilter);
const browser = await chromium.launch({ headless: true });
await mkdir(directory, { recursive: true });
async function capture(page: Page, name: string, width: number) {
  await page.setViewportSize({ width, height: 1000 });
  await page.evaluate(() => document.fonts.ready);
  await page.locator("#main").evaluate((main) => {
    main.scrollTop = 0;
  });
  await page.waitForTimeout(200);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  const style = await page.addStyleTag({
    content:
      "nextjs-portal{display:none!important} *,*::before,*::after{animation:none!important;transition:none!important}",
  });
  const file = `${directory}/${name}.png`;
  await page.screenshot({ path: file });
  await style.evaluate((node) => node.remove());
  captures.push({ file, width, height: 1000, fullPage: false });
}
try {
  await collection(db, "workspaces").insertOne(workspace);
  await collection(db, "workspace_members").insertOne({
    _id: new ObjectId(),
    workspaceId,
    userId: login.userId,
    role: "owner",
    createdAt: new Date(),
  });
  await db.collection(physicalNames.subscriptions).insertOne({
    workspaceId,
    polarSubscriptionId: crypto.randomUUID(),
    status: "active",
    plan: "pro",
    currentPeriodStart: new Date(Date.now() - 86400000),
    currentPeriodEnd: new Date(Date.now() + 86400000 * 29),
    cancelAtPeriodEnd: false,
  });
  const links = Array.from({ length: 5001 }, (_, i) => ({
    _id: new ObjectId(),
    workspaceId,
    urlCode: `branch-${workspaceId}-${i}`,
    longUrl: `https://example.com/${i}`,
    title: `Synthetic branch link ${i}`,
    date: new Date(),
    createdAt: new Date(),
    createdBy: login.userId,
    _sync: { rev: 1 },
  }));
  await db.collection(physicalNames.links).insertMany(links);
  const branches = [
    "rotation:0",
    "rotation:1",
    "device:0",
    "geo:0",
    "deep:ios",
    "deep:android",
    "destination",
    undefined,
  ];
  const ts = new Date(Date.now() - 3600000);
  const events = branches.flatMap((branch, i) =>
    Array.from({ length: i + 1 }, (_, j) => ({
      ts,
      m: {
        workspaceId,
        linkId: links[0]!._id,
        key: links[0]!.urlCode,
        kind: j % 2 ? "scan" : "click",
        ...(branch ? { branch } : {}),
      },
      country: "PT",
      ipHash: `synthetic-${i}-${j}`,
    })),
  );
  await db.collection(physicalNames.click_events).insertMany([
    ...events,
    {
      ts,
      m: {
        workspaceId: foreignWorkspaceId,
        linkId: links[0]!._id,
        kind: "click",
        branch: "rotation:0",
      },
    },
    {
      ts,
      m: {
        workspaceId,
        linkId: links[1]!._id,
        kind: "click",
        branch: "rotation:0",
      },
    },
  ]);
  const input = {
    scope: { type: "link" as const, id: String(links[0]!._id) },
    from: new Date(Date.now() - 86400000).toISOString(),
    to: new Date().toISOString(),
    timezone: "UTC",
    dimensions: ["branch" as const],
    options: ["branch" as const],
    series: false,
    compare: false,
  };
  const result = await queryAnalytics(ctx, input);
  assert(result.ok);
  assert.equal(result.value.breakdowns.branch!.length, 8);
  assert.equal(result.value.totals.clicks + result.value.totals.scans, 36);
  const filtered = await queryAnalytics(ctx, {
    ...input,
    filters: { branch: "rotation:1" },
  });
  assert(filtered.ok);
  assert.equal(filtered.value.totals.clicks + filtered.value.totals.scans, 2);
  const absent = await queryAnalytics(ctx, {
    ...input,
    filters: { branch: "unknown" },
  });
  assert(absent.ok);
  assert.equal(absent.value.totals.clicks + absent.value.totals.scans, 8);
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", url: login.origin },
  ]);
  await page.goto(`${login.origin}/login`);
  await page.locator('[name="identifier"]').fill(login.email);
  await page.locator('[name="password"]').fill(login.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  const base = `${login.origin}/${slug}/analytics`,
    table = `${base}/branches?range=7d&link=${links[0]!._id}`;
  await page.goto(table);
  await page
    .getByText("8 rows · 36 clicks and scans", { exact: true })
    .waitFor();
  await page.getByText("Rotation target 2", { exact: true }).waitFor();
  await page.getByText("Not recorded", { exact: true }).waitFor();
  await capture(page, "en-table-light-1440", 1440);
  await capture(page, "en-table-light-390", 390);
  await page
    .locator("table")
    .evaluate((node) => node.scrollIntoView({ block: "start" }));
  await page.waitForTimeout(100);
  await page.screenshot({
    path: `${directory}/en-table-section-light-390.png`,
  });
  captures.push({
    file: `${directory}/en-table-section-light-390.png`,
    width: 390,
    height: 1000,
    fullPage: false,
    section: "table",
  });
  await page
    .getByRole("link", { name: "Rotation target 2", exact: true })
    .click();
  await page.waitForURL(
    (url) => url.searchParams.get("branch") === "rotation:1",
  );
  assert.equal(
    new URL(page.url()).searchParams.get("link"),
    String(links[0]!._id),
  );
  await page
    .getByRole("heading", { name: "Routing branches", exact: true })
    .waitFor();
  await page.getByText("Rotation target 2", { exact: true }).first().waitFor();
  await capture(page, "en-filtered-light-390", 390);
  await page.goto(table);
  await page
    .getByRole("button", { name: "Export analytics", exact: true })
    .click();
  await page.waitForURL((url) => url.pathname.endsWith("/analytics/export"));
  assert.equal(new URL(page.url()).searchParams.get("dimension"), "branch");
  assert.equal(
    new URL(page.url()).searchParams.get("link"),
    String(links[0]!._id),
  );
  for (const [language, dark, title] of [
    ["pt", true, "Regras de destino"],
    ["es", false, "Reglas de destino"],
  ] as const) {
    await context.addCookies([
      { name: "NEXT_LOCALE", value: language, url: login.origin },
    ]);
    await page.evaluate(
      (dark) => localStorage.setItem("theme", dark ? "dark" : "light"),
      dark,
    );
    await page.goto(table);
    await page.getByRole("heading", { name: title, exact: true }).waitFor();
    await page.locator("table tbody tr").first().waitFor();
    await capture(
      page,
      `${language}-table-${dark ? "dark" : "light"}-390`,
      390,
    );
    await page
      .locator("table")
      .evaluate((node) => node.scrollIntoView({ block: "start" }));
    await page.waitForTimeout(100);
    const sectionFile = `${directory}/${language}-table-section-${dark ? "dark" : "light"}-390.png`;
    for (const expected of language === "pt"
      ? ["Rotação 1", "Rotação 2", "Dispositivo 1"]
      : ["Rotación 1", "Rotación 2", "Dispositivo 1"]) {
      const label = page.getByRole("link", { name: expected, exact: true });
      await label.waitFor();
      assert(
        await label.evaluate((node) => node.scrollWidth <= node.clientWidth),
        `${expected}: target identity clipped`,
      );
    }
    const hide = await page.addStyleTag({
      content: "nextjs-portal{display:none!important}",
    });
    await page.screenshot({ path: sectionFile });
    await hide.evaluate((node) => node.remove());
    captures.push({
      file: sectionFile,
      width: 390,
      height: 1000,
      fullPage: false,
      section: "table",
    });
  }
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", url: login.origin },
  ]);
  await page.evaluate(() => localStorage.setItem("theme", "light"));
  await db
    .collection(physicalNames.subscriptions)
    .updateOne({ workspaceId }, { $set: { status: "canceled" } });
  const gated = await queryAnalytics(ctx, {
    ...input,
    filters: { branch: "rotation:1" },
  });
  assert(gated.ok);
  assert(gated.value.gated.includes("branch"));
  assert(!gated.value.breakdowns.branch);
  await page.goto(table);
  await page.getByText(/Routing branches, countries/).waitFor();
  assert.equal(await page.locator("table").count(), 0);
  await capture(page, "en-gated-light-390", 390);
  assert.deepEqual(errors, []);
  await writeFile(
    `${directory}/browser-evidence.json`,
    JSON.stringify(
      {
        synthetic: true,
        library: 5001,
        network: "native Next/session/server actions/Mongo/Redis; no providers",
        captures,
        checks: [
          "branch click/scan totals and tenant/link isolation",
          "missing historical branch filtering",
          "friendly target labels",
          "URL drilldown preserves link scope",
          "branch export handoff",
          "en/pt/es light/dark1440/390",
          "free plan gate",
          "no overflow/page errors",
        ],
      },
      null,
      2,
    ),
  );
  console.log("Routing branch analytics browser checks passed.");
} finally {
  await browser.close();
  await db
    .collection(physicalNames.user)
    .updateOne(
      { ...userFilter, lastWorkspaceId: String(workspaceId) },
      previousUser?.lastWorkspaceId
        ? { $set: { lastWorkspaceId: previousUser.lastWorkspaceId } }
        : { $unset: { lastWorkspaceId: "" } },
    );
  for (const name of ["links", "workspace_members", "workspaces"] as const)
    await collection(db, name).deleteMany(
      name === "workspaces" ? { _id: workspaceId } : { workspaceId },
    );
  await db.collection(physicalNames.subscriptions).deleteMany({ workspaceId });
  await db
    .collection(physicalNames.click_events)
    .deleteMany({ "m.workspaceId": workspaceId });
  await db
    .collection(physicalNames.click_events)
    .deleteMany({ "m.workspaceId": foreignWorkspaceId });
  await cache.quit();
  await mongo.close();
}
