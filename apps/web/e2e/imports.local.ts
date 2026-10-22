/** Synthetic local import flow. Owns storage/queue/fixtures; no external writes. */
import { strict as assert } from "node:assert";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium, type Page } from "playwright-core";
import { MongoClient, ObjectId } from "mongodb";
import Redis from "ioredis";
import { collection, physicalNames } from "@shortn/db";
import {
  createImportJob,
  importJobs,
  importRows,
  importResults,
  importReservations,
  importReceipts,
  type ServiceContext,
} from "@shortn/core";
import { createObjectStore } from "@shortn/storage";
import { createImportWorker } from "../../worker/src/imports";

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
const marker = `import-ui-${crypto.randomUUID()}`,
  ids: ObjectId[] = [],
  objects = new Map<string, { bytes: Uint8Array; type: string }>();
const cors = {
  "Access-Control-Allow-Origin": login.origin,
  "Access-Control-Allow-Methods": "PUT,GET,HEAD,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,cache-control,if-none-match",
  "Access-Control-Expose-Headers": "ETag,Content-Disposition",
};
let uploads = 0;
const storage = Bun.serve({
  hostname: "127.0.0.1",
  port: 3205,
  async fetch(request) {
    const url = new URL(request.url),
      key = url.pathname;
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cors });
    if (
      !request.headers.has("authorization") &&
      !url.searchParams.has("X-Amz-Signature")
    )
      return new Response(null, { status: 403, headers: cors });
    if (request.method === "PUT") {
      if (request.headers.get("if-none-match") === "*" && objects.has(key))
        return new Response(null, { status: 412, headers: cors });
      if (key.startsWith("/synthetic-p6/imports/")) {
        assert.equal(
          request.headers.get("content-type"),
          "text/csv; charset=utf-8",
        );
        assert.equal(request.headers.get("cache-control"), "private, no-store");
        assert.equal(request.headers.get("if-none-match"), "*");
        uploads++;
      }
      const bytes = new Uint8Array(await request.arrayBuffer());
      assert.equal(bytes.length, Number(request.headers.get("content-length")));
      objects.set(key, {
        bytes,
        type: request.headers.get("content-type") ?? "text/csv",
      });
      return new Response(null, { headers: { ...cors, ETag: '"synthetic"' } });
    }
    const object = objects.get(key);
    if (!object) return new Response(null, { status: 404, headers: cors });
    return new Response(request.method === "HEAD" ? null : object.bytes, {
      headers: {
        ...cors,
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
const worker = createImportWorker({
  db,
  cache,
  store,
  durable,
  linkDomain: ctx.linkDomain,
  queueName: `imports-ui-${crypto.randomUUID()}`,
  log: (message) => console.log(message),
});
const browser = await chromium.launch({ headless: true }),
  directory = "test-results/captures/p6-import-ui",
  captures: object[] = [],
  errors: string[] = [];
const base = `${login.origin}/${login.workspace}/imports`;
await mkdir(directory, { recursive: true });
async function waitState(id: string, states: string[]) {
  for (let i = 0; i < 100; i++) {
    const job = await importJobs(db).findOne({ _id: new ObjectId(id) });
    if (job && states.includes(job.state)) return job;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Expected ${states.join("/")} for owned fixture ${id}`);
}
async function processJob(id: string, state: string) {
  await worker.pump();
  return waitState(id, [state]);
}
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
async function locale(page: Page, value: string, dark: boolean) {
  await page
    .context()
    .addCookies([{ name: "NEXT_LOCALE", value, url: login.origin }]);
  await page.evaluate(
    (dark) => localStorage.setItem("theme", dark ? "dark" : "light"),
    dark,
  );
}
try {
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
  for (const [value, dark, width] of [
    ["en", false, 1440],
    ["pt", true, 390],
    ["es", false, 390],
  ] as const) {
    await locale(page, value, dark);
    await page.goto(`${base}/new?kind=links`);
    await page
      .getByRole("button", {
        name:
          value === "en"
            ? "Upload and continue"
            : value === "pt"
              ? "Carregar e continuar"
              : "Subir y continuar",
      })
      .waitFor();
    assert.equal(
      await page
        .locator("html")
        .evaluate((html) => html.classList.contains("dark")),
      dark,
    );
    await capture(
      page,
      `${value}-upload-${dark ? "dark" : "light"}-${width}`,
      width,
    );
  }
  await locale(page, "en", false);
  await page.goto(`${base}/new`);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const csv = [
    "url,key,title,tags",
    ...Array.from(
      { length: 54 },
      (_, index) =>
        `https://example.com/${marker}/${index},,São João ${"Editorial edição semanal ".repeat(12)},${index % 2 ? "Campaign" : "Editorial"};${marker}`,
    ),
    ",missing,Missing URL,Editorial",
  ].join("\n");
  await page.locator('input[type="file"]').setInputFiles({
    name: "synthetic.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page.getByRole("button", { name: "Upload and continue" }).click();
  await page.waitForURL(new RegExp("/imports/[a-f0-9]{24}$"));
  const largeId = page.url().split("/").at(-1)!;
  ids.push(new ObjectId(largeId));
  await waitState(largeId, ["inspect_pending"]);
  await page
    .getByRole("heading", { name: "Waiting to inspect file" })
    .waitFor();
  await capture(page, "en-inspecting-light-1440", 1440);
  await processJob(largeId, "mapping");
  await page.getByRole("button", { name: "Run dry run" }).waitFor();
  await capture(page, "en-mapping-light-1440", 1440);
  await locale(page, "pt", true);
  await page.reload();
  await page.getByRole("button", { name: "Executar simulação" }).waitFor();
  await capture(page, "pt-mapping-dark-390", 390);
  await locale(page, "en", false);
  await page.reload();
  await page.locator('select[name="title"]').selectOption("0");
  await page.getByRole("button", { name: "Run dry run" }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Choose a destination column" })
    .waitFor();
  assert.equal(
    (await importJobs(db).findOne({ _id: new ObjectId(largeId) }))?.state,
    "mapping",
  );
  await page.locator('select[name="title"]').selectOption("2");
  await page.getByRole("button", { name: "Run dry run" }).click();
  await waitState(largeId, ["validate_pending"]);
  await processJob(largeId, "ready");
  await page.getByRole("heading", { name: "Review dry run" }).waitFor();
  assert.equal(
    await importReservations(db).countDocuments({ _id: new ObjectId(largeId) }),
    0,
  );
  assert.equal(
    (await importJobs(db).findOne({ _id: new ObjectId(largeId) }))?.valid,
    54,
  );
  await capture(page, "en-review-light-1440", 1440);
  const downloaded = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download errors CSV" }).click();
  const report = await downloaded;
  assert.equal(report.suggestedFilename(), "import-errors.csv");
  assert.match(await readFile((await report.path())!, "utf8"), /missing_url/);
  await page.locator('select[name="status"]').selectOption("invalid");
  await page.waitForURL((url) => url.searchParams.get("status") === "invalid");
  await page.getByText("1 matching row", { exact: true }).waitFor();
  assert.match(
    await page.locator('form[role="search"]').innerText(),
    /Status: Invalid/,
  );
  assert.doesNotMatch(
    await page.locator('form[role="search"]').innerText(),
    /\bnone\b/,
  );
  await capture(page, "en-errors-light-390", 390);
  await page.goto(`${base}/${largeId}`);

  await page.getByRole("link", { name: "Next", exact: true }).click();
  await page.waitForURL((url) => url.searchParams.get("page") === "2");
  await page.getByText("Page 2 of 3").waitFor();
  await capture(page, "en-results-page2-light-1440", 1440);
  await page.locator('input[name="tag"]').fill("Campaign");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.waitForURL((url) => url.searchParams.get("tag") === "Campaign");
  await page.getByText("27 matching rows", { exact: true }).waitFor();
  await page.locator('select[name="group"]').selectOption("error");
  await page.waitForURL((url) => url.searchParams.get("group") === "error");
  await locale(page, "pt", true);
  await page.goto(`${base}/${largeId}`);
  await page.getByRole("heading", { name: "Rever simulação" }).waitFor();
  await capture(page, "pt-review-dark-390", 390);
  await page.locator('select[name="status"]').selectOption("invalid");
  await page.waitForURL((url) => url.searchParams.get("status") === "invalid");
  await page.getByText("1 linha correspondente", { exact: true }).waitFor();
  assert.match(
    await page.locator('form[role="search"]').innerText(),
    /Estado: Inválida/,
  );
  assert.doesNotMatch(
    await page.locator('form[role="search"]').innerText(),
    /\bnone\b|\binvalid\b/,
  );
  await capture(page, "pt-errors-dark-390", 390);
  await locale(page, "en", false);
  await page.goto(`${base}/${largeId}`);
  await page.getByRole("button", { name: "Create all 54 valid links" }).click();
  await waitState(largeId, ["commit_pending"]);
  await processJob(largeId, "ready");
  await page
    .getByRole("alert")
    .filter({ hasText: "insufficient capacity" })
    .waitFor();
  await capture(page, "en-quota-refusal-light-1440", 1440);
  await page.getByRole("button", { name: "Cancel remaining rows" }).click();
  await waitState(largeId, ["cancelled"]);
  await page.getByRole("heading", { name: "Import cancelled" }).waitFor();
  await page.goto(`${base}/new?kind=qr`);
  await page.getByRole("radio", { name: "Paste URLs" }).check();
  await page
    .locator('textarea[name="urls"]')
    .fill(`https://example.com/${marker}/qr`);
  await page.getByRole("button", { name: "Upload and continue" }).click();
  await page.waitForURL(new RegExp("/imports/[a-f0-9]{24}$"));
  const qrId = page.url().split("/").at(-1)!;
  ids.push(new ObjectId(qrId));
  await waitState(qrId, ["inspect_pending"]);
  await processJob(qrId, "mapping");
  await page.getByRole("button", { name: "Run dry run" }).click();
  await waitState(qrId, ["validate_pending"]);
  await processJob(qrId, "ready");
  await page
    .getByRole("button", { name: "Create all 1 valid QR code" })
    .click();
  await waitState(qrId, ["commit_pending"]);
  await page.getByRole("heading", { name: "Waiting to create rows" }).waitFor();
  await capture(page, "en-commit-pending-light-1440", 1440);
  await processJob(qrId, "completed");
  await page.getByRole("heading", { name: "Import completed" }).waitFor();
  await capture(page, "en-completed-light-1440", 1440);
  await locale(page, "es", true);
  await page.reload();
  await page.getByRole("heading", { name: "Importación completada" }).waitFor();
  await capture(page, "es-completed-dark-390", 390);
  await locale(page, "en", false);
  await page.goto(`${base}/new?kind=links`);
  await page.getByRole("radio", { name: "Paste URLs" }).check();
  await page
    .locator('textarea[name="urls"]')
    .fill(`https://example.com/${marker}/link`);
  await page.getByRole("button", { name: "Upload and continue" }).click();
  await page.waitForURL(new RegExp("/imports/[a-f0-9]{24}$"));
  const linkJobId = page.url().split("/").at(-1)!;
  ids.push(new ObjectId(linkJobId));
  await waitState(linkJobId, ["inspect_pending"]);
  await processJob(linkJobId, "mapping");
  await page.getByRole("button", { name: "Run dry run" }).click();
  await waitState(linkJobId, ["validate_pending"]);
  await processJob(linkJobId, "ready");
  await page
    .getByRole("button", { name: "Create all 1 valid link", exact: true })
    .click();
  await waitState(linkJobId, ["commit_pending"]);
  await processJob(linkJobId, "completed");
  await page.getByRole("heading", { name: "Import completed" }).waitFor();
  await capture(page, "en-link-completed-light-390", 390);
  for (let index = 0; index < 27; index++) {
    const result = await createImportJob(ctx, 1, index % 2 ? "qr" : "links");
    if (!result.ok) throw new Error(result.error);
    ids.push(result.value._id);
  }
  await locale(page, "en", false);
  await page.goto(base);
  await page.getByRole("link", { name: "Next", exact: true }).waitFor();
  await capture(page, "en-history-light-1440", 1440);
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await page.waitForURL((url) => url.searchParams.get("page") === "2");
  await page.goto(`${base}/000000000000000000000000`);
  await page
    .getByRole("status")
    .filter({ hasText: "unavailable or has expired" })
    .waitFor();
  await capture(page, "en-expired-light-390", 390);
  assert.equal(uploads, 3);
  assert.deepEqual(errors, []);
  await writeFile(
    `${directory}/evidence.json`,
    JSON.stringify(
      {
        synthetic: true,
        uploads,
        assertions: [
          "direct private conditional upload",
          "three locales and themes",
          "mapping duplicate recovery",
          "55-row dry run without writes",
          "server pagination and tag filtering",
          "whole-quota refusal",
          "cancel",
          "pasted URL link and QR creation",
          "error CSV download",
          "background progress",
          "history pagination",
          "missing/expired recovery",
          "no page errors",
          "mobile bounds",
        ],
        captures,
      },
      null,
      2,
    ),
  );
  console.log(
    `Import browser checks passed; ${captures.length} captures, ${uploads} direct uploads.`,
  );
} finally {
  await worker.worker.close();
  await worker.queue.obliterate({ force: true });
  await worker.close();
  await browser.close();
  storage.stop(true);
  const owned = { jobId: { $in: ids } };
  await importRows(db).deleteMany(owned);
  await importResults(db).deleteMany(owned);
  await importJobs(db).deleteMany({ _id: { $in: ids } });
  await importReservations(db).deleteMany({ _id: { $in: ids } });
  await importReceipts(db).deleteMany({ reservationId: { $in: ids } });
  const links = await collection(db, "links")
    .find({ workspaceId: workspace._id, longUrl: { $regex: marker } })
    .toArray();
  await collection(db, "qr_codes").deleteMany({
    workspaceId: workspace._id,
    linkId: { $in: links.map((row) => row._id) },
  });
  for (const link of links) {
    const domain = link.domain ?? ctx.linkDomain;
    await cache.unlink(
      `link:${domain}:${link.urlCode}`,
      `cache-generation:link:${domain}:${link.urlCode}`,
    );
  }
  await collection(db, "links").deleteMany({
    _id: { $in: links.map((row) => row._id) },
  });
  await collection(db, "tags").deleteMany({
    workspaceId: workspace._id,
    name: marker,
  });
  await db.collection(physicalNames.webhook_events).deleteMany({
    workspaceId: workspace._id,
    "data.importId": { $in: ids.map(String) },
  });
  cache.disconnect();
  durable.disconnect();
  await mongo.close();
}
