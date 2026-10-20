import { strict as assert } from "node:assert";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium, type Page } from "playwright-core";
import { MongoClient, ObjectId } from "mongodb";
import Redis from "ioredis";
import { collection, physicalNames } from "@shortn/db";
import { encodeSelection } from "../src/lib/bulk-selection";
const login = JSON.parse(await readFile("/tmp/shortn-p6-login.json", "utf8"));
assert.equal(login.origin, "http://localhost:3200");
const mongo = await new MongoClient(
    "mongodb://127.0.0.1:27020/?directConnection=true",
  ).connect(),
  db = mongo.db("shortn_p6_dev"),
  durable = new Redis("redis://127.0.0.1:16379/6");
const directory = "test-results/captures/p6-bulk-archive",
  captures: object[] = [],
  errors: string[] = [],
  workspaceId = new ObjectId(),
  slug = `bulk-archive-${crypto.randomUUID()}`;
await mkdir(directory, { recursive: true });
const workspace = {
    _id: workspaceId,
    name: "Synthetic archive library",
    slug,
    personal: false,
    ownerUserId: login.userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  root = `${login.origin}/${slug}/links`;
const userFilter = { _id: new ObjectId(login.userId) },
  previousUser = await db.collection(physicalNames.user).findOne(userFilter);
const browser = await chromium.launch({ headless: true });
async function capture(page: Page, name: string, width: number) {
  await page.setViewportSize({ width, height: 1000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => document.fonts.ready);
  await page.locator("#main").evaluate((main) => {
    main.scrollTop = 0;
  });
  await page.evaluate(() => scrollTo(0, 0));
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    `${name}: overflow`,
  );
  const style = await page.addStyleTag({
    content:
      "nextjs-portal{display:none!important} *,*::before,*::after{animation:none!important;transition:none!important}",
  });
  const heading = page.locator("main h1").first();
  await heading.scrollIntoViewIfNeeded();
  await page.locator("#main").evaluate((main) => {
    main.scrollTop = 0;
  });
  const box = await heading.boundingBox();
  assert(box && box.y >= 0 && box.y < 300);
  const file = `${directory}/${name}.png`;
  await page.screenshot({ path: file });
  await style.evaluate((node) => node.remove());
  captures.push({
    file,
    width,
    fullPage: false,
    heading: await heading.textContent(),
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
  const campaigns = Array.from({ length: 1001 }, (_, i) => ({
    _id: new ObjectId(),
    workspaceId,
    title: `Synthetic campaign ${String(i).padStart(4, "0")}${i === 1 ? " — Weekly editorial publishing and newsletters" : ""}`,
    links: [] as ObjectId[],
    utmDefaults: { sources: ["DO_NOT_APPLY_DEFAULT"] },
  }));
  const tags = Array.from({ length: 100 }, (_, i) => ({
    _id: new ObjectId(),
    workspaceId,
    id: crypto.randomUUID(),
    name: `Synthetic tag ${String(i).padStart(3, "0")}`,
    tagName: `Synthetic tag ${String(i).padStart(3, "0")}`,
    nameLower: `synthetic tag ${String(i).padStart(3, "0")}`,
  }));
  await db.collection(physicalNames.tags).insertMany(tags);
  const links = Array.from({ length: 5001 }, (_, i) => ({
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
    await readFile("apps/web/messages/en/bulkArchive.json", "utf8"),
  );
  await page
    .getByRole("checkbox", { name: "Select this page", exact: true })
    .check();
  await page.goto(`${root}?page=2`);
  await page.locator('input[name="ids"]').first().check();
  await page.goto(`${root}?tag=Synthetic%20tag%20000`);
  await page.getByText("26 selected", { exact: true }).waitFor();
  await capture(page, "en-selected-light-1440", 1440);
  await capture(page, "en-selected-light-390", 390);
  await page.getByRole("button", { name: en.entry, exact: true }).click();
  await page.waitForURL((url) => url.searchParams.has("selectionRef"));
  await page.getByRole("link", { name: en.cancel, exact: true }).click();
  await page.getByText("26 selected", { exact: true }).waitFor();
  const selected = links.slice(0, 51).map((link) => String(link._id));
  await page.goto(`${root}/archive?selection=${encodeSelection(selected)}`);
  await page.waitForURL((url) => url.searchParams.has("selectionRef"));
  const ref = new URL(page.url()).searchParams.get("selectionRef")!;
  assert.equal(await page.locator("ul.divide-y > li").count(), 25);
  await capture(page, "en-review-light-1440", 1440);
  await capture(page, "en-review-light-390", 390);
  await page.goto(`${root}/archive?selectionRef=${ref}&page=2`);
  assert.equal(await page.locator("ul.divide-y > li").count(), 25);
  await page.goto(`${root}/archive?selectionRef=${ref}&q=example.com%2F50`);
  await page
    .getByText("1 of 51 selected links match this view.", { exact: true })
    .waitFor();
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
      `${language}-review-${dark ? "dark" : "light"}-${width}`,
      width,
    );
  }
  await locale(page, "en");
  await page.reload();
  assert(
    await page
      .getByRole("button", { name: en.apply, exact: true })
      .isDisabled(),
  );
  await page
    .getByRole("checkbox", {
      name: "Archive all 51 selected links.",
      exact: true,
    })
    .check();
  const actionUrl = page.url();
  await page.route(actionUrl, async (route) => {
    if (route.request().method() === "POST")
      await route.fulfill({ status: 503, body: "Synthetic unavailable" });
    else await route.continue();
  });
  await page.getByRole("button", { name: en.apply, exact: true }).click();
  await page.getByText(en.errors.failed, { exact: true }).waitFor();
  await capture(page, "en-retry-light-390", 390);
  await page.unroute(actionUrl);
  let posts = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(actionUrl, async (route) => {
    if (route.request().method() === "POST") {
      posts++;
      await gate;
    }
    await route.continue();
  });
  await page.getByRole("button", { name: en.apply, exact: true }).click();
  await page
    .locator("form")
    .first()
    .evaluate((form) => (form as HTMLFormElement).requestSubmit());
  await page.waitForTimeout(200);
  assert.equal(posts, 1);
  release();
  await page
    .getByText(
      "Archived 51 of 51 selected links. Already archived links were unchanged.",
      { exact: true },
    )
    .waitFor();
  await page.unroute(actionUrl);
  await capture(page, "en-success-light-390", 390);
  assert.equal(
    await db
      .collection(physicalNames.links)
      .countDocuments({ workspaceId, archivedAt: { $exists: true } }),
    51,
  );
  assert.equal(
    (await db
      .collection(physicalNames.campaigns)
      .findOne({ _id: campaigns[0]!._id }))!.links.length,
    5001,
  );
  const first = (await db
    .collection(physicalNames.links)
    .findOne({ _id: links[0]!._id }))!;
  assert.deepEqual(first.utmLinks, links[0]!.utmLinks);
  assert.deepEqual(first.rules, links[0]!.rules);
  await page.getByRole("link", { name: en.viewArchived, exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Select this page", exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("region", { name: "Selection", exact: true }).count(),
    0,
  );
  assert.equal(await page.locator('input[name="ids"]').count(), 25);
  await capture(page, "en-library-light-1440", 1440);
  await capture(page, "en-library-light-390", 390);
  await page.goto(`${root}?archived=1&page=2`);
  assert.equal(await page.locator('input[name="ids"]').count(), 25);
  await page
    .getByRole("checkbox", { name: "Select this page", exact: true })
    .check();
  await page.goto(`${root}?archived=1&tag=Synthetic%20tag%20000&group=tag`);
  await page.getByText("25 selected", { exact: true }).waitFor();
  await page.getByRole("button", { name: en.unarchive, exact: true }).click();
  await page.waitForURL((url) => url.searchParams.has("selectionRef"));
  assert.equal(new URL(page.url()).searchParams.get("mode"), "unarchive");
  await page
    .getByRole("heading", { name: en.unarchiveTitle, exact: true })
    .waitFor();
  await capture(page, "en-unarchive-light-390", 390);
  await page
    .getByRole("checkbox", {
      name: "Unarchive all 25 selected links.",
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: en.unarchive, exact: true }).click();
  await page
    .getByText(
      "Unarchived 25 of 25 selected links. Active links were unchanged.",
      { exact: true },
    )
    .waitFor();
  assert.equal(
    await db
      .collection(physicalNames.links)
      .countDocuments({ workspaceId, archivedAt: { $exists: true } }),
    26,
  );
  await page.goto(
    `${root}/archive?selection=${encodeSelection(selected.slice(0, 2))}`,
  );
  await page.waitForURL((url) => url.searchParams.has("selectionRef"));
  await db
    .collection(physicalNames.links)
    .updateOne({ _id: links[0]!._id }, { $set: { deletedAt: new Date() } });
  await page
    .getByRole("checkbox", {
      name: "Archive all 2 selected links.",
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: en.apply, exact: true }).click();
  await page.getByText(en.errors.not_found, { exact: true }).waitFor();
  await capture(page, "en-stale-light-390", 390);
  await collection(db, "workspace_members").updateOne(
    { workspaceId, userId: login.userId },
    { $set: { role: "viewer" } },
  );
  await page.reload();
  await page.getByText(en.errors.forbidden, { exact: true }).waitFor();
  await capture(page, "en-forbidden-light-390", 390);
  await collection(db, "workspace_members").updateOne(
    { workspaceId, userId: login.userId },
    { $set: { role: "owner" } },
  );
  await page.goto(
    `${root}/archive?selection=${encodeSelection(selected.slice(1, 3))}`,
  );
  await page.waitForURL((url) => url.searchParams.has("selectionRef"));
  const expiredRef = new URL(page.url()).searchParams.get("selectionRef");
  await durable.del(
    `links:archive-selection:${workspaceId}:${login.userId}:${expiredRef}`,
  );
  await page.reload();
  await page.getByText(en.errors.not_found, { exact: true }).waitFor();
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
        campaigns: 1001,
        captures,
        checks: [
          "cross-page/filter selection and cancel",
          "51 archive despite one matching review row",
          "25-row review/pagination and archived browsing/tag/group",
          "retry/duplicate guards",
          "campaign/rules/UTM preservation",
          "query-bearing unarchive action",
          "25 unarchive and selection cleared",
          "current-role, stale selection, expiry",
          "en/pt/es themes1440/390",
          "no browser errors",
        ],
      },
      null,
      2,
    ),
  );
  console.log("Bulk archive browser checks passed.");
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
      `links:archive-selection:${workspaceId}:*`,
      "COUNT",
      1000,
    );
    cursor = next;
    if (found.length) await durable.unlink(...found);
  } while (cursor !== "0");
  durable.disconnect();
  await mongo.close();
}
