import { strict as assert } from "node:assert";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium, type Page } from "playwright-core";
import { MongoClient, ObjectId } from "mongodb";
import Redis from "ioredis";
import { collection, physicalNames, deriveLinkUtm } from "@shortn/db";
import { encodeSelection } from "../src/lib/bulk-selection";
const login = JSON.parse(await readFile("/tmp/shortn-p6-login.json", "utf8"));
assert.equal(login.origin, "http://localhost:3200");
const mongo = await new MongoClient(
    "mongodb://127.0.0.1:27020/?directConnection=true",
  ).connect(),
  db = mongo.db("shortn_p6_dev"),
  durable = new Redis("redis://127.0.0.1:16379/6");
const directory = ".impeccable/review/p6-bulk-campaign",
  captures: object[] = [],
  errors: string[] = [],
  workspaceId = new ObjectId(),
  slug = `bulk-campaign-${crypto.randomUUID()}`;
await mkdir(directory, { recursive: true });
const workspace = {
    _id: workspaceId,
    name: "Synthetic campaign library",
    slug,
    personal: false,
    ownerUserId: login.userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  root = `${login.origin}/${slug}/links`;
const userFilter = { _id: new ObjectId(login.userId) },
  previousUser = await db.collection(physicalNames.user).findOne(userFilter);
const recaptureOnly = process.argv.includes("--recapture-evidence");
const recaptureNames = new Set([
  "en-forbidden-light-390",
  "en-empty-picker-light-390",
]);
const browser = await chromium.launch({ headless: true });
async function capture(
  page: Page,
  name: string,
  width: number,
  viewport = false,
) {
  if (recaptureOnly && !recaptureNames.has(name)) return;
  if (recaptureNames.has(name)) await page.waitForTimeout(500);
  await page.setViewportSize({ width, height: 1000 });
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
    content: `nextjs-portal{display:none!important} *,*::before,*::after{animation:none!important;transition:none!important}${viewport ? "" : "body > div:has(> div > main#main){height:auto!important;min-height:100dvh;overflow:visible!important} main#main{overflow:visible!important}"}`,
  });
  await page.locator("main h1").first().scrollIntoViewIfNeeded();
  await page.locator("#main").evaluate(async (main) => {
    main.scrollTop = 0;
    await new Promise(requestAnimationFrame);
    main.scrollTop = 0;
    await new Promise(requestAnimationFrame);
  });
  if (recaptureNames.has(name)) await page.waitForTimeout(200);
  const headingBox = await page.locator("main h1").first().boundingBox();
  assert(
    headingBox && headingBox.y >= 0 && headingBox.y < 300,
    `${name}: heading scrolled out`,
  );
  const file = `${directory}/${name}.png`;
  await page.screenshot({ path: file, fullPage: !viewport });
  await style.evaluate((node) => node.remove());
  captures.push({
    file,
    width,
    fullPage: !viewport,
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
try {
  await collection(db, "workspaces").insertOne(workspace);
  await collection(db, "workspace_members").insertOne({
    _id: new ObjectId(),
    workspaceId,
    userId: login.userId,
    role: "owner",
    createdAt: new Date(),
  });
  const subscription = {
    _id: new ObjectId(),
    workspaceId,
    polarSubscriptionId: crypto.randomUUID(),
    status: "active",
    plan: "pro",
    currentPeriodStart: new Date(Date.now() - 86400000),
    currentPeriodEnd: new Date(Date.now() + 29 * 86400000),
    cancelAtPeriodEnd: false,
  };
  await db.collection(physicalNames.subscriptions).insertOne(subscription);
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
  await page
    .getByRole("checkbox", { name: "Select this page", exact: true })
    .check();
  await page.goto(`${root}?page=2`);
  await page.locator('input[name="ids"]').first().check();
  await page.goto(`${root}?tag=Synthetic%20tag%20000`);
  await page.getByText("26 selected", { exact: true }).waitFor();
  await capture(page, "en-selected-light-1440", 1440, true);
  await capture(page, "en-selected-light-390", 390, true);
  await page
    .getByRole("button", { name: "Move to campaign", exact: true })
    .click();
  await page.waitForURL((url) => url.searchParams.has("selectionRef"));
  await page
    .getByText("26 links selected across pages and filters.", { exact: true })
    .waitFor();
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await page.getByText("26 selected", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Move to campaign", exact: true })
    .click();
  await page.waitForURL((url) => url.searchParams.has("selectionRef"));
  await page.locator("#campaign-target").click();
  await page
    .getByText("25 of 1001 matches · Page 1", { exact: true })
    .waitFor();
  assert.equal(
    await page
      .locator('[data-radix-popper-content-wrapper] [role="option"]')
      .count(),
    25,
  );
  const firstOption = await page
    .locator('[data-radix-popper-content-wrapper] [role="option"]')
    .first()
    .textContent();
  await page
    .getByRole("button", { name: "Next campaigns", exact: true })
    .click();
  await page
    .getByText("25 of 1001 matches · Page 2", { exact: true })
    .waitFor();
  assert.notEqual(
    await page
      .locator('[data-radix-popper-content-wrapper] [role="option"]')
      .first()
      .textContent(),
    firstOption,
  );
  await capture(page, "en-picker-page2-light-390", 390, true);
  await page
    .getByRole("button", { name: "Previous campaigns", exact: true })
    .click();
  await page
    .getByText("25 of 1001 matches · Page 1", { exact: true })
    .waitFor();
  await page
    .getByPlaceholder("Search all workspace campaigns…")
    .fill("Synthetic campaign 0001");
  await page.getByText("1 of 1 matches · Page 1", { exact: true }).waitFor();
  await page
    .locator('[data-radix-popper-content-wrapper] [role="option"]')
    .first()
    .click();
  await page
    .locator("[data-radix-popper-content-wrapper]")
    .waitFor({ state: "detached" });
  await page.locator("#campaign-target").click();
  await page
    .getByText("25 of 1001 matches · Page 1", { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Next campaigns", exact: true })
    .click();
  await page
    .getByText("25 of 1001 matches · Page 2", { exact: true })
    .waitFor();
  await page.keyboard.press("Escape");
  await page
    .locator("[data-radix-popper-content-wrapper]")
    .waitFor({ state: "detached" });
  await page
    .getByText(`Chosen campaign: ${campaigns[1]!.title}`, { exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Move selected links", exact: true })
      .isDisabled(),
    true,
  );
  await page
    .getByRole("checkbox", {
      name: "Replace previous campaign associations for all 26 selected links.",
      exact: true,
    })
    .check();
  await capture(page, "en-choice-light-1440", 1440, true);
  await capture(page, "en-choice-light-390", 390, true);
  const actionUrl = page.url();
  await page.route(actionUrl, async (route) => {
    if (route.request().method() === "POST")
      await route.fulfill({ status: 503, body: "Synthetic unavailable" });
    else await route.continue();
  });
  await page
    .getByRole("button", { name: "Move selected links", exact: true })
    .click();
  await page
    .getByText(
      "The campaign move could not finish. Your selection is kept. Try again.",
      { exact: true },
    )
    .waitFor();
  await capture(page, "en-retry-light-390", 390, true);
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
  await page
    .getByRole("button", { name: "Move selected links", exact: true })
    .click();
  await page
    .locator("form")
    .first()
    .evaluate((form) => (form as HTMLFormElement).requestSubmit());
  await page.waitForTimeout(200);
  assert.equal(posts, 1);
  release();
  await page
    .getByText(
      "Moved 26 of 26 selected links. Links already assigned to this campaign needed no update.",
      { exact: true },
    )
    .waitFor();
  await page.unroute(actionUrl);
  await capture(page, "en-success-light-1440", 1440, true);
  await capture(page, "en-success-light-390", 390, true);
  assert.equal(
    await db
      .collection(physicalNames.links)
      .countDocuments({
        workspaceId,
        "utmLinks.campaign._id": campaigns[1]!._id,
      }),
    26,
  );
  await page.getByRole("link", { name: "Back to links", exact: true }).click();
  await page.getByText("0 selected", { exact: true }).waitFor();
  const selected = links.slice(0, 51).map((link) => String(link._id));
  await page.goto(`${root}/campaign?selection=${encodeSelection(selected)}`);
  await page.waitForURL((url) => url.searchParams.has("selectionRef"));
  const ref = new URL(page.url()).searchParams.get("selectionRef")!;
  assert.equal(await page.locator("ul.divide-y > li").count(), 25);
  await capture(page, "en-review-light-1440", 1440);
  await capture(page, "en-review-light-390", 390);
  await page.goto(`${root}/campaign?selectionRef=${ref}&page=2`);
  assert.equal(await page.locator("ul.divide-y > li").count(), 25);
  await page.goto(
    `${root}/campaign?selectionRef=${ref}&tag=Synthetic%20tag%20000`,
  );
  await page
    .getByText("26 of 51 selected links match this view.", { exact: true })
    .waitFor();
  await page.goto(`${root}/campaign?selectionRef=${ref}&q=example.com%2F50`);
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
  async function choose(name: string) {
    await page.locator("#campaign-target").click();
    await page.getByPlaceholder("Search all workspace campaigns…").fill(name);
    await page.getByText("1 of 1 matches · Page 1", { exact: true }).waitFor();
    await page
      .locator('[data-radix-popper-content-wrapper] [role="option"]')
      .first()
      .click();
    await page
      .locator("[data-radix-popper-content-wrapper]")
      .waitFor({ state: "detached" });
  }
  await choose(campaigns[2]!.title);
  await page
    .getByRole("checkbox", {
      name: "Replace previous campaign associations for all 51 selected links.",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Move selected links", exact: true })
    .click();
  await page
    .getByText(
      "Moved 51 of 51 selected links. Links already assigned to this campaign needed no update.",
      { exact: true },
    )
    .waitFor();
  const moved = await db
    .collection(physicalNames.links)
    .find({ _id: { $in: links.slice(0, 51).map((link) => link._id) } })
    .toArray();
  assert(
    moved.every(
      (link) =>
        link.domain === "shortn.invalid" &&
        link.utmLinks.length === 2 &&
        link.utmLinks[0].source === "Newsletter" &&
        link.utmLinks[1].term === "Keep" &&
        link.utmLinks.every(
          (variant: { campaign: { _id: ObjectId } }) =>
            String(variant.campaign._id) === String(campaigns[2]!._id),
        ) &&
        link._sync.utmHash === deriveLinkUtm(link).hash,
    ),
  );
  assert.equal(
    (await db
      .collection(physicalNames.campaigns)
      .findOne({ _id: campaigns[2]!._id }))!.links.length,
    51,
  );
  assert.equal(
    (await db
      .collection(physicalNames.campaigns)
      .findOne({ _id: campaigns[1]!._id }))!.links.length,
    0,
  );
  await page.goto(
    `${root}/campaign?selection=${encodeSelection(selected.slice(0, 2))}`,
  );
  await page.waitForURL((url) => url.searchParams.has("selectionRef"));
  await choose(campaigns[3]!.title);
  await db
    .collection(physicalNames.campaigns)
    .deleteOne({ _id: campaigns[3]!._id });
  await page
    .getByRole("checkbox", {
      name: "Replace previous campaign associations for all 2 selected links.",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Move selected links", exact: true })
    .click();
  await page
    .getByText(
      "The selection or campaign has expired or is no longer available. Nothing changed. Return to Links and select again.",
      { exact: true },
    )
    .waitFor();
  await capture(page, "en-stale-campaign-light-390", 390, true);
  await collection(db, "workspace_members").updateOne(
    { workspaceId, userId: login.userId },
    { $set: { role: "viewer" } },
  );
  await page.reload();
  await page
    .getByText(
      "You do not have permission to move these links. Ask a workspace admin.",
      { exact: true },
    )
    .waitFor();
  await capture(page, "en-forbidden-light-390", 390, true);
  await collection(db, "workspace_members").updateOne(
    { workspaceId, userId: login.userId },
    { $set: { role: "owner" } },
  );
  await db
    .collection(physicalNames.subscriptions)
    .updateOne({ _id: subscription._id }, { $set: { status: "canceled" } });
  await page.reload();
  await page
    .getByText(
      "Your current plan does not include campaigns. Review your plan or ask a workspace admin.",
      { exact: true },
    )
    .waitFor();
  await capture(page, "en-plan-light-1440", 1440, true);
  await db
    .collection(physicalNames.subscriptions)
    .updateOne({ _id: subscription._id }, { $set: { status: "active" } });
  await page.goto(
    `${root}/campaign?selection=${encodeSelection(selected.slice(0, 2))}`,
  );
  await page.waitForURL((url) => url.searchParams.has("selectionRef"));
  const expiredUrl = page.url(),
    expiredRef = new URL(expiredUrl).searchParams.get("selectionRef");
  await durable.del(
    `links:campaign-selection:${workspaceId}:${login.userId}:${expiredRef}`,
  );
  await page.reload();
  await page
    .getByText(
      "The selection or campaign has expired or is no longer available. Nothing changed. Return to Links and select again.",
      { exact: true },
    )
    .waitFor();
  await capture(page, "en-expired-light-390", 390, true);
  await page.goto(
    `${root}/campaign?selection=${encodeSelection(selected.slice(0, 2))}`,
  );
  await page.waitForURL((url) => url.searchParams.has("selectionRef"));
  await page.locator("#campaign-target").click();
  await page
    .getByPlaceholder("Search all workspace campaigns…")
    .fill("no-matching-campaign");
  await page
    .getByText(
      "No matching campaigns. Create a campaign or change your search.",
      { exact: true },
    )
    .waitFor();
  await capture(page, "en-empty-picker-light-390", 390, true);
  assert.deepEqual(errors, []);
  if (recaptureOnly) {
    const prior = JSON.parse(
      await readFile(`${directory}/browser-evidence.json`, "utf8"),
    );
    for (const entry of prior.captures)
      if (
        !captures.some(
          (current) => (current as { file: string }).file === entry.file,
        )
      )
        captures.push(entry);
  }
  await writeFile(
    `${directory}/browser-evidence.json`,
    JSON.stringify(
      {
        synthetic: true,
        links: 5001,
        tags: 100,
        campaigns: 1001,
        captures,
        checks: [
          "cross-page/filter selection and cancel",
          "25-row campaign picker next/previous/search beyond initial page",
          "target retained across picker pages",
          "confirmation, retry and duplicate guards",
          "26 then51 full-selection moves despite one-row filtered review",
          "UTM variants and canonical hash/backlinks preserved",
          "old empty campaigns retained",
          "success clears selection",
          "25-row selected review/tag/group/page",
          "stale target, current role/plan, expiry, empty search",
          "en/pt/es light/dark1440/390",
          "no browser errors",
        ],
      },
      null,
      2,
    ),
  );
  console.log("Bulk campaign browser checks passed.");
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
      `links:campaign-selection:${workspaceId}:*`,
      "COUNT",
      1000,
    );
    cursor = next;
    if (found.length) await durable.unlink(...found);
  } while (cursor !== "0");
  durable.disconnect();
  await mongo.close();
}
