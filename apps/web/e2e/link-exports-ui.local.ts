/** Session-authenticated HTTP exports against synthetic loopback services only. */
import { strict as assert } from "node:assert";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium, type Page } from "playwright-core";
import { MongoClient, ObjectId } from "mongodb";
import Redis from "ioredis";
import { collection, physicalNames } from "@shortn/db";
import {
  createLink,
  linkExportJobs,
  parseImportCsv,
  type ServiceContext,
} from "@shortn/core";
import { createObjectStore } from "@shortn/storage";
import { createLinkExportWorker } from "../../worker/src/link-exports";
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
const marker = `export-ui-${crypto.randomUUID()}`,
  subscriptionId = new ObjectId(),
  fixtureIds: ObjectId[] = [],
  jobIds: ObjectId[] = [],
  refs: string[] = [];
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
const worker = createLinkExportWorker({
  db,
  cache,
  durable,
  store,
  linkDomain: ctx.linkDomain,
  queueName: `ui-exports-${crypto.randomUUID()}`,
  log: (message) => console.log(message),
});
const browser = await chromium.launch({ headless: true });
let sourceKey = "";
const ownedTagIds: ObjectId[] = [];
const directory = ".impeccable/review/p6-link-export-ui",
  captures: object[] = [],
  errors: string[] = [];
const library = `${login.origin}/${login.workspace}/links`,
  smallTag = `Small ${crypto.randomUUID().slice(0, 8)}`,
  targetTag = `Search all ${crypto.randomUUID().slice(0, 8)}`;
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
      currentPeriodEnd: new Date(Date.now() + 86400000 * 29),
      cancelAtPeriodEnd: false,
    });
  const created = await createLink(ctx, {
    url: `https://example.com/${marker}?utm_source=one&utm_source=two#part`,
    title: `São João — ${marker} — ${"Editorial edição semanal ".repeat(12)}`,
    tags: [marker, smallTag, targetTag],
  });
  if (!created.ok) throw new Error(created.error);
  sourceKey = created.value.key;
  fixtureIds.push(new ObjectId(created.value.id));
  const source = (await collection(db, "links").findOne({
    _id: new ObjectId(created.value.id),
  }))!;
  ownedTagIds.push(...(source.tagIds ?? []));
  const rows = Array.from({ length: 4999 }, (_, index) => {
    const tags = source.tags!.filter(
      (tag) =>
        tag.tagName !== targetTag && (index < 26 || tag.tagName !== smallTag),
    );
    return {
      ...source,
      _id: new ObjectId(),
      urlCode: `${marker}-${index}`,
      key: `${marker}-${index}`,
      tags,
      tagIds: tags
        .map((tag) => tag._id)
        .filter((id): id is ObjectId => id instanceof ObjectId),
    };
  });
  await collection(db, "links").insertMany(rows);
  fixtureIds.push(...rows.map((row) => row._id));
  const template = (await collection(db, "tags").findOne({
    _id: ownedTagIds[0]!,
  }))!;
  const extraTags = Array.from({ length: 100 }, (_, index) => ({
    ...template,
    _id: new ObjectId(),
    id: crypto.randomUUID(),
    nameLower: `tag ${marker.slice(-8)} ${index}`,
    name: `Tag ${marker.slice(-8)} ${index}`,
    tagName: `Tag ${marker.slice(-8)} ${index}`,
  }));
  await collection(db, "tags").insertMany(extraTags);
  ownedTagIds.push(...extraTags.map((tag) => tag._id));
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
  await page.goto(`${library}?tag=${encodeURIComponent(smallTag)}&page=2`);
  await page.getByText("Page 2 of 2", { exact: true }).waitFor();
  await page.getByRole("link", { name: "Export", exact: true }).click();
  await page.waitForURL((url) => url.pathname.endsWith("/links/export"));
  assert.equal(new URL(page.url()).searchParams.has("page"), false);
  await page
    .getByRole("button", { name: "Prepare export", exact: true })
    .waitFor();
  assert.equal(
    await page.getByText("27 matching links", { exact: true }).count(),
    2,
  );
  await capture(page, "en-review-light-1440", 1440);
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await page.waitForURL((url) => url.searchParams.get("page") === "2");
  await page.getByText("Page 2 of 2", { exact: true }).waitFor();
  await capture(page, "en-review-page2-light-1440", 1440);
  let release!: () => void,
    preparations = 0;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/api/link-exports/${login.workspace}`, async (route) => {
    preparations++;
    await gate;
    await route.continue();
  });
  await page
    .getByRole("button", { name: "Prepare export", exact: true })
    .click();
  assert.equal(await page.locator('select[name="format"]').isDisabled(), true);
  await page
    .locator('form[aria-busy="true"]')
    .evaluate((form) => (form as HTMLFormElement).requestSubmit());
  release();
  await page.getByRole("link", { name: "Download CSV", exact: true }).waitFor();
  await page.unrouteAll({ behavior: "wait" });
  assert.equal(preparations, 1);
  refs.push(
    (await page
      .getByRole("link", { name: "Download CSV", exact: true })
      .getAttribute("href"))!
      .split("/")
      .at(-1)!,
  );
  await capture(page, "en-ready-light-1440", 1440);
  assert.equal(
    parseImportCsv(await download(page, "Download CSV")).records.length,
    27,
  );
  await locale(page, "pt", true);
  await page.goto(`${library}/export?tag=${encodeURIComponent(smallTag)}`);
  await page
    .getByRole("button", { name: "Preparar exportação", exact: true })
    .waitFor();
  await capture(page, "pt-review-dark-390", 390);
  await locale(page, "es");
  await page.goto(`${library}/export?tag=${encodeURIComponent(smallTag)}`);
  await page
    .getByRole("button", { name: "Preparar exportación", exact: true })
    .waitFor();
  await page.locator('select[name="format"]').selectOption("json");
  await page
    .getByRole("button", { name: "Preparar exportación", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Descargar JSON", exact: true })
    .waitFor();
  refs.push(
    (await page
      .getByRole("link", { name: "Descargar JSON", exact: true })
      .getAttribute("href"))!
      .split("/")
      .at(-1)!,
  );
  await capture(page, "es-ready-light-390", 390);
  assert.equal(
    JSON.parse((await download(page, "Descargar JSON")).toString()).length,
    27,
  );
  await locale(page, "en");
  await page.goto(`${library}/export?tag=${encodeURIComponent(marker)}`);
  await page
    .getByRole("button", { name: "Prepare export", exact: true })
    .waitFor();
  await page.getByRole("combobox", { name: "Tag", exact: true }).click();
  assert.equal(
    await page.getByRole("option", { name: targetTag, exact: true }).count(),
    0,
  );
  await page.getByPlaceholder("Search options…").fill(targetTag);
  await page.getByRole("option", { name: targetTag, exact: true }).waitFor();
  await capture(page, "en-remote-tag-search-light-390", 390);
  await page.getByRole("option", { name: targetTag, exact: true }).click();
  await page.keyboard.press("Escape");
  await page.waitForURL((url) =>
    url.searchParams.getAll("tag").includes(targetTag),
  );
  // The shared tag filter matches ANY selected tag, so remove the large tag to isolate one row.
  await page
    .getByRole("button", { name: `Remove ${marker}`, exact: true })
    .click();
  await page.waitForURL(
    (url) => !url.searchParams.getAll("tag").includes(marker),
  );
  await page.getByText("1 matching link", { exact: true }).first().waitFor();
  await page.goto(`${library}/export?q=synthetic-no-matches-${marker}`);
  await page
    .getByText(
      "No links match these filters. Change the filters to prepare an export.",
    )
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Prepare export", exact: true })
      .isDisabled(),
    true,
  );
  await capture(page, "en-empty-light-390", 390);
  await page.goto(`${library}/export?tag=${encodeURIComponent(marker)}`);
  await page
    .getByRole("button", { name: "Prepare export", exact: true })
    .click();
  await page.waitForURL(new RegExp("/links/exports/[a-f0-9]{24}$"));
  const cancelledId = page.url().split("/").at(-1)!;
  jobIds.push(new ObjectId(cancelledId));
  await page
    .getByRole("heading", { name: "Waiting to export", exact: true })
    .waitFor();
  await capture(page, "en-pending-light-1440", 1440);
  await locale(page, "pt", true);
  await page.reload();
  await page
    .getByRole("heading", { name: "À espera da exportação", exact: true })
    .waitFor();
  await capture(page, "pt-pending-dark-390", 390);
  await locale(page, "en");
  await page.reload();
  await page
    .getByRole("button", { name: "Cancel export", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Export cancelled", exact: true })
    .waitFor();
  await capture(page, "en-cancelled-light-390", 390);
  await page.goto(`${library}/export?tag=${encodeURIComponent(marker)}`);
  await page.locator('select[name="format"]').selectOption("json");
  await page
    .getByRole("button", { name: "Prepare export", exact: true })
    .click();
  await page.waitForURL(new RegExp("/links/exports/[a-f0-9]{24}$"));
  const completedId = page.url().split("/").at(-1)!;
  jobIds.push(new ObjectId(completedId));
  await page
    .getByRole("heading", { name: "Waiting to export", exact: true })
    .waitFor();
  await worker.pump();
  await page
    .getByRole("heading", { name: "Export completed", exact: true })
    .waitFor();
  await capture(page, "en-completed-light-1440", 1440);
  assert.equal(
    JSON.parse((await download(page, "Download JSON")).toString()).length,
    5000,
  );
  const done = (await linkExportJobs(db).findOne({
    _id: new ObjectId(completedId),
  }))!;
  const clones = Array.from({ length: 28 }, (_, index) => ({
    ...done,
    _id: new ObjectId(),
    requestKey: crypto.randomUUID(),
    state: "cancelled" as const,
    createdAt: new Date(Date.now() - (index + 1) * 60000),
    expiresAt: new Date(Date.now() + 3600000),
  }));
  for (const clone of clones) {
    delete clone.objectKey;
    delete clone.bytes;
  }
  await linkExportJobs(db).insertMany(clones);
  jobIds.push(...clones.map((job) => job._id));
  await page.goto(`${library}/exports`);
  await page.getByRole("link", { name: "Next", exact: true }).waitFor();
  await capture(page, "en-history-light-1440", 1440);
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await page.waitForURL((url) => url.searchParams.get("page") === "2");
  await page.getByText("Page 2 of 2", { exact: true }).waitFor();
  await page.locator('select[name="state"]').selectOption("completed");
  await page.waitForURL((url) => url.searchParams.get("state") === "completed");
  assert.equal(await page.getByRole("link", { name: /^JSON ·/ }).count(), 1);
  await locale(page, "es", true);
  await page.goto(`${library}/exports/${completedId}`);
  await page
    .getByRole("heading", { name: "Exportación completada", exact: true })
    .waitFor();
  await capture(page, "es-completed-dark-390", 390);
  await linkExportJobs(db).updateOne(
    { _id: new ObjectId(completedId) },
    { $set: { expiresAt: new Date(0) } },
  );
  await locale(page, "en");
  await page.reload();
  await page
    .getByRole("alert")
    .filter({ hasText: "unavailable or has expired" })
    .waitFor();
  await capture(page, "en-expired-light-390", 390);
  await db
    .collection(physicalNames.subscriptions)
    .updateOne({ _id: subscriptionId }, { $set: { status: "canceled" } });
  await page.goto(`${library}/export`);
  await page
    .getByRole("status")
    .filter({ hasText: "Your plan does not include" })
    .waitFor();
  await capture(page, "en-plan-gate-light-390", 390);
  assert.deepEqual(errors, []);
  await writeFile(
    `${directory}/evidence.json`,
    JSON.stringify(
      {
        synthetic: true,
        links: 5000,
        tags: 103,
        assertions: [
          "library filters preserved",
          "25-row review pagination",
          "whole-filter 27-row CSV/JSON download",
          "duplicate-submit guard",
          "server tag search beyond first50",
          "empty export disabled",
          "5000-row background job",
          "cancellation",
          "real worker and private download",
          "history pagination/filter",
          "expiry and plan gate",
          "three locales/two themes",
          "390px bounds/no page errors",
        ],
        captures,
      },
      null,
      2,
    ),
  );
  console.log(
    `Link export UI checks passed; ${captures.length} captures, 5,000-link library.`,
  );
} finally {
  await worker.worker.close();
  await worker.queue.obliterate({ force: true });
  await worker.close();
  await browser.close();
  storage.stop(true);
  await collection(db, "links").deleteMany({ _id: { $in: fixtureIds } });
  await collection(db, "tags").deleteMany({
    _id: { $in: ownedTagIds },
    workspaceId: workspace._id,
  });
  await linkExportJobs(db).deleteMany({ _id: { $in: jobIds } });
  await db
    .collection(physicalNames.subscriptions)
    .deleteOne({ _id: subscriptionId });
  for (const ref of refs)
    await durable.del(
      `exports:selection:${workspace._id}:${login.userId}:${ref}`,
    );
  if (sourceKey)
    await cache.unlink(
      `link:shortn.invalid:${sourceKey}`,
      `cache-generation:link:shortn.invalid:${sourceKey}`,
    );
  cache.disconnect();
  durable.disconnect();
  await mongo.close();
}
