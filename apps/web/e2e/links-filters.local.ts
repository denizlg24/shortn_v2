/**
 * Loopback P6 sandbox check for the Links toolbar, selection bar and tag
 * library against a realistically large synthetic library (5,001 links,
 * 1,200 tags, 40 campaigns, a custom domain).
 *
 *   bun --no-env-file e2e/links-filters.local.ts --seed     create the fixture, then check
 *   bun --no-env-file e2e/links-filters.local.ts            check an existing fixture
 *   bun --no-env-file e2e/links-filters.local.ts --cleanup  remove the fixture
 *
 * Screenshots go to CAPTURE_DIR (default: a temporary directory).
 */
import { strict as assert } from "node:assert";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright-core";
import { MongoClient, ObjectId } from "mongodb";
import { collection, physicalNames } from "@shortn/db";
import { tagColors } from "@shortn/core/tag-options";

const login = JSON.parse(await readFile("/tmp/shortn-p6-login.json", "utf8"));
assert.equal(login.origin, "http://localhost:3200");
const mongo = await new MongoClient(
    "mongodb://127.0.0.1:27020/?directConnection=true",
  ).connect(),
  db = mongo.db("shortn_p6_dev");
const directory =
  process.env.CAPTURE_DIR ?? join(tmpdir(), "shortn-links-filters");
const fixturePath = join(tmpdir(), "shortn-links-filters-fixture.json");
const domain = "go.acme-news.example";

async function seed() {
  const workspaceId = new ObjectId(),
    slug = `filters-${crypto.randomUUID().slice(0, 8)}`,
    now = Date.now();
  await collection(db, "workspaces").insertOne({
    _id: workspaceId,
    name: "Acme News — synthetic library",
    slug,
    personal: false,
    ownerUserId: login.userId,
    plan: "pro",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await collection(db, "workspace_members").insertOne({
    _id: new ObjectId(),
    workspaceId,
    userId: login.userId,
    role: "owner",
    createdAt: new Date(),
  });
  await db.collection(physicalNames.subscriptions).insertOne({
    workspaceId,
    polarSubscriptionId: `filters-${crypto.randomUUID()}`,
    polarCustomerId: "synthetic",
    productId: "synthetic",
    status: "active",
    plan: "pro",
    currentPeriodStart: new Date(now - 86_400_000),
    currentPeriodEnd: new Date(now + 29 * 86_400_000),
    cancelAtPeriodEnd: false,
  });
  await db.collection(physicalNames.domains).insertOne({
    workspaceId,
    hostname: domain,
    kind: "links",
    status: "active",
    verification: { type: "cname" },
    createdAt: new Date(),
  });
  const common = [
    "Print",
    "Promo",
    "Newsletter",
    "Social",
    "Spring launch",
    "Partners",
    "Podcast",
    "Events",
    "Retail",
    "Paid search",
    "Organic",
    "Breaking news",
  ];
  const names = [
    ...common,
    ...Array.from({ length: 1200 - common.length }, (_, i) =>
      i % 9 === 0
        ? `Weekly publication — São João edition ${i} — regional supplement`
        : i % 3 === 0
          ? `Region ${["Lisboa", "Porto", "Madrid", "Sevilla"][i % 4]} ${i}`
          : `Campaign ${2024 + (i % 3)} Q${(i % 4) + 1} · ${i}`,
    ),
  ];
  const tags = names.map((name, i) => ({
    _id: new ObjectId(),
    workspaceId,
    id: crypto.randomUUID().slice(0, 6),
    name,
    tagName: name,
    nameLower: name.toLowerCase(),
    ...(i % 5 === 4 ? {} : { color: tagColors[i % tagColors.length] }),
    createdAt: new Date(now - i * 3_600_000),
    createdBy: login.userId,
  }));
  await db.collection(physicalNames.tags).insertMany(tags);
  const links = Array.from({ length: 5001 }, (_, i) => {
    const picked =
      i % 7 === 0
        ? []
        : [
            tags[i % common.length]!,
            ...(i % 3 === 0 ? [tags[(i * 7) % 40]!] : []),
            ...(i % 11 === 0 ? [tags[common.length + (i % 1100)]!] : []),
          ].filter(
            (tag, index, all) =>
              all.findIndex((other) => other._id.equals(tag._id)) === index,
          );
    return {
      _id: new ObjectId(),
      workspaceId,
      urlCode: `news-${i.toString(36)}`,
      key: `news-${i.toString(36)}`,
      ...(i % 9 === 0 ? { domain } : {}),
      longUrl: `https://news.example.com/${2026 - (i % 3)}/story-${i}?utm_source=shortn`,
      title:
        i % 13 === 0
          ? `Synthetic story ${i} — ${"Weekly publication ".repeat(6)}`
          : `Synthetic story ${i}`,
      tags: picked.map((tag) => ({
        _id: tag._id,
        id: tag.id,
        tagName: tag.name,
      })),
      tagIds: picked.map((tag) => tag._id),
      ...(i % 50 === 0 ? { disabled: true } : {}),
      ...(i % 37 === 0 ? { passwordProtected: true } : {}),
      clicks: { total: (i * 7919) % 4000 },
      date: new Date(now - i * 7_000_000),
      createdAt: new Date(now - i * 7_000_000),
      createdBy: login.userId,
    };
  });
  await db.collection(physicalNames.links).insertMany(links);
  await db.collection(physicalNames.campaigns).insertMany(
    Array.from({ length: 40 }, (_, i) => ({
      _id: new ObjectId(),
      workspaceId,
      title:
        i === 0
          ? "Spring launch 2026"
          : `Campaign ${i} — ${["Newsletter", "Retail", "Podcast"][i % 3]}`,
      links: links.slice(i * 60, i * 60 + 40 + i).map((link) => link._id),
      createdAt: new Date(now - i * 86_400_000),
      createdBy: login.userId,
    })),
  );
  const fixture = { workspaceId: String(workspaceId), slug };
  await writeFile(fixturePath, JSON.stringify(fixture));
  return fixture;
}

async function cleanup(workspaceId: ObjectId) {
  for (const name of [
    physicalNames.links,
    physicalNames.tags,
    physicalNames.campaigns,
    physicalNames.domains,
    physicalNames.subscriptions,
    physicalNames.workspace_members,
  ])
    await db.collection(name).deleteMany({ workspaceId });
  await collection(db, "workspaces").deleteOne({ _id: workspaceId });
  await rm(fixturePath, { force: true });
}

if (process.argv.includes("--cleanup")) {
  const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
  await cleanup(new ObjectId(fixture.workspaceId));
  await mongo.close();
  console.log("Links filter fixture removed.");
  process.exit(0);
}

const fixture: { workspaceId: string; slug: string } = process.argv.includes(
  "--seed",
)
  ? await seed()
  : JSON.parse(await readFile(fixturePath, "utf8"));
const root = `${login.origin}/${fixture.slug}`;
await mkdir(directory, { recursive: true });
const errors: string[] = [];
const browser = await chromium.launch({ headless: true });

async function capture(page: Page, name: string, width: number) {
  await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
  await page.evaluate(() => document.fonts.ready);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    `${name}: horizontal overflow`,
  );
  const style = await page.addStyleTag({
    content: "nextjs-portal{display:none!important}",
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${directory}/${name}.png` });
  await style.evaluate((node) => node.remove());
}

async function theme(page: Page, dark: boolean) {
  await page.evaluate(
    (dark) => localStorage.setItem("theme", dark ? "dark" : "light"),
    dark,
  );
  await page.reload();
  await page.locator("main h1").first().waitFor();
}

const settled = (page: Page) =>
  page.waitForFunction(
    () => !document.querySelector('[role="search"][aria-busy="true"]'),
  );

try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
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
  await page.goto(`${root}/links`);
  const later = page.getByRole("button", { name: "Later", exact: true });
  await later
    .waitFor({ state: "visible", timeout: 6000 })
    .then(() => later.click())
    .catch(() => undefined);

  for (const dark of [false, true]) {
    const mode = dark ? "dark" : "light";
    await page.goto(`${root}/links`);
    await theme(page, dark);
    await page.getByText("5,001 links").filter({ visible: true }).waitFor();
    for (const width of [1440, 390])
      await capture(page, `links-default-${mode}-${width}`, width);

    await page.setViewportSize({ width: 1440, height: 900 });
    const search = page.getByRole("searchbox", { name: "Search", exact: true });
    await search.fill("story 12");
    await page.waitForURL((url) => url.searchParams.get("q") === "story 12");
    await settled(page);
    await search.fill("");
    await search.press("Enter");
    await page.waitForURL((url) => !url.searchParams.has("q"));

    await page.getByRole("button", { name: "Filter", exact: true }).click();
    await page.getByRole("option", { name: "Tag", exact: true }).click();
    const tagSearch = page.getByRole("combobox", { name: "Search tags…" });
    // Far beyond the first server page of tags.
    await tagSearch.fill("Q1 · 1000");
    await page
      .getByRole("option", { name: /^Campaign 2025 Q1 · 1000/ })
      .waitFor();
    await tagSearch.fill("");
    await page.getByRole("option", { name: /^Print\b/ }).click();
    await page.waitForURL((url) => url.searchParams.get("tag") === "Print");
    await page.getByRole("option", { name: /^Promo\b/ }).click();
    await page.waitForURL(
      (url) => url.searchParams.getAll("tag").join() === "Print,Promo",
    );
    await settled(page);
    for (const width of [1440, 390])
      await capture(page, `filter-tags-open-${mode}-${width}`, width);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: /^Filter, 1 active$/ }).click();
    await page.getByRole("option", { name: "Status", exact: true }).click();
    await page.getByRole("option", { name: "Disabled", exact: true }).click();
    await page.waitForURL(
      (url) => url.searchParams.get("status") === "disabled",
    );
    await page.getByRole("button", { name: /^Filter, 2 active$/ }).click();
    await page.getByRole("option", { name: "Created", exact: true }).click();
    await page.getByRole("option", { name: "Last year", exact: true }).click();
    await page.waitForURL((url) => url.searchParams.get("created") === "365");
    await page.getByRole("button", { name: /^Filter, 3 active$/ }).click();
    await page.getByRole("option", { name: "Domain", exact: true }).click();
    await page.getByRole("option", { name: new RegExp(domain) }).click();
    await page.waitForURL((url) => url.searchParams.get("domain") === domain);
    await settled(page);
    await page.locator("main h1").first().click();
    for (const width of [1440, 390])
      await capture(page, `links-filtered-${mode}-${width}`, width);
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.getByRole("button", { name: /^Remove filter: Domain/ }).click();
    await page.waitForURL((url) => !url.searchParams.has("domain"));
    await page.getByRole("link", { name: "Clear all", exact: true }).click();
    await page.waitForURL((url) => !url.search);
    await settled(page);

    await page.goto(`${root}/links?campaign=${await campaignId()}`);
    await page
      .getByRole("button", {
        name: /^Change filter: Campaign is Spring launch 2026/,
      })
      .waitFor();

    await page.goto(`${root}/links`);
    const rows = page.locator('input[name="ids"]');
    await rows.nth(0).check();
    await rows.nth(1).check();
    await rows.nth(2).check();
    await page
      .getByRole("status")
      .filter({ hasText: /^3 selected$/ })
      .waitFor();
    await page
      .getByRole("region", { name: "Selection" })
      .getByText("Up to 500 per action")
      .waitFor();
    await page.locator("#main").evaluate((main) => {
      main.scrollTop = 300;
    });
    for (const width of [1440, 390])
      await capture(page, `selection-bar-${mode}-${width}`, width);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page
      .getByRole("button", { name: "Clear selection", exact: true })
      .click();
    assert.equal(
      await page.getByRole("region", { name: "Selection" }).count(),
      0,
    );

    await page.goto(`${root}/tags`);
    await page.getByText("1,200 tags").filter({ visible: true }).waitFor();
    for (const width of [1440, 390])
      await capture(page, `tag-library-${mode}-${width}`, width);
    await page.setViewportSize({ width: 1440, height: 900 });
  }

  await page.goto(`${root}/tags?q=Promo`);
  await page.getByRole("link", { name: "View links tagged Promo" }).click();
  await page.waitForURL(
    (url) =>
      url.pathname.endsWith("/links") &&
      url.searchParams.get("tag") === "Promo",
  );
  assert.deepEqual(errors, []);
  console.log(
    `Links filters passed on 5,001 links / 1,200 tags; captures in ${directory}`,
  );
  await context.close();
} finally {
  await browser.close();
  await mongo.close();
}

async function campaignId() {
  const campaign = await db.collection(physicalNames.campaigns).findOne({
    workspaceId: new ObjectId(fixture.workspaceId),
    title: "Spring launch 2026",
  });
  assert(campaign);
  return String(campaign._id);
}
