import { strict as assert } from "node:assert";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium, type Page } from "playwright-core";
import { MongoClient, ObjectId } from "mongodb";
import Redis from "ioredis";
import { unzipSync } from "fflate";
import { z } from "zod";
import { collection } from "@shortn/db";
import {
  createQr,
  qrExportJobs,
  qrZipJobs,
  qrZipItems,
  type ServiceContext,
} from "@shortn/core";
import { createObjectStore } from "@shortn/storage";
import { createQrExportWorker } from "../../worker/src/qr-exports";
import { encodeSelection, decodeSelection } from "../src/lib/bulk-selection";

const login = z
  .object({
    email: z.string(),
    password: z.string(),
    workspace: z.string(),
    workspaceId: z.string(),
    userId: z.string(),
    origin: z.literal("http://localhost:3200"),
  })
  .parse(JSON.parse(await readFile("/tmp/shortn-p6-login.json", "utf8")));
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
const worker = createQrExportWorker({
  db,
  store,
  durable,
  linkDomain: ctx.linkDomain,
  logoOrigins: [login.origin],
  queueName: `qr-ui-${crypto.randomUUID()}`,
  log: (message) => console.log(message),
});
const browser = await chromium.launch({ headless: true });
const directory = "test-results/captures/p6-qr-ui",
  captures: object[] = [],
  errors: string[] = [],
  refs = new Set<string>();
const marker = `QR export fixture ${crypto.randomUUID().slice(0, 8)}`,
  ids: ObjectId[] = [],
  linkIds: ObjectId[] = [],
  tagIds: ObjectId[] = [];
const base = `${login.origin}/${login.workspace}/qr`;
const en = JSON.parse(
  await readFile("apps/web/messages/en/qrExports.json", "utf8"),
);
await mkdir(directory, { recursive: true });
async function capture(page: Page, name: string, width: number) {
  await page.setViewportSize({ width, height: 1000 });
  await page.evaluate(() => document.fonts.ready);
  await page.locator("#main").evaluate((main) => {
    main.scrollTop = 0;
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  const file = `${directory}/${name}.png`;
  // Expand only the shell scroll constraint for a full-content screenshot.
  const style = await page.addStyleTag({
    content:
      "nextjs-portal { display: none !important; } body > div:has(> div > main#main) { height: auto !important; min-height: 100dvh; overflow: visible !important; } main#main { overflow: visible !important; }",
  });
  const png = await page.screenshot({ path: file, fullPage: true });
  await style.evaluate((element) => element.remove());
  captures.push({
    file,
    width,
    height: png.readUInt32BE(20),
    viewportHeight: 1000,
    fullPage: true,
    route: new URL(page.url()).pathname,
    heading: await page.locator("h1").textContent(),
  });
  assert.equal(overflow, false, `${name}: horizontal overflow`);
}
async function review(page: Page, selected: string[]) {
  await page.goto(`${base}/export?selection=${encodeSelection(selected)}`);
  await page.waitForURL((url) => url.searchParams.has("selectionRef"));
  const ref = new URL(page.url()).searchParams.get("selectionRef")!;
  refs.add(ref);
  assert(page.url().length < 2048);
  await page
    .locator('button[type="submit"]')
    .filter({ hasText: /Create ZIP|Criar ZIP|Crear ZIP/ })
    .waitFor();
  return ref;
}
async function download(page: Page, label: string) {
  const event = page.waitForEvent("download");
  await page.getByRole("link", { name: label, exact: true }).click();
  const path = await (await event).path();
  assert(path);
  return readFile(path);
}
try {
  for (const group of ["Editorial", "Campaign"]) {
    const result = await createQr(ctx, {
      url: `https://example.com/synthetic/${group}`,
      title:
        `São João — ${marker} — ${group} — ` +
        "Vida Económica edição semanal ".repeat(10),
      tags: [marker, group],
    });
    if (!result.ok) throw new Error(result.error);
    ids.push(new ObjectId(result.value.id));
    const backing = await collection(db, "links").findOne({
      workspaceId: workspace._id,
      urlCode: result.value.key,
    });
    if (backing) linkIds.push(backing._id);
    for (const tag of result.value.tags)
      if (/^[a-f0-9]{24}$/i.test(tag.id)) tagIds.push(new ObjectId(tag.id));
  }
  const originals = await collection(db, "qr_codes")
    .find({ _id: { $in: ids } })
    .toArray();
  const clones = Array.from({ length: 999 }, (_, index) => {
    const original = originals[index % 2]!;
    return {
      ...original,
      _id: new ObjectId(),
      qrCodeId: `${marker}-${index}`,
      publicId: `${marker}-${index}`,
      title:
        `${marker} — ${index % 2 ? "Campaign" : "Editorial"} — newsletter ${index} — ` +
        "edição internacional São João ".repeat(6),
      date: new Date(Date.now() - (index + 60) * 86400000),
      createdAt: new Date(Date.now() - (index + 60) * 86400000),
    };
  });
  await collection(db, "qr_codes").insertMany(clones);
  ids.push(...clones.map((row) => row._id));
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      acceptDownloads: true,
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
  await page.goto(`${base}?view=list&tag=${encodeURIComponent(marker)}`);
  assert.equal(await page.locator('input[name="ids"]').count(), 24);
  await page.waitForFunction(
    () => !!document.querySelector('form input[name="ids"]'),
  );
  await page.locator('input[name="ids"]').first().check();
  await page
    .getByRole("status")
    .filter({ hasText: /^1 selected$/ })
    .waitFor();
  const first = await page.locator('input[name="ids"]').first().inputValue();
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await page.waitForURL((url) => url.searchParams.get("page") === "2");
  await page.waitForFunction(
    (first) =>
      (document.querySelector('input[name="ids"]') as HTMLInputElement)
        ?.value !== first,
    first,
  );
  await page.locator('input[name="ids"]').first().check();
  const second = await page.locator('input[name="ids"]').first().inputValue();
  assert.notEqual(first, second);
  await page
    .getByRole("status")
    .filter({ hasText: /^2 selected$/ })
    .waitFor();
  await page.goto(`${base}?view=list&tag=Editorial`);
  await page
    .getByRole("status")
    .filter({ hasText: /^2 selected$/ })
    .waitFor();
  await page
    .getByRole("button", { name: en.selectedAction, exact: true })
    .click();
  await page.waitForURL((url) => url.searchParams.has("selectionRef"));
  refs.add(new URL(page.url()).searchParams.get("selectionRef")!);
  assert.deepEqual(
    new Set(
      decodeSelection(
        await page.locator('input[name="selection"]').inputValue(),
      ),
    ),
    new Set([first, second]),
  );
  await page.locator('select[name="format"]').selectOption("svg");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/*", async (route) => {
    if (
      route.request().method() === "POST" &&
      route.request().headers()["next-action"]
    )
      await gate;
    await route.continue();
  });
  await page.getByRole("button", { name: en.createZip, exact: true }).click();
  await page.locator('form[aria-busy="true"]').waitFor();
  await capture(page, "form-pending-en-light-390", 390);
  release();
  await page.unrouteAll({ behavior: "wait" });
  await page.waitForURL((url) => /\/qr\/exports\//.test(url.pathname));
  await page.getByRole("progressbar").waitFor();
  const zipUrl = page.url(),
    zipId = new URL(zipUrl).pathname.split("/").at(-1)!;
  for (const width of [1440, 390])
    await capture(page, `progress-pending-en-light-${width}`, width);
  await worker.pump();
  await page
    .getByRole("link", { name: en.downloadZip, exact: true })
    .waitFor({ timeout: 60_000 });
  const archive = await download(page, en.downloadZip);
  assert.equal(Object.keys(unzipSync(archive)).length, 2);
  for (const width of [1440, 390])
    await capture(page, `progress-completed-en-light-${width}`, width);
  assert.equal(
    (await qrZipJobs(db).findOne({ _id: new ObjectId(zipId) }))?.total,
    2,
  );
  console.log(
    "Cross-page/filter selection, real ZIP action, worker progress and private browser download passed",
  );
  await page.goto(`${base}/${ids[0]}/export`);
  await page.locator('select[name="format"]').selectOption("png");
  await page.getByRole("button", { name: en.prepare, exact: true }).click();
  await page.waitForURL((url) => /\/qr\/exports\//.test(url.pathname));
  await worker.pump();
  await page
    .getByRole("link", { name: en.download, exact: true })
    .waitFor({ timeout: 60_000 });
  const png = await download(page, en.download);
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const singleUrl = page.url(),
    singleId = new URL(singleUrl).pathname.split("/").at(-1)!;
  const ref = await review(page, ids.slice(0, 500).map(String));
  assert.equal(await page.locator("section ul li").count(), 25);
  assert.equal(
    decodeSelection(await page.locator('input[name="selection"]').inputValue())
      .length,
    500,
  );
  await page.getByRole("link", { name: "Next", exact: true }).click();
  assert(page.url().length < 2048);
  await page.getByRole("combobox", { name: "Tag", exact: true }).click();
  await page.getByRole("option", { name: "Editorial", exact: true }).click();
  await page.waitForURL((url) =>
    url.searchParams.getAll("tag").includes("Editorial"),
  );
  assert.equal(new URL(page.url()).searchParams.get("selectionRef"), ref);
  assert.equal(
    decodeSelection(await page.locator('input[name="selection"]').inputValue())
      .length,
    500,
  );
  assert.equal(await page.locator("section ul li").count(), 25);
  console.log(
    "500-code review uses private short references, 25-row server pages and retained tag filters",
  );
  const selected = ids.slice(0, 30).map(String);
  for (const locale of ["en", "es", "pt"]) {
    await context.addCookies([
      { name: "NEXT_LOCALE", value: locale, url: login.origin },
    ]);
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (theme) => localStorage.setItem("theme", theme),
        theme,
      );
      await page.goto(`${base}/${ids[0]}/export`);
      await page.locator('select[name="format"]').waitFor();
      for (const width of [1440, 390])
        await capture(page, `${locale}-single-${theme}-${width}`, width);
      await review(page, selected);
      for (const width of [1440, 390])
        await capture(page, `${locale}-bulk-${theme}-${width}`, width);
      assert(
        await page
          .locator("html")
          .evaluate(
            (html, theme) =>
              html.classList.contains("dark") === (theme === "dark"),
            theme,
          ),
      );
    }
  }
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", url: login.origin },
  ]);
  await page.evaluate(() => localStorage.setItem("theme", "light"));
  const staleId = ids[50]!,
    stale = (await collection(db, "qr_codes").findOne({ _id: staleId }))!;
  await review(page, [String(staleId)]);
  await collection(db, "qr_codes").deleteOne({ _id: staleId });
  const before = await qrZipJobs(db).countDocuments();
  await page.getByRole("button", { name: en.createZip, exact: true }).click();
  await page.locator('form [role="alert"]').waitFor();
  assert.equal(await qrZipJobs(db).countDocuments(), before);
  assert(
    await page
      .locator('form [role="alert"]')
      .evaluate((element) => element === document.activeElement),
  );
  await capture(page, "stale-selection-en-light-390", 390);
  await collection(db, "qr_codes").insertOne(stale);
  await collection(db, "workspace_members").updateOne(
    { workspaceId: workspace._id, userId: login.userId },
    { $set: { role: "viewer" } },
  );
  await page.goto(`${base}?view=list&tag=${encodeURIComponent(marker)}`);
  assert.equal(
    await page
      .getByRole("button", { name: "Delete selected", exact: true })
      .count(),
    0,
  );
  await page
    .getByRole("button", { name: en.selectedAction, exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();
  const viewerRows = page.locator('input[name="ids"]');
  assert.equal(await viewerRows.count(), 24);
  await viewerRows.first().check();
  await page
    .getByRole("status")
    .filter({ hasText: /^1 selected$/ })
    .waitFor();
  await viewerRows.first().uncheck();
  await page
    .getByRole("status")
    .filter({ hasText: /^0 selected$/ })
    .waitFor();
  await viewerRows.first().check();
  const viewerFirst = await viewerRows.first().inputValue();
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await page.waitForURL((url) => url.searchParams.get("page") === "2");
  await page.waitForFunction(
    (id) =>
      (document.querySelector('input[name="ids"]') as HTMLInputElement)
        ?.value !== id,
    viewerFirst,
  );
  await viewerRows.first().check();
  await page
    .getByRole("status")
    .filter({ hasText: /^2 selected$/ })
    .waitFor();
  await page.goto(`${base}?view=list&tag=Editorial`);
  await page
    .getByRole("status")
    .filter({ hasText: /^2 selected$/ })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Delete selected", exact: true })
      .count(),
    0,
  );
  await page.goto(`${base}?view=list&tag=${encodeURIComponent(marker)}`);
  const title = page.locator("tbody a[title]").first();
  assert(await title.getAttribute("title"));
  assert(
    await title.evaluate(
      (element) =>
        element.clientHeight <=
        2 * parseFloat(getComputedStyle(element).lineHeight) + 1,
    ),
  );
  await capture(page, "viewer-library-en-light-390", 390);
  console.log(
    "Viewer individual select/deselect and cross-page/filter persistence pass; long titles are clamped to two lines",
  );
  await page.goto(`${base}/${ids[0]}/export`);
  assert.equal(
    await page
      .getByRole("button", { name: en.prepare, exact: true })
      .isEnabled(),
    true,
  );
  await collection(db, "workspace_members").updateOne(
    { workspaceId: workspace._id, userId: login.userId },
    { $set: { role: "owner" } },
  );
  await collection(db, "qr_codes").updateOne(
    { _id: ids[1]! },
    { $set: { "options.dotsOptions.color": "#ddd" } },
  );
  await page.goto(`${base}/${ids[1]}/export`);
  assert.equal(
    await page
      .getByRole("button", { name: en.prepare, exact: true })
      .isDisabled(),
    true,
  );
  await capture(page, "invalid-design-en-light-390", 390);
  await review(page, [String(ids[1])]);
  await page.getByRole("button", { name: en.createZip, exact: true }).click();
  await page.waitForURL((url) => /\/qr\/exports\//.test(url.pathname));
  await worker.pump();
  await page
    .getByRole("link", { name: en.reviewDesign, exact: true })
    .waitFor({ timeout: 60_000 });
  for (const width of [1440, 390])
    await capture(page, `progress-failed-en-light-${width}`, width);
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "pt", url: login.origin },
  ]);
  await page.evaluate(() => localStorage.setItem("theme", "dark"));
  await qrExportJobs(db).updateOne(
    { _id: new ObjectId(singleId) },
    { $set: { expiresAt: new Date(Date.now() + 3000) } },
  );
  await page.goto(singleUrl);
  await page
    .getByText("Esta exportação expirou.", { exact: false })
    .waitFor({ timeout: 20_000 });
  await capture(page, "expired-pt-dark-390", 390);
  await page.goto(`${base}/export?selection=invalid`);
  await capture(page, "unavailable-pt-dark-390", 390);
  assert.equal(await page.locator('button[type="submit"]').count(), 0);
  assert.deepEqual(errors, []);
  await writeFile(
    `${directory}/captures.json`,
    JSON.stringify(captures, null, 2),
  );
  console.log(
    `${captures.length} QR dashboard captures passed locale/theme/overflow checks; single PNG, errors, expiry and viewer access passed`,
  );
  await context.close();
} finally {
  await browser.close();
  await worker.queue.obliterate({ force: true });
  await worker.close();
  storage.stop(true);
  await collection(db, "workspace_members").updateOne(
    { workspaceId: workspace._id, userId: login.userId },
    { $set: { role: "owner" } },
  );
  const zips = await qrZipItems(db).distinct("jobId", { qrId: { $in: ids } });
  await qrZipItems(db).deleteMany({ jobId: { $in: zips } });
  await qrZipJobs(db).deleteMany({ _id: { $in: zips } });
  await qrExportJobs(db).deleteMany({ qrId: { $in: ids } });
  await collection(db, "qr_codes").deleteMany({ _id: { $in: ids } });
  await collection(db, "links").deleteMany({ _id: { $in: linkIds } });
  // Only this run's marker is removed; shared Editorial/Campaign tags remain.
  await collection(db, "tags").deleteMany({
    workspaceId: workspace._id,
    name: marker,
  });
  for (const ref of refs)
    await durable.del(`qr:selection:${workspace._id}:${login.userId}:${ref}`);
  cache.disconnect();
  durable.disconnect();
  await mongo.close();
}
