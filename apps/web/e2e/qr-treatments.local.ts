/** Real dashboard, server actions and downloadable pixels; synthetic local data only. */
import { strict as assert } from "node:assert";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium, type Page } from "playwright-core";
import { MongoClient, ObjectId } from "mongodb";
import Redis from "ioredis";
import sharp from "sharp";
import jsQR from "jsqr";
import { collection, physicalNames } from "@shortn/db";
import { renderQrExport } from "@shortn/qr-render";
import { createObjectStore } from "@shortn/storage";
import { runQrExport } from "../../worker/src/qr-exports";
const login = JSON.parse(await readFile("/tmp/shortn-p6-login.json", "utf8"));
assert.equal(login.origin, "http://localhost:3200");
const mongo = await new MongoClient(
    "mongodb://127.0.0.1:27020/?directConnection=true",
  ).connect(),
  db = mongo.db("shortn_p6_dev"),
  cache = new Redis("redis://127.0.0.1:16380/6");
const workspaceId = new ObjectId(),
  slug = `qr-treatment-${crypto.randomUUID()}`,
  directory = ".impeccable/review/p6-qr-treatments",
  captures: object[] = [],
  errors: string[] = [];
const workspace = {
  _id: workspaceId,
  name: "Synthetic QR treatments",
  slug,
  personal: false,
  ownerUserId: login.userId,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const userFilter = { _id: new ObjectId(login.userId) },
  previousUser = await db.collection(physicalNames.user).findOne(userFilter);
await mkdir(directory, { recursive: true });
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
    const item = objects.get(key);
    if (!item) return new Response(null, { status: 404 });
    return new Response(request.method === "HEAD" ? null : item.bytes, {
      headers: {
        "Content-Type": item.type,
        "Content-Length": String(item.bytes.length),
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
const browser = await chromium.launch({ headless: true });
async function capture(
  page: Page,
  name: string,
  width: number,
  section = false,
) {
  await page.setViewportSize({ width, height: 1000 });
  await page.evaluate(() => document.fonts.ready);
  if (section)
    await page
      .locator("aside[aria-label]")
      .last()
      .evaluate((node) => node.scrollIntoView({ block: "start" }));
  else
    await page.locator("#main").evaluate((main) => {
      main.scrollTop = 0;
    });
  if (section)
    await page.locator("#main").evaluate((main) => {
      main.scrollTop = Math.max(0, main.scrollTop - 60);
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
  captures.push({
    file,
    width,
    height: 1000,
    fullPage: false,
    section: section ? "preview" : "document-top",
  });
}
async function rendered(page: Page) {
  await page.locator("aside[aria-label] img").last().waitFor();
  await page.waitForTimeout(250);
  await page
    .locator("aside[aria-label] img")
    .last()
    .evaluate(async (node) => {
      await (node as HTMLImageElement).decode();
    });
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
  await page.locator('[name="identifier"]').fill(login.email);
  await page.locator('[name="password"]').fill(login.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  const base = `${login.origin}/${slug}/qr`;
  await page.goto(`${base}/new`);
  await page
    .locator('[name="url"]')
    .fill("https://example.com/synthetic-qr-treatment");
  await page
    .getByRole("radiogroup", { name: "Shape", exact: true })
    .getByRole("radio", { name: "Circle", exact: true })
    .click();
  await page
    .getByRole("radiogroup", { name: "Frame", exact: true })
    .getByRole("radio", { name: "Outline", exact: true })
    .click();
  await page.locator('[name="qr-caption"]').fill("São João — escanea aquí");
  await rendered(page);
  await capture(page, "en-circle-outline-create-light-1440", 1440);
  await capture(page, "en-circle-outline-create-light-390", 390);
  await capture(page, "en-circle-outline-preview-light-390", 390, true);
  await page
    .getByRole("button", { name: "Create QR code", exact: true })
    .click();
  await page.waitForURL((url) => url.searchParams.get("created") === "1");
  const id = new ObjectId(new URL(page.url()).pathname.split("/").at(-1)!);
  let qr = (await collection(db, "qr_codes").findOne({ _id: id }))!;
  assert.equal((qr.options as Record<string, unknown>).shape, "circle");
  assert.deepEqual((qr.options as Record<string, unknown>).frameOptions, {
    style: "outline",
    caption: "São João — escanea aquí",
  });
  const data = String((qr.options as Record<string, unknown>).data);
  await page
    .getByRole("link", { name: "Export for print", exact: true })
    .click();
  await page.locator('select[name="format"]').selectOption("png");
  await page
    .getByRole("button", { name: "Prepare download", exact: true })
    .click();
  await page.waitForURL((url) =>
    /\/qr\/exports\/[a-f0-9]{24}$/.test(url.pathname),
  );
  const jobId = new URL(page.url()).pathname.split("/").at(-1)!;
  assert(
    await runQrExport(
      { db, store, linkDomain: "shortn.invalid", logoOrigins: [login.origin] },
      jobId,
    ),
  );
  const event = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download file", exact: true }).click();
  const download = await event;
  assert.equal(await download.failure(), null);
  const bytes = await readFile((await download.path())!);
  const client = await sharp(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(
    jsQR(
      new Uint8ClampedArray(client.data),
      client.info.width,
      client.info.height,
    )?.data,
    data,
  );
  const server = await renderQrExport(
    qr.options as Record<string, unknown>,
    data,
    "png",
    1024,
  );
  const native = await sharp(server.bytes).ensureAlpha().raw().toBuffer();
  let changed = 0;
  for (let i = 0; i < native.length; i += 4)
    if (
      [0, 1, 2, 3].some(
        (channel) =>
          Math.abs(native[i + channel]! - client.data[i + channel]!) > 16,
      )
    )
      changed++;
  assert(
    changed / (1024 * 1024) < 0.01,
    `actual download differs ${((changed / (1024 * 1024)) * 100).toFixed(3)}%`,
  );
  await page.goto(`${base}/${id}`);
  await capture(page, "en-created-light-1440", 1440);
  const edit = `${base}/${id}/design`;
  await page.goto(edit);
  await rendered(page);
  await page.locator('[name="qr-caption"]').fill("Unsupported 🎉");
  await page.getByRole("button", { name: "Save design", exact: true }).click();
  await page
    .getByText(/Some symbols are not supported/)
    .first()
    .waitFor();
  await page.getByText("Preview unavailable", { exact: true }).waitFor();
  assert.equal(await page.locator("aside img").count(), 0);
  qr = (await collection(db, "qr_codes").findOne({ _id: id }))!;
  assert.equal(
    (qr.options as { frameOptions: { caption: string } }).frameOptions.caption,
    "São João — escanea aquí",
  );
  await capture(page, "en-invalid-caption-light-390", 390);
  await page.locator('[name="qr-caption"]').fill("Synthetic summer menu");
  await page
    .getByRole("radiogroup", { name: "Frame", exact: true })
    .getByRole("radio", { name: "Solid", exact: true })
    .click();
  await rendered(page);
  await capture(page, "en-circle-solid-light-1440", 1440);
  await capture(page, "en-circle-solid-preview-light-390", 390, true);
  await page.getByRole("button", { name: "Save design", exact: true }).click();
  await page.waitForURL((url) => url.searchParams.get("saved") === "1");
  for (const [language, dark] of [
    ["pt", true],
    ["es", false],
  ] as const) {
    await context.addCookies([
      { name: "NEXT_LOCALE", value: language, url: login.origin },
    ]);
    await page.evaluate(
      (dark) => localStorage.setItem("theme", dark ? "dark" : "light"),
      dark,
    );
    await page.goto(edit);
    await rendered(page);
    await capture(
      page,
      `${language}-controls-${dark ? "dark" : "light"}-390`,
      390,
    );
    await capture(
      page,
      `${language}-preview-${dark ? "dark" : "light"}-390`,
      390,
      true,
    );
  }
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", url: login.origin },
  ]);
  await page.evaluate(() => localStorage.setItem("theme", "light"));
  await page.goto(edit);
  await page
    .getByRole("radiogroup", { name: "Shape", exact: true })
    .getByRole("radio", { name: "Square", exact: true })
    .click();
  await page
    .getByRole("radiogroup", { name: "Frame", exact: true })
    .getByRole("radio", { name: "None", exact: true })
    .click();
  await page.locator('[name="qr-caption"]').fill("");
  await rendered(page);
  await capture(page, "en-cleared-light-1440", 1440);
  await page.getByRole("button", { name: "Save design", exact: true }).click();
  await page.waitForURL((url) => url.searchParams.get("saved") === "1");
  qr = (await collection(db, "qr_codes").findOne({ _id: id }))!;
  assert.equal((qr.options as Record<string, unknown>).data, data);
  assert.deepEqual((qr.options as Record<string, unknown>).frameOptions, {
    style: "none",
    caption: "",
  });
  assert.deepEqual(errors, []);
  await writeFile(
    `${directory}/browser-evidence.json`,
    JSON.stringify(
      {
        synthetic: true,
        network:
          "actual Next/session/actions/native Mongo/Redis; local downloadable QR and worker renderer pixels",
        captures,
        actualDownloadDifference: changed / (1024 * 1024),
        checks: [
          "free-plan circle/frame/caption create and persist",
          "actual worker/download PNG decodes to saved URL and matches saved-design renderer",
          "unsupported caption refuses before DB write",
          "save/reload and explicit clearing preserve URL",
          "en/pt/es controls and preview light/dark1440/390",
          "no page errors/overflow",
        ],
      },
      null,
      2,
    ),
  );
  console.log("QR treatments browser checks passed.");
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
  for (const name of [
    "qr_codes",
    "links",
    "tags",
    "workspace_members",
    "workspaces",
  ] as const)
    await collection(db, name).deleteMany(
      name === "workspaces" ? { _id: workspaceId } : { workspaceId },
    );
  await db.collection(physicalNames.qr_export_jobs).deleteMany({ workspaceId });
  storage.stop(true);
  await cache.quit();
  await mongo.close();
}
