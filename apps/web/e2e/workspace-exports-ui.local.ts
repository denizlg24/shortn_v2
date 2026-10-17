/** Session-authenticated HTTP exports against synthetic loopback services only. */
import { strict as assert } from "node:assert";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { unzipSync } from "fflate";
import { chromium, type Page } from "playwright-core";
import { MongoClient, ObjectId } from "mongodb";
import Redis from "ioredis";
import { collection, physicalNames } from "@shortn/db";
import { workspaceExportJobs, type ServiceContext } from "@shortn/core";
import { createObjectStore } from "@shortn/storage";
import { createWorkspaceExportWorker } from "../../worker/src/workspace-exports";
const login = JSON.parse(await readFile("/tmp/shortn-p6-login.json", "utf8"));
assert.equal(login.origin, "http://localhost:3200");
const mongo = await new MongoClient(
    "mongodb://127.0.0.1:27020/?directConnection=true",
  ).connect(),
  db = mongo.db("shortn_p6_dev");
const cache = new Redis("redis://127.0.0.1:16380/6"),
  durable = new Redis("redis://127.0.0.1:16379/6");
const notices: { url: string; to: string }[] = [];
let rejectMail = true;
const marker = `workspace-ui-${crypto.randomUUID()}`,
  workspaceId = new ObjectId();
const workspace = {
  _id: workspaceId,
  name: "Synthetic export workspace",
  slug: marker,
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
const worker = createWorkspaceExportWorker({
  db,
  cache,
  durable,
  store,
  linkDomain: ctx.linkDomain,
  appUrl: login.origin,
  mailer: {
    async workspaceExportReady(input) {
      if (rejectMail) throw new Error("synthetic delivery retry");
      notices.push(input);
    },
  },
  queueName: `http-workspace-${crypto.randomUUID()}`,
  log: (message) => console.log(message),
});
const browser = await chromium.launch({ headless: true }),
  base = `${login.origin}/api/workspace-exports/${workspace.slug}`;
const directory = ".impeccable/review/p6-workspace-export-ui",
  captures: object[] = [],
  errors: string[] = [];
await mkdir(directory, { recursive: true });
const root = `${login.origin}/${workspace.slug}/settings/workspace`,
  jobs = workspaceExportJobs(db);
const userCollection = db.collection(physicalNames.user),
  userFilter = { _id: new ObjectId(login.userId) };
const previousUser = await userCollection.findOne(userFilter);
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
    heading: await page.locator("main h1").first().textContent(),
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

async function signIn(page: Page) {
  await page.locator('input[name="identifier"]').fill(login.email);
  await page.locator('input[name="password"]').fill(login.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}
async function ready(id: string, field: "state" | "emailState", value: string) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const row = await jobs.findOne({ _id: new ObjectId(id) });
    if (row?.[field] === value) return row;
    assert.notEqual(row?.state, "failed", JSON.stringify(row));
    await Bun.sleep(100);
  }
  throw new Error(`Timeout: ${field}=${value}`);
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
  const links = Array.from({ length: 5001 }, (_, i) => ({
    _id: new ObjectId(),
    workspaceId,
    urlCode: `${marker}-${i}`,
    longUrl: `https://example.com/${i}`,
    title: `Synthetic library link ${i}`,
    createdAt: new Date(),
  }));
  await db.collection(physicalNames.links).insertMany(links);
  await db
    .collection(physicalNames.bio_pages)
    .insertOne({
      _id: new ObjectId(),
      workspaceId,
      slug: marker,
      title: "Synthetic legacy bio",
      links: links
        .slice(0, 2501)
        .map((link) => ({ link: link._id, title: link.title })),
    });
  await collection(db, "tags").insertMany(
    Array.from({ length: 100 }, (_, i) => ({
      _id: new ObjectId(),
      workspaceId,
      id: crypto.randomUUID(),
      name: `Synthetic tag ${i}`,
      nameLower: `synthetic tag ${i}`,
    })),
  );
  const context = await browser.newContext({ acceptDownloads: true }),
    page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", url: login.origin },
  ]);
  await page.goto(`${login.origin}/login`);
  await signIn(page);
  await locale(page, "en");
  await page.goto(`${login.origin}/${workspace.slug}/settings`);
  await page
    .getByRole("link", { name: "Export workspace", exact: true })
    .waitFor();
  await capture(page, "en-settings-light-1440", 1440);
  await page.goto(`${root}/exports`);
  await page
    .getByText("No background exports match these filters.", { exact: true })
    .waitFor();
  await capture(page, "en-empty-light-390", 390);
  await page.goto(`${root}/export`);
  await page
    .getByRole("button", { name: "Prepare export", exact: true })
    .waitFor();
  await capture(page, "en-review-light-1440", 1440);
  await capture(page, "en-review-light-390", 390);
  let requests = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(base, async (route) => {
    if (route.request().method() === "POST") {
      requests++;
      await gate;
    }
    await route.continue();
  });
  await page
    .getByRole("button", { name: "Prepare export", exact: true })
    .click();
  await page
    .locator("form")
    .evaluate((form) => (form as HTMLFormElement).requestSubmit());
  await page.waitForTimeout(200);
  assert.equal(requests, 1);
  release();
  await page.waitForURL((url) => /\/exports\/[a-f\d]{24}$/.test(url.pathname));
  await page.unroute(base);
  const cancelledId = page.url().split("/").at(-1)!;
  await page.getByText("Waiting to export", { exact: true }).waitFor();
  await capture(page, "en-pending-light-390", 390);
  await page.goto(`${root}/export`);
  await page
    .getByRole("link", { name: "Continue export", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Prepare export", exact: true })
      .count(),
    0,
  );
  await page
    .getByRole("link", { name: "Continue export", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cancel export", exact: true })
    .click();
  await page.getByText("Export cancelled", { exact: true }).first().waitFor();
  await capture(page, "en-cancelled-light-1440", 1440);
  await page.goto(`${root}/export`);
  await page
    .getByRole("button", { name: "Prepare export", exact: true })
    .click();
  await page.waitForURL((url) => /\/exports\/[a-f\d]{24}$/.test(url.pathname));
  const id = page.url().split("/").at(-1)!;
  assert.notEqual(id, cancelledId);
  await worker.queue.add(
    "export",
    { id },
    { removeOnComplete: true, removeOnFail: true },
  );
  await ready(id, "state", "completed");
  await page
    .getByRole("link", { name: "Download ZIP", exact: true })
    .waitFor({ timeout: 30000 });
  await capture(page, "en-completed-mail-pending-light-1440", 1440);
  await capture(page, "en-completed-mail-pending-light-390", 390);
  const files = unzipSync(await download(page, "Download ZIP"));
  assert.equal(Object.keys(files).length, 18);
  assert.equal(
    JSON.parse(Buffer.from(files["links.json"]!).toString()).length,
    5001,
  );
  assert.equal(
    JSON.parse(Buffer.from(files["bio_pages.json"]!).toString())[0].legacy.links
      .length,
    2501,
  );
  rejectMail = false;
  await jobs.updateOne(
    { _id: new ObjectId(id) },
    { $set: { mailNextAt: new Date(0) } },
  );
  await worker.queue.add(
    "notify",
    { id, task: "notify" },
    { removeOnComplete: true, removeOnFail: true },
  );
  await ready(id, "emailState", "sent");
  await page
    .getByText("The ready link was emailed to your current sign-in address.", {
      exact: true,
    })
    .waitFor({ timeout: 22000 });
  assert.equal(notices.length, 1);
  assert.equal(notices[0]!.url, `${root}/exports/${id}`);
  assert(!notices[0]!.url.includes("Signature"));
  for (const [language, dark, width] of [
    ["pt", true, 390],
    ["es", false, 390],
    ["en", true, 1440],
  ] as const) {
    await locale(page, language, dark);
    await page.reload();
    await page.locator("main h1").first().waitFor();
    await capture(
      page,
      `${language}-completed-${dark ? "dark" : "light"}-${width}`,
      width,
    );
  }
  await locale(page, "en");
  await page.reload();
  const fresh = await browser.newContext({ acceptDownloads: true }),
    mailPage = await fresh.newPage();
  await mailPage.goto(notices[0]!.url);
  assert.equal(new URL(mailPage.url()).pathname, "/login");
  assert.equal(
    new URL(mailPage.url()).searchParams.get("next"),
    new URL(notices[0]!.url).pathname,
  );
  await signIn(mailPage);
  assert.equal(mailPage.url(), notices[0]!.url);
  assert.equal(
    Object.keys(unzipSync(await download(mailPage, "Download ZIP"))).length,
    18,
  );
  await fresh.close();
  const forged = await fetch(`${login.origin}/${workspace.slug}/links`, {
    redirect: "manual",
    headers: {
      "x-shortn-workspace-export-path": new URL(notices[0]!.url).pathname,
    },
  });
  assert.equal(
    new URL(forged.headers.get("location")!, login.origin).search,
    "",
  );
  const row = await jobs.findOne({ _id: new ObjectId(id) });
  assert(row);
  await jobs.insertMany(
    Array.from({ length: 30 }, (_, i) => ({
      ...row,
      _id: new ObjectId(),
      requestKey: `${marker}-${i}`,
      state: "cancelled" as const,
      objectKey: undefined,
      createdAt: new Date(Date.now() - i * 1000 - 10000),
    })),
  );
  await page.goto(`${root}/exports`);
  assert.equal(await page.locator("ul.divide-y > li").count(), 25);
  await capture(page, "en-history-light-1440", 1440);
  await capture(page, "en-history-light-390", 390);
  await page.goto(`${root}/exports?page=2`);
  assert.equal(await page.locator("ul.divide-y > li").count(), 7);
  await page.goto(`${root}/exports?state=completed`);
  assert.equal(await page.locator("ul.divide-y > li").count(), 1);
  await jobs.updateOne(
    { _id: new ObjectId(id) },
    { $set: { emailState: "pending" } },
  );
  await page.goto(`${root}/exports/${id}`);
  await page.route(`${base}/jobs/${id}`, (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "storage_unavailable" }),
    }),
  );
  await page
    .getByRole("button", { name: "Refresh status", exact: true })
    .click();
  await page
    .getByText(
      "Private storage is temporarily unavailable. Refresh the status later.",
      { exact: true },
    )
    .waitFor();
  await capture(page, "en-retry-light-390", 390);
  await page.unroute(`${base}/jobs/${id}`);
  await collection(db, "workspace_members").updateOne(
    { workspaceId, userId: login.userId },
    { $set: { role: "admin" } },
  );
  await page
    .getByRole("button", { name: "Refresh status", exact: true })
    .click();
  await page
    .getByText(
      "Only the current workspace owner can access this export. Ask the workspace owner for help.",
      { exact: true },
    )
    .waitFor();
  assert.equal(
    await page.getByRole("link", { name: "Download ZIP", exact: true }).count(),
    0,
  );
  await capture(page, "en-owner-loss-light-1440", 1440);
  await page.goto(`${login.origin}/${workspace.slug}/settings`);
  assert.equal(
    await page
      .getByRole("link", { name: "Export workspace", exact: true })
      .count(),
    0,
  );
  await collection(db, "workspace_members").updateOne(
    { workspaceId, userId: login.userId },
    { $set: { role: "owner" } },
  );
  await jobs.updateOne(
    { _id: new ObjectId(id) },
    { $set: { expiresAt: new Date(0) } },
  );
  await page.goto(`${root}/exports/${id}`);
  await page
    .getByText(
      "This export is unavailable or has expired. Prepare a new export.",
      { exact: true },
    )
    .waitFor();
  await capture(page, "en-expired-light-390", 390);
  assert.deepEqual(errors, []);
  await writeFile(
    `${directory}/browser-evidence.json`,
    JSON.stringify(
      {
        synthetic: true,
        freePlan: true,
        links: 5001,
        tags: 100,
        legacyBioLinks: 2501,
        archiveEntries: Object.keys(files),
        captures,
        checks: [
          "owner settings entry",
          "empty history",
          "duplicate submit guard",
          "one active continue",
          "cancel",
          "real private ZIP",
          "mail pending and sent polling",
          "email sign-in exact return/download",
          "spoof header ignored",
          "history 25/page/filter",
          "retry",
          "owner loss hides download/entry",
          "expired",
          "en/pt/es light/dark 1440/390",
          "no browser errors",
        ],
      },
      null,
      2,
    ),
  );
  console.log("Workspace UI browser checks passed.");
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
  await userCollection.updateOne(
    { ...userFilter, lastWorkspaceId: workspaceId.toHexString() },
    previousUser?.lastWorkspaceId
      ? { $set: { lastWorkspaceId: previousUser.lastWorkspaceId } }
      : { $unset: { lastWorkspaceId: "" } },
  );
  await jobs.deleteMany({ workspaceId });
  for (const name of [
    physicalNames.links,
    physicalNames.tags,
    physicalNames.bio_pages,
  ])
    await db.collection(name).deleteMany({ workspaceId });
  await collection(db, "workspace_members").deleteMany({ workspaceId });
  await collection(db, "workspaces").deleteOne({ _id: workspaceId });
  cache.disconnect();
  durable.disconnect();
  await mongo.close();
}
