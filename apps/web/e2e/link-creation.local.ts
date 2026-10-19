import { strict as assert } from "node:assert";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium, type Page } from "playwright-core";
import { MongoClient, ObjectId } from "mongodb";
import Redis from "ioredis";
import { collection, physicalNames } from "@shortn/db";

const login = JSON.parse(await readFile("/tmp/shortn-p6-login.json", "utf8"));
assert.equal(login.origin, "http://localhost:3200");
const mongo = await new MongoClient(
    "mongodb://127.0.0.1:27020/?directConnection=true",
  ).connect(),
  db = mongo.db("shortn_p6_dev"),
  durable = new Redis("redis://127.0.0.1:16379/6");
const directory = "test-results/captures/p6-link-creation",
  captures: object[] = [],
  errors: string[] = [],
  workspaceId = new ObjectId(),
  slug = `creation-helper-${crypto.randomUUID()}`;
await mkdir(directory, { recursive: true });
const workspace = {
    _id: workspaceId,
    name: "Synthetic creation helpers",
    slug,
    personal: false,
    ownerUserId: login.userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  root = `${login.origin}/${slug}/links`;
const userFilter = { _id: new ObjectId(login.userId) },
  previousUser = await db.collection(physicalNames.user).findOne(userFilter);
import { createServer, request as httpRequest } from "node:http";
import {
  fetchLinkTitle,
  runLinkMetadataBatch,
} from "../../worker/src/link-metadata";
import { pinnedLookup } from "../../worker/src/webhook-sender";
import { ensureLinkMetadataIndexes, linkMetadataJobs } from "@shortn/core";
let retries = 0;
const fixture = createServer((request, response) => {
  const path = new URL(request.url!, "http://localhost").pathname;
  const send = () => {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    if (path === "/missing") {
      response.end("<html>No title</html>");
      return;
    }
    if (path === "/retry" && retries++ === 0) {
      response.statusCode = 503;
      response.end("Unavailable");
      return;
    }
    response.end(
      `<title>Fallback</title><meta property="og:title" content="Synthetic page ${path.includes("two") ? "two" : "one"} &amp; newsletter">`,
    );
  };
  if (path.includes("slow")) setTimeout(send, 1800);
  else send();
});
await new Promise<void>((resolve) => fixture.listen(0, "127.0.0.1", resolve));
const fixturePort = (fixture.address() as { port: number }).port;
const metadataFetch = (url: string) =>
  fetchLinkTitle(url, {
    resolve: async () => [{ address: "8.8.8.8", family: 4 }],
    request: ((url, options, callback) =>
      httpRequest(
        new URL(
          new URL(String(url)).pathname,
          `http://127.0.0.1:${fixturePort}`,
        ),
        {
          ...options,
          headers: { ...options.headers, Host: new URL(String(url)).host },
          lookup: pinnedLookup({ address: "127.0.0.1", family: 4 }),
        },
        callback,
      )) as typeof httpRequest,
  });
let pumping: Promise<unknown> | undefined;
await ensureLinkMetadataIndexes(db);
const workerTimer = setInterval(() => {
  if (!pumping)
    pumping = runLinkMetadataBatch(
      db,
      metadataFetch,
      new Date(),
      workspaceId,
    ).finally(() => {
      pumping = undefined;
    });
}, 100);
const browser = await chromium.launch({ headless: true });
async function capture(page: Page, name: string, width: number) {
  await page.setViewportSize({ width, height: 1000 });
  await page.evaluate(() => document.fonts.ready);
  await page.locator("#main").evaluate((main) => {
    main.scrollTop = 0;
  });
  await page.waitForTimeout(300);
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
    fullPage: false,
    heading: await page.locator("main h1").textContent(),
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
  const campaigns = Array.from({ length: 1 }, (_, i) => ({
    _id: new ObjectId(),
    workspaceId,
    title: `Synthetic campaign ${String(i).padStart(4, "0")}${i === 1 ? " — Weekly editorial publishing and newsletters" : ""}`,
    links: [] as ObjectId[],
    utmDefaults: { sources: ["DO_NOT_APPLY_DEFAULT"] },
  }));
  const tags = Array.from({ length: 10 }, (_, i) => ({
    _id: new ObjectId(),
    workspaceId,
    id: crypto.randomUUID(),
    name: `Synthetic tag ${String(i).padStart(3, "0")}`,
    tagName: `Synthetic tag ${String(i).padStart(3, "0")}`,
    nameLower: `synthetic tag ${String(i).padStart(3, "0")}`,
  }));
  await db.collection(physicalNames.tags).insertMany(tags);
  const links = Array.from({ length: 1 }, (_, i) => ({
    _id: new ObjectId(),
    workspaceId,
    urlCode: `synthetic-${workspaceId}-${i}`,
    longUrl: `https://example.com/${i}`,
    title: `Synthetic title ${i} — ${"Weekly publication ".repeat(10)}`,
    tags: [
      {
        _id: tags[i % 2]!._id,
        id: tags[i % 2]!.id,
        tagName: tags[i % 2]!.name,
      },
    ],
    tagIds: [tags[i % 2]!._id],
    date: new Date(Date.now() - i * 1000),
    createdAt: new Date(),
    createdBy: login.userId,
    utmLinks: [
      {
        source: "Newsletter",
        medium: "Email",
        campaign: { _id: campaigns[0]!._id, title: campaigns[0]!.title },
      },
      {
        source: "Social",
        term: "Keep",
        content: "Original",
        campaign: { title: "Legacy campaign" },
      },
    ],
    rules: { forwardQuery: true },
    _sync: { rev: 1 },
  }));
  campaigns[0]!.links = links.map((link) => link._id);
  await db.collection(physicalNames.campaigns).insertMany(campaigns);
  await db.collection(physicalNames.links).insertMany(links);
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      permissions: ["clipboard-read", "clipboard-write"],
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
  await locale(page, "en");
  await page.goto(root);
  const en = JSON.parse(
      await readFile("apps/web/messages/en/linkCreation.json", "utf8"),
    ),
    formText = JSON.parse(
      await readFile("apps/web/messages/en/linkPages.json", "utf8"),
    ).form;
  const paste = async (target: string, url: string) =>
    page.locator(target).evaluate((node, url) => {
      const data = new DataTransfer();
      data.setData("text/plain", url);
      const event = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: data,
      });
      node.dispatchEvent(event);
      return event.defaultPrevented;
    }, url);
  assert.equal(await paste('[name="q"]', "https://example.com/one"), false);
  assert.equal(new URL(page.url()).pathname, new URL(root).pathname);
  await page.evaluate(() => {
    const editable = document.createElement("div");
    editable.id = "creation-editable-fixture";
    editable.setAttribute("contenteditable", "");
    document.body.append(editable);
  });
  assert.equal(
    await paste("#creation-editable-fixture", "https://example.com/one"),
    false,
  );
  await page
    .locator("#creation-editable-fixture")
    .evaluate((node) => node.remove());
  assert.equal(await paste("body", "https://example.com/slow#section"), true);
  await page.waitForURL((url) => url.pathname.endsWith("/new"));
  assert.equal(
    await page.locator('[name="url"]').inputValue(),
    "https://example.com/slow#section",
  );
  await page.getByText(en.loading, { exact: true }).waitFor();
  await capture(page, "en-loading-light-1440", 1440);
  await capture(page, "en-loading-light-390", 390);
  await page.locator('[name="title"]').fill("Authored title");
  await page.locator('[name="key"]').fill(`authored-${workspaceId}`);
  await page.getByText(en.ready, { exact: true }).waitFor();
  assert.equal(
    await page.locator('[name="title"]').inputValue(),
    "Authored title",
  );
  assert.equal(
    await page.locator('[name="key"]').inputValue(),
    `authored-${workspaceId}`,
  );
  await capture(page, "en-authored-light-390", 390);
  await page.getByRole("button", { name: en.useTitle, exact: true }).click();
  await page.getByRole("button", { name: en.useKey, exact: true }).click();
  assert.equal(
    await page.locator('[name="title"]').inputValue(),
    "Synthetic page one & newsletter",
  );
  assert.match(
    await page.locator('[name="key"]').inputValue(),
    /^synthetic-page-one-newsletter/,
  );
  await capture(page, "en-ready-light-1440", 1440);
  await capture(page, "en-ready-light-390", 390);
  // Enter submits the normal form; clipboard copy happens once after the successful mutation.
  await page.locator('[name="url"]').press("Enter");
  await page
    .locator("form")
    .first()
    .evaluate((form) => (form as HTMLFormElement).requestSubmit());
  await page.waitForURL((url) => url.searchParams.get("created") === "1");
  assert.equal(
    await db.collection(physicalNames.links).countDocuments({ workspaceId }),
    2,
  );
  await page.getByText(en.copied, { exact: true }).waitFor();
  const firstId = new ObjectId(new URL(page.url()).pathname.split("/").pop()!);
  let created = (await db
    .collection(physicalNames.links)
    .findOne({ _id: firstId }))!;
  assert.equal(created.longUrl, "https://example.com/slow#section");
  assert.equal(created.title, "Synthetic page one & newsletter");
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    `https://${created.domain}/${created.urlCode}`,
  );
  await capture(page, "en-created-light-1440", 1440);
  await capture(page, "en-created-light-390", 390);
  await page.keyboard.press("Meta+k");
  await page.getByRole("dialog").getByText("New link", { exact: true }).click();
  await page.waitForURL((url) => url.pathname.endsWith("/new"));
  await page.locator('[name="url"]').fill("https://example.com/slow-race");
  await page.getByText(en.loading, { exact: true }).waitFor();
  await page.locator('[name="url"]').fill("https://example.com/two-race");
  await page.getByText(en.ready, { exact: true }).waitFor();
  assert.equal(
    await page.locator('[name="title"]').inputValue(),
    "Synthetic page two & newsletter",
  );
  await page.waitForTimeout(2200);
  assert.equal(
    await page.locator('[name="title"]').inputValue(),
    "Synthetic page two & newsletter",
  );
  await page.locator('[name="url"]').fill("https://example.com/missing");
  await page.getByText(en.unavailable, { exact: true }).waitFor();
  await capture(page, "en-unavailable-light-390", 390);
  assert.equal(
    await page
      .getByRole("button", { name: formText.create, exact: true })
      .isEnabled(),
    true,
  );
  await page.locator('[name="url"]').fill("https://example.com/retry");
  await page.getByText(en.unavailable, { exact: true }).waitFor();
  await page.getByRole("button", { name: en.retry, exact: true }).click();
  await page.getByText(en.ready, { exact: true }).waitFor();
  assert.equal(
    await page.locator('[name="title"]').inputValue(),
    "Synthetic page one & newsletter",
  );
  for (const [language, dark] of [
    ["pt", true],
    ["es", false],
    ["en", true],
  ] as const) {
    await locale(page, language, dark);
    await page.goto(
      `${root}/new?url=${encodeURIComponent("https://example.com/retry")}`,
    );
    const copy = JSON.parse(
      await readFile(`apps/web/messages/${language}/linkCreation.json`, "utf8"),
    );
    await page.getByText(copy.ready, { exact: true }).waitFor();
    await capture(
      page,
      `${language}-ready-${dark ? "dark" : "light"}-390`,
      390,
    );
  }
  await locale(page, "en");
  await db
    .collection(physicalNames.subscriptions)
    .updateOne({ workspaceId }, { $set: { status: "canceled" } });
  await page.reload();
  await page.getByText(en.ready, { exact: true }).waitFor();
  assert.equal(await page.locator('[name="key"]').count(), 0);
  assert.equal(
    await page.locator('[name="title"]').inputValue(),
    "Synthetic page one & newsletter",
  );
  await capture(page, "en-free-light-390", 390);
  await db
    .collection(physicalNames.subscriptions)
    .updateOne({ workspaceId }, { $set: { status: "active" } });
  await page.goto(`${root}/new?url=https%3A%2F%2Fexample.com%2Fdenied`);
  await page.getByText(en.ready, { exact: true }).waitFor();
  await page.evaluate(() =>
    Object.defineProperty(navigator.clipboard, "writeText", {
      configurable: true,
      value: async () => {
        throw new Error("Synthetic denied");
      },
    }),
  );
  await page
    .getByRole("button", { name: formText.create, exact: true })
    .click();
  await page.waitForURL((url) => url.searchParams.get("copied") === "0");
  await page.getByText(en.copyDenied, { exact: true }).waitFor();
  await capture(page, "en-copy-denied-light-390", 390);
  await page.goto(`${root}/new`);
  await page
    .locator('[name="url"]')
    .fill("https://example.com/slow-create-immediately");
  await page
    .locator("form")
    .first()
    .evaluate((node) => {
      const form = node as HTMLFormElement;
      form.requestSubmit();
      form.requestSubmit();
    });
  await page.waitForURL((url) => url.searchParams.get("created") === "1");
  created = (await db.collection(physicalNames.links).findOne({
    _id: new ObjectId(new URL(page.url()).pathname.split("/").pop()!),
  }))!;
  assert.equal(created.longUrl, "https://example.com/slow-create-immediately");
  assert.equal(
    await db.collection(physicalNames.links).countDocuments({ workspaceId }),
    4,
  );
  assert.deepEqual(errors, []);
  await writeFile(
    `${directory}/browser-evidence.json`,
    JSON.stringify(
      {
        synthetic: true,
        network:
          "loopback HTML server, public DNS fixture, pinned request adapter; actual worker claim/fetch/parser/status and native Next/session/server actions",
        captures,
        checks: [
          "editable paste ignored; body URL paste preserves fragment",
          "loading/ready/unavailable/retry",
          "authored title/key retained and explicit suggestion opt-in",
          "Enter/duplicate guard creates once and clipboard matches actual key/domain",
          "command palette new link",
          "stale URL result ignored",
          "en/pt/es themes1440/390",
          "free title with gated key",
          "clipboard denial truthful recovery",
          "creation before lookup completes",
          "no browser errors",
        ],
      },
      null,
      2,
    ),
  );
  console.log("Link creation browser checks passed.");
} finally {
  clearInterval(workerTimer);
  await pumping?.catch(() => {});
  await new Promise<void>((resolve) => fixture.close(() => resolve()));
  await linkMetadataJobs(db).deleteMany({ workspaceId });
  await durable.del(`links:metadata-rate:${workspaceId}:${login.userId}`);
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
    physicalNames.links,
    physicalNames.tags,
    physicalNames.campaigns,
    physicalNames.subscriptions,
    physicalNames.workspace_members,
  ])
    await db.collection(name).deleteMany({ workspaceId });
  await collection(db, "workspaces").deleteOne({ _id: workspaceId });
  let cursor = "0";
  do {
    const [next, found] = await durable.scan(
      cursor,
      "MATCH",
      `links:advanced-selection:${workspaceId}:*`,
      "COUNT",
      1000,
    );
    cursor = next;
    if (found.length) await durable.unlink(...found);
  } while (cursor !== "0");
  durable.disconnect();
  await mongo.close();
}
