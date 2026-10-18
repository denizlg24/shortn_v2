/** Session-authenticated HTTP exports against synthetic loopback services only. */
import { strict as assert } from "node:assert";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium, type Page } from "playwright-core";
import { MongoClient, ObjectId } from "mongodb";
import Redis from "ioredis";
import { collection, physicalNames } from "@shortn/db";
import {
  createLink,
  analyticsExportJobs,
  type ServiceContext,
} from "@shortn/core";
import { createObjectStore } from "@shortn/storage";
import { createAnalyticsExportWorker } from "../../worker/src/analytics-exports";
const login = JSON.parse(await readFile("/tmp/shortn-p6-login.json", "utf8"));
assert.equal(login.origin, "http://localhost:3200");
const mongo = await new MongoClient(
    "mongodb://127.0.0.1:27020/?directConnection=true",
  ).connect(),
  db = mongo.db("shortn_p6_dev");
const cache = new Redis("redis://127.0.0.1:16380/6"),
  durable = new Redis("redis://127.0.0.1:16379/6");
const workspace = (await collection(db, "workspaces").findOne({
  _id: new ObjectId(login.workspaceId),
}))!;
const ctx: ServiceContext = {
  db,
  cache,
  workspace,
  actor: { userId: login.userId, role: "owner" },
  linkDomain: "shortn.invalid",
};
const marker = `analytics-ui-${crypto.randomUUID()}`,
  subscriptionId = new ObjectId(),
  fixtureIds: ObjectId[] = [],
  jobIds: ObjectId[] = [];
const objects = new Map<string, { bytes: Uint8Array; type: string }>();
const storage = Bun.serve({
  hostname: "127.0.0.1",
  port: 3205,
  async fetch(request) {
    const url = new URL(request.url),
      key = url.pathname;
    if (
      !request.headers.has("authorization") &&
      !url.searchParams.has("X-Amz-Signature")
    )
      return new Response(null, { status: 403 });
    if (request.method === "PUT") {
      objects.set(key, {
        bytes: new Uint8Array(await request.arrayBuffer()),
        type: request.headers.get("content-type")!,
      });
      return new Response(null, { headers: { ETag: '"synthetic"' } });
    }
    const object = objects.get(key);
    if (!object) return new Response(null, { status: 404 });
    return new Response(request.method === "HEAD" ? null : object.bytes, {
      headers: {
        "Content-Type": object.type,
        "Content-Length": String(object.bytes.length),
        "Content-Disposition":
          url.searchParams.get("response-content-disposition") ?? "inline",
      },
    });
  },
});
const store = createObjectStore({
  S3_ENDPOINT: "http://127.0.0.1:3205",
  S3_REGION: "local",
  S3_BUCKET: "synthetic-p6",
  S3_ACCESS_KEY_ID: "synthetic",
  S3_SECRET_ACCESS_KEY: "synthetic-local-secret",
});
const worker = createAnalyticsExportWorker({
  db,
  cache,
  durable,
  store,
  linkDomain: ctx.linkDomain,
  queueName: `ui-analytics-${crypto.randomUUID()}`,
  log: (message) => console.log(message),
});
const browser = await chromium.launch({ headless: true });
let sourceKey = "";
const ownedTagIds: ObjectId[] = [];
const directory = ".impeccable/review/p6-analytics-export-ui",
  captures: object[] = [],
  errors: string[] = [];
const analytics = `${login.origin}/${login.workspace}/analytics`;
await mkdir(directory, { recursive: true });
async function capture(page: Page, name: string, width: number) {
  await page.setViewportSize({ width, height: 1000 });
  await page.evaluate(() => document.fonts.ready);
  await page.locator("#main").evaluate((main) => {
    main.scrollTop = 0;
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    `${name}: overflow`,
  );
  const style = await page.addStyleTag({
    content:
      "nextjs-portal{display:none!important} body > div:has(> div > main#main){height:auto!important;min-height:100dvh;overflow:visible!important} main#main{overflow:visible!important}",
  });
  await page.evaluate(() => scrollTo(0, 0));
  const file = `${directory}/${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  await style.evaluate((node) => node.remove());
  captures.push({
    file,
    width,
    fullPage: true,
    route: new URL(page.url()).pathname,
    heading: await page.locator("h1").textContent(),
  });
}
async function locale(page: Page, value: string, dark = false) {
  await page
    .context()
    .addCookies([{ name: "NEXT_LOCALE", value, url: login.origin }]);
  await page.evaluate(
    (dark) => localStorage.setItem("theme", dark ? "dark" : "light"),
    dark,
  );
}
async function download(page: Page, label: string) {
  const event = page.waitForEvent("download");
  await page.getByRole("link", { name: label, exact: true }).click();
  const result = await event;
  assert.equal(await result.failure(), null);
  return readFile((await result.path())!);
}
try {
  await db
    .collection(physicalNames.subscriptions)
    .insertOne({
      _id: subscriptionId,
      workspaceId: workspace._id,
      polarSubscriptionId: marker,
      status: "active",
      plan: "pro",
      currentPeriodStart: new Date(Date.now() - 86400000),
      currentPeriodEnd: new Date(Date.now() + 29 * 86400000),
      cancelAtPeriodEnd: false,
    });
  const created = await createLink(ctx, {
    url: `https://example.com/${marker}`,
    title: `São João — ${"Editorial semanal ".repeat(12)}`,
    tags: [marker],
  });
  if (!created.ok) throw new Error(created.error);
  sourceKey = created.value.key;
  const source = (await collection(db, "links").findOne({
    _id: new ObjectId(created.value.id),
  }))!;
  fixtureIds.push(source._id);
  ownedTagIds.push(...(source.tagIds ?? []));
  const rows = Array.from({ length: 4999 }, (_, i) => ({
    ...source,
    _id: new ObjectId(),
    urlCode: `${marker}-${i}`,
    key: `${marker}-${i}`,
  }));
  await collection(db, "links").insertMany(rows);
  fixtureIds.push(...rows.map((row) => row._id));
  const template = (await collection(db, "tags").findOne({
    _id: ownedTagIds[0]!,
  }))!;
  const tags = Array.from({ length: 100 }, (_, i) => ({
    ...template,
    _id: new ObjectId(),
    id: crypto.randomUUID(),
    nameLower: `${marker}-${i}`,
    name: `${marker}-${i}`,
    tagName: `${marker}-${i}`,
  }));
  await collection(db, "tags").insertMany(tags);
  ownedTagIds.push(...tags.map((tag) => tag._id));
  const ts = new Date(Date.now() - 3600_000);
  await db
    .collection(physicalNames.click_events)
    .insertMany(
      Array.from({ length: 1005 }, (_, i) => ({
        ts,
        m: {
          workspaceId: workspace._id,
          linkId: source._id,
          key: sourceKey,
          kind: i % 2 ? "scan" : "click",
        },
        country: marker,
        ipHash: `private-${i % 3}`,
      })),
    );
  const context = await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", url: login.origin },
  ]);
  await page.goto(`${login.origin}/login`);
  await page.locator('input[name="identifier"]').fill(login.email);
  await page.locator('input[name="password"]').fill(login.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await page.goto(
    `${analytics}?range=7d&interval=day&country=${encodeURIComponent(marker)}&link=${source._id}`,
  );
  await page
    .getByRole("button", { name: "Export analytics", exact: true })
    .click();
  await page.waitForURL((url) => url.pathname.endsWith("/analytics/export"));
  await page.getByText("1,005 matching events", { exact: true }).waitFor();
  const review = page.url();
  assert.equal(new URL(review).searchParams.get("country"), marker);
  assert.equal(
    new URL(review).searchParams.get("link"),
    source._id.toHexString(),
  );
  await capture(page, "en-review-light-1440", 1440);
  await page.locator("summary").focus();
  await page.keyboard.press("Enter");
  assert((await page.locator("details").getAttribute("open")) !== null);
  await capture(page, "en-groups-open-light-1440", 1440);
  await page.keyboard.press("Enter");
  await page.goto(
    `${analytics}/countries?range=7d&country=${encodeURIComponent(marker)}&link=${source._id}`,
  );
  await page
    .getByRole("button", { name: "Export analytics", exact: true })
    .click();
  await page.waitForURL((url) => url.pathname.endsWith("/analytics/export"));
  assert.equal(new URL(page.url()).searchParams.get("dimension"), "country");
  await page.getByText("1,005 matching events", { exact: true }).waitFor();
  await capture(page, "en-breakdown-review-light-1440", 1440);
  await locale(page, "pt", true);
  await page.goto(review);
  await page
    .getByRole("button", { name: "Preparar exportação", exact: true })
    .waitFor();
  await capture(page, "pt-review-dark-390", 390);
  await locale(page, "en");
  await page.goto(review);
  await page.locator('select[name="mode"]').selectOption("raw");
  await page.locator('select[name="format"]').selectOption("ndjson");
  await capture(page, "en-raw-light-390", 390);
  let release!: () => void,
    posts = 0;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/analytics-exports/*", async (route) => {
    if (route.request().method() === "POST") {
      posts++;
      await gate;
    }
    await route.continue();
  });
  await page
    .getByRole("button", { name: "Prepare export", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "Prepare export", exact: true })
      .isDisabled(),
    true,
  );
  await page
    .locator("form")
    .evaluate((form) => (form as HTMLFormElement).requestSubmit());
  release();
  await page.waitForURL((url) =>
    /\/analytics\/exports\/[a-f\d]{24}$/.test(url.pathname),
  );
  await page.unrouteAll({ behavior: "wait" });
  assert.equal(posts, 1);
  const pending = page.url(),
    pendingId = pending.split("/").at(-1)!;
  jobIds.push(new ObjectId(pendingId));
  await page.getByText("Waiting to export", { exact: true }).waitFor();
  await capture(page, "en-pending-light-1440", 1440);
  await locale(page, "pt", true);
  await page.goto(pending);
  await page
    .getByRole("heading", { name: "Exportação de estatísticas", exact: true })
    .waitFor();
  await capture(page, "pt-pending-dark-390", 390);
  await locale(page, "en");
  await page.goto(pending);
  await page
    .getByRole("button", { name: "Cancel export", exact: true })
    .click();
  await page.getByText("Export cancelled", { exact: true }).waitFor();
  await capture(page, "en-cancelled-light-390", 390);
  const completedIds: string[] = [];
  for (const [mode, format] of [
    ["raw", "ndjson"],
    ["raw", "csv"],
    ["aggregate", "csv"],
  ] as const) {
    await page.goto(review);
    await page.locator('select[name="mode"]').selectOption(mode);
    await page.locator('select[name="format"]').selectOption(format);
    await page
      .getByRole("button", { name: "Prepare export", exact: true })
      .click();
    await page.waitForURL((url) =>
      /\/analytics\/exports\/[a-f\d]{24}$/.test(url.pathname),
    );
    const id = page.url().split("/").at(-1)!;
    jobIds.push(new ObjectId(id));
    completedIds.push(id);
    await worker.pump();
    await page
      .getByRole("link", {
        name: `Download ${format.toUpperCase()}`,
        exact: true,
      })
      .waitFor({ timeout: 20000 });
    const output = (
      await download(page, `Download ${format.toUpperCase()}`)
    ).toString();
    if (format === "ndjson") {
      const data = output
        .trim()
        .split("\n")
        .map((row) => JSON.parse(row));
      assert.equal(data.length, 1005);
      assert.equal(data[0].key, sourceKey);
      assert(!("ipHash" in data[0]));
      await capture(page, "en-completed-light-1440", 1440);
    } else if (mode === "raw")
      assert.equal(output.trim().split("\r\n").length, 1006);
    else {
      assert(output.includes('"503","502","3"'));
      await locale(page, "es", true);
      await page.reload();
      await page
        .getByRole("heading", {
          name: "Exportación de estadísticas",
          exact: true,
        })
        .waitFor();
      await capture(page, "es-completed-dark-390", 390);
      await locale(page, "en");
    }
  }
  await locale(page, "en");
  const baseJob = (await analyticsExportJobs(db).findOne({
    _id: new ObjectId(completedIds[0]!),
  }))!;
  const historyJobs = Array.from({ length: 30 }, (_, i) => ({
    ...baseJob,
    _id: new ObjectId(),
    requestKey: `${marker}-${i}`,
    state: "cancelled" as const,
    done: 0,
    objectKey: undefined,
  }));
  await analyticsExportJobs(db).insertMany(historyJobs);
  jobIds.push(...historyJobs.map((row) => row._id));
  await page.goto(`${analytics}/exports`);
  await page.getByText("Page 1 of 2", { exact: true }).waitFor();
  await capture(page, "en-history-light-1440", 1440);
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await page.getByText("Page 2 of 2", { exact: true }).waitFor();
  await page.locator('select[name="state"]').selectOption("completed");
  await page.locator('select[name="format"]').selectOption("csv");
  await page.locator('select[name="mode"]').selectOption("aggregate");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.waitForURL(
    (url) =>
      url.searchParams.get("mode") === "aggregate" &&
      url.searchParams.get("state") === "completed" &&
      url.searchParams.get("format") === "csv",
  );
  await page.waitForFunction(
    () => document.querySelectorAll("#main ul.divide-y > li").length === 1,
  );
  await capture(page, "en-history-filtered-light-390", 390);
  await page.goto(
    review.replace(encodeURIComponent(marker), "synthetic-empty-analytics"),
  );
  await page.getByText("0 matching events", { exact: true }).waitFor();
  await page.locator('select[name="mode"]').selectOption("raw");
  assert(
    await page
      .getByRole("button", { name: "Prepare export", exact: true })
      .isDisabled(),
  );
  await capture(page, "en-empty-light-390", 390);
  await analyticsExportJobs(db).updateOne(
    { _id: new ObjectId(completedIds[0]!) },
    { $set: { expiresAt: new Date(0) } },
  );
  await page.goto(`${analytics}/exports/${completedIds[0]}`);
  await page
    .getByText(
      "This export is unavailable or has expired. Prepare a new export.",
      { exact: true },
    )
    .waitFor();
  await capture(page, "en-expired-light-390", 390);
  await db
    .collection(physicalNames.subscriptions)
    .updateOne({ _id: subscriptionId }, { $set: { plan: "free" } });
  await page.goto(review);
  await page
    .getByText(
      "Your plan does not include this export. Review your plan or ask a workspace admin.",
      { exact: true },
    )
    .waitFor();
  await capture(page, "en-plan-gate-light-390", 390);
  assert.deepEqual(errors, []);
  await writeFile(
    `${directory}/evidence.json`,
    JSON.stringify(
      {
        synthetic: true,
        libraryLinks: 5000,
        libraryTags: 101,
        matchingEvents: 1005,
        assertions: [
          "scope/range/filter preserved",
          "three output combinations",
          "real worker private downloads",
          "duplicate-submit guard",
          "cancellation",
          "history 30 jobs pagination/filters",
          "empty raw disabled",
          "expiry and plan gate",
          "en/pt/es light/dark 1440/390",
          "no page errors/overflow",
        ],
        captures,
      },
      null,
      2,
    ),
  );
  console.log(
    `Analytics UI checks passed: ${captures.length} captures, 1005 matching events, 5000-link library.`,
  );
} finally {
  await browser.close();
  await worker.close();
  await storage.stop(true);
  let cursor = "0";
  do {
    const [next, keys] = await durable.scan(
      cursor,
      "MATCH",
      `bull:${worker.queue.name}:*`,
      "COUNT",
      1000,
    );
    cursor = next;
    if (keys.length) await durable.unlink(...keys);
  } while (cursor !== "0");
  await analyticsExportJobs(db).deleteMany({
    workspaceId: workspace._id,
    createdBy: login.userId,
    kind: "analytics",
    "query.filters.country": marker,
  });
  await collection(db, "links").deleteMany({ _id: { $in: fixtureIds } });
  await collection(db, "tags").deleteMany({ _id: { $in: ownedTagIds } });
  if (sourceKey)
    await db
      .collection(physicalNames.click_events)
      .deleteMany({ "m.workspaceId": workspace._id, "m.key": sourceKey });
  await db
    .collection(physicalNames.subscriptions)
    .deleteOne({ _id: subscriptionId });
  for (const prefix of [
    `link:${ctx.linkDomain}:${sourceKey}`,
    `cache-generation:link:${ctx.linkDomain}:${sourceKey}`,
  ])
    await cache.unlink(prefix);
  cache.disconnect();
  durable.disconnect();
  await mongo.close();
}
