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
const directory = "test-results/captures/p6-link-advanced",
  captures: object[] = [],
  errors: string[] = [],
  workspaceId = new ObjectId(),
  slug = `advanced-editor-${crypto.randomUUID()}`;
await mkdir(directory, { recursive: true });
const workspace = {
    _id: workspaceId,
    name: "Synthetic advanced editor",
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
async function capture(
  page: Page,
  name: string,
  width: number,
  section: string,
  anchor?: string,
) {
  await page.setViewportSize({ width, height: 1000 });
  await page.evaluate(() => document.fonts.ready);
  const target = anchor
    ? page.getByText(anchor, { exact: true })
    : page.getByRole("heading", { name: section, exact: true });
  await target.scrollIntoViewIfNeeded();
  await target.evaluate((node) => {
    const main = document.getElementById("main");
    if (main) main.scrollTop += node.getBoundingClientRect().top - 68;
  });
  await page.waitForTimeout(300);
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
  const box = await target.boundingBox();
  assert(box && box.y >= 0 && box.y < 650);
  const file = `${directory}/${name}.png`;
  await page.screenshot({ path: file });
  await style.evaluate((node) => node.remove());
  captures.push({
    file,
    width,
    fullPage: false,
    scrollAnchor: anchor ?? section,
    headingY: box.y,
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
  const links = Array.from({ length: 3 }, (_, i) => ({
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
      await readFile("apps/web/messages/en/linkAdvanced.json", "utf8"),
    ),
    formText = JSON.parse(
      await readFile("apps/web/messages/en/linkPages.json", "utf8"),
    ).form;
  const link = links[0]!,
    edit = `${root}/${link._id}/edit`;
  await page.goto(edit);
  await page.getByRole("heading", { name: en.title, exact: true }).waitFor();
  await capture(page, "en-collapsed-light-1440", 1440, en.title);
  await capture(page, "en-collapsed-light-390", 390, en.title);
  await page.locator("details").evaluateAll((nodes) =>
    nodes.forEach((node) => {
      (node as HTMLDetailsElement).open = true;
    }),
  );
  const fill = async (name: string, value: string) => {
    await page.locator(`[name="${name}"]`).fill(value);
  };
  await fill("rule.activeFrom", "2026-10-01T12:30");
  await fill("rule.expiresAt", "2027-10-01T12:30");
  await fill("rule.maxClicks", "1000");
  await fill("rule.expiredUrl", "https://example.com/expired");
  const geo = page
    .locator("details")
    .filter({ has: page.locator('[name="rule.geo.count"]') });
  await geo.getByRole("button", { name: en.add, exact: true }).click();
  await fill("rule.geo.0.country", "DK");
  await fill("rule.geo.0.url", "https://example.com/dk");
  const device = page
    .locator("details")
    .filter({ has: page.locator('[name="rule.device.count"]') });
  await device.getByRole("button", { name: en.add, exact: true }).click();
  await page.locator('[name="rule.device.0.os"]').selectOption("ios");
  await fill("rule.device.0.url", "https://example.com/ios");
  const rotation = page
    .locator("details")
    .filter({ has: page.locator('[name="rule.rotation.count"]') });
  for (let i = 0; i < 2; i++) {
    await rotation.getByRole("button", { name: en.add, exact: true }).click();
    await fill(`rule.rotation.${i}.url`, `https://example.com/branch-${i}`);
    await fill(`rule.rotation.${i}.weight`, i === 0 ? "3" : "1");
  }
  await fill("rule.deepLink.ios", "youtube://watch?v=1");
  await page.locator('[name="rule.deepLink.fallback"]').selectOption("store");
  await fill("rule.deepLink.store.ios", "https://apps.apple.com/app/id123");
  await page.locator('[name="rule.forwardQuery"]').check();
  await fill("rule.utm.source", "Preserved Newsletter");
  await fill("og.title", "Synthetic social title");
  await fill("og.description", "Synthetic social description");
  await fill("og.image", "https://example.com/social.png");
  await capture(page, "en-open-light-1440", 1440, en.title);
  await capture(page, "en-open-light-390", 390, en.title);
  for (let index = 1; index < 10; index++)
    await geo.getByRole("button", { name: en.add, exact: true }).click();
  assert(
    await geo.getByRole("button", { name: en.add, exact: true }).isDisabled(),
  );
  while ((await geo.getByRole("button", { name: /^Remove rule / }).count()) > 1)
    await geo
      .getByRole("button", { name: /^Remove rule / })
      .last()
      .click();
  await capture(page, "en-device-light-390", 390, en.title, en.device);
  await capture(page, "en-rotation-light-390", 390, en.title, en.rotation);
  await capture(page, "en-app-light-390", 390, en.title, en.deepLink);
  await capture(page, "en-social-light-390", 390, en.title, en.social);
  // An incomplete row must refuse before writing basics, tags, rules or preview.
  await geo.getByRole("button", { name: en.add, exact: true }).click();
  await page.getByRole("button", { name: formText.save, exact: true }).click();
  await page.getByText(en.invalid, { exact: true }).waitFor();
  assert.equal(
    (await db.collection(physicalNames.links).findOne({ _id: link._id }))!._sync
      .rev,
    1,
  );
  await capture(page, "en-invalid-light-390", 390, en.title);
  await geo.getByRole("button", { name: "Remove rule 2", exact: true }).click();
  await page.getByRole("button", { name: formText.save, exact: true }).click();
  await page.waitForURL((url) => url.searchParams.get("saved") === "1");
  let saved = (await db
    .collection(physicalNames.links)
    .findOne({ _id: link._id }))!;
  assert.equal(saved.domain, "shortn.invalid");
  assert.equal(
    saved.rules.activeFrom.toISOString(),
    "2026-10-01T12:30:00.000Z",
  );
  assert.equal(saved.rules.geo[0].country, "DK");
  assert.equal(saved.rules.rotation.length, 2);
  assert.equal(
    saved.rules.deepLink.store.ios,
    "https://apps.apple.com/app/id123",
  );
  assert.equal(saved.og.title, "Synthetic social title");
  assert.deepEqual(saved.utmLinks, link.utmLinks);
  await page.goto(edit);
  await capture(page, "en-saved-light-390", 390, en.title);
  for (const [language, dark] of [
    ["pt", true],
    ["es", false],
    ["en", true],
  ] as const) {
    await locale(page, language, dark);
    await page.reload();
    const labels = JSON.parse(
      await readFile(`apps/web/messages/${language}/linkAdvanced.json`, "utf8"),
    );
    await capture(
      page,
      `${language}-saved-${dark ? "dark" : "light"}-390`,
      390,
      labels.title,
    );
  }
  await locale(page, "en");
  await page.reload();
  await page.locator("details").evaluateAll((nodes) =>
    nodes.forEach((node) => {
      (node as HTMLDetailsElement).open = true;
    }),
  );
  for (const kind of ["geo", "device", "rotation"]) {
    const section = page
      .locator("details")
      .filter({ has: page.locator(`[name="rule.${kind}.count"]`) });
    while (await section.getByRole("button", { name: /^Remove rule / }).count())
      await section
        .getByRole("button", { name: /^Remove rule / })
        .first()
        .click();
  }
  for (const name of [
    "activeFrom",
    "expiresAt",
    "maxClicks",
    "expiredUrl",
    "deepLink.ios",
    "deepLink.store.ios",
    "utm.source",
  ])
    await fill(`rule.${name}`, "");
  await page.locator('[name="rule.deepLink.fallback"]').selectOption("web");
  await page.locator('[name="rule.forwardQuery"]').uncheck();
  for (const name of ["title", "description", "image"])
    await fill(`og.${name}`, "");
  await page.getByRole("button", { name: formText.save, exact: true }).click();
  await page.waitForURL((url) => url.searchParams.get("saved") === "1");
  saved = (await db
    .collection(physicalNames.links)
    .findOne({ _id: link._id }))!;
  assert.equal(saved.rules, undefined);
  assert.equal(saved.og, undefined);
  assert.deepEqual(saved.utmLinks, link.utmLinks);
  await page.goto(`${root}/new`);
  await fill("url", "https://example.com/created-advanced");
  await page.locator("details").evaluateAll((nodes) =>
    nodes.forEach((node) => {
      (node as HTMLDetailsElement).open = true;
    }),
  );
  await fill("rule.maxClicks", "5");
  await fill("og.title", "Synthetic created preview");
  await page
    .getByRole("button", { name: formText.create, exact: true })
    .click();
  await page.waitForURL((url) => url.searchParams.get("created") === "1");
  const createdId = new ObjectId(
    new URL(page.url()).pathname.split("/").pop()!,
  );
  const created = (await db
    .collection(physicalNames.links)
    .findOne({ _id: createdId }))!;
  assert.equal(created.rules.maxClicks, 5);
  assert.equal(created.og.title, "Synthetic created preview");
  assert.deepEqual(errors, []);
  await writeFile(
    `${directory}/browser-evidence.json`,
    JSON.stringify(
      {
        synthetic: true,
        captures,
        checks: [
          "collapsed summaries",
          "all rule families saved through native server action",
          "incomplete targeting refuses all writes and retains form",
          "UTC schedule and workspace domain preserved",
          "UTM variants unchanged",
          "reload hydration",
          "en/pt/es themes390/1440",
          "clear rules and social preview",
          "10-row bound and stable deletion",
          "creation with rules and preview",
          "no browser errors",
        ],
      },
      null,
      2,
    ),
  );
  console.log("Advanced link editor browser checks passed.");
} finally {
  await db.collection("link_metadata_jobs").deleteMany({ workspaceId });
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
