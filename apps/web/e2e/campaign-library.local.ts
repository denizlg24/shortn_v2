import { readFile, mkdir } from "node:fs/promises";
import { strict as assert } from "node:assert";
import { chromium } from "playwright-core";
import { MongoClient, ObjectId } from "mongodb";
import { Redis } from "ioredis";
import { physicalNames } from "@shortn/db";
import { createCampaign, type ServiceContext } from "@shortn/core";
const credentials = JSON.parse(
  await readFile("/tmp/shortn-p5-login.json", "utf8"),
);
assert.equal(new URL(credentials.editor).origin, "http://localhost:3100");
const client = await new MongoClient(
  "mongodb://127.0.0.1:27020/?replicaSet=rs0",
).connect();
const db = client.db("shortn_p5_dev"),
  cache = new Redis("redis://127.0.0.1:16380/5");
const workspace = (await db
  .collection(physicalNames.workspaces)
  .findOne({ slug: new URL(credentials.editor).pathname.split("/")[1] }))!;
const user = (await db
  .collection(physicalNames.user)
  .findOne({ email: credentials.email }))!;
const ctx = {
  db,
  cache,
  workspace,
  actor: { userId: String(user._id), role: "owner" },
  linkDomain: "localhost:3102",
} as unknown as ServiceContext;
const suffix = new ObjectId().toHexString().slice(-8),
  title = `Campaign library ${suffix}`;
const campaign = await createCampaign(ctx, { title });
assert(campaign.ok);
const campaignId = new ObjectId(campaign.value.id),
  tagIds = [new ObjectId(), new ObjectId()];
const tagNames = [`Campaign Alpha ${suffix}`, `Campaign Beta ${suffix}`];
const docs = Array.from({ length: 1005 }, (_, at) => {
  const group = at < 1001 ? 0 : 1,
    key = `campaign-browser-${suffix}-${at}`;
  return {
    _id: new ObjectId(),
    workspaceId: workspace._id,
    key,
    urlCode: key,
    title: `Campaign sample ${String(at).padStart(4, "0")}`,
    domain: "localhost:3102",
    longUrl: `https://example.com/${key}`,
    date: new Date(),
    hidden: true,
    tags: [
      { _id: tagIds[group], tagName: tagNames[group], name: tagNames[group] },
    ],
  };
});
const foreign = {
  ...docs[0]!,
  _id: new ObjectId(),
  workspaceId: new ObjectId(),
  key: `campaign-foreign-${suffix}`,
  urlCode: `campaign-foreign-${suffix}`,
  title: "Foreign campaign secret",
};
const browser = await chromium.launch({ headless: true });
try {
  await db.collection(physicalNames.tags).insertMany(
    tagNames.map((name, at) => ({
      _id: tagIds[at],
      workspaceId: workspace._id,
      name,
      tagName: name,
    })),
  );
  await db.collection(physicalNames.links).insertMany([...docs, foreign]);
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    }),
    errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("http://localhost:3100/login");
  await page.locator('input[name="identifier"]').fill(credentials.email);
  await page.locator('input[name="password"]').fill(credentials.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  const base = `http://localhost:3100/${workspace.slug}/campaigns/${campaignId}`;
  const library = page.getByRole("region", { name: "Choose campaign links" });
  const button = (name: string) =>
    library.getByRole("button", { name, exact: true });
  async function open() {
    await page.goto(`${base}/builder`);
    await page
      .getByRole("button", { name: "Browse links", exact: true })
      .click();
  }
  // Toggles a tag in the toolbar's Tag facet (server-searched options).
  async function tag(name: string) {
    const token = library.getByRole("button", { name: /^Change filter: Tag/ });
    if (await token.count()) await token.click();
    else {
      await library.getByRole("button", { name: /^Filter/ }).click();
      await page.getByRole("option", { name: "Tag", exact: true }).click();
    }
    await page.getByRole("combobox", { name: "Search tags…" }).fill(name);
    await page.getByRole("option", { name: new RegExp(`^${name}\\b`) }).click();
    await page.keyboard.press("Escape");
  }
  async function params() {
    await page.locator('input[name="source"]').fill("newsletter");
    await page.locator('input[name="medium"]').fill("email");
  }
  await open();
  await tag(tagNames[0]!);
  await library.getByText(/1,001 matching links/).waitFor();
  assert.equal(
    await page.getByText("Foreign campaign secret", { exact: true }).count(),
    0,
  );
  await button("Select this page").click();
  await button("Use 20 selected links").waitFor();
  await button("Next").click();
  await button("Select group on this page").click();
  await button("Use 40 selected links").waitFor();
  await tag(tagNames[1]!);
  await library.getByText(/1,005 matching links/).waitFor();
  await library
    .getByRole("button", { name: /^Change filter: Tag is any of/ })
    .waitFor();
  await tag(tagNames[0]!);
  await library.getByText(/4 matching links/).waitFor();
  await button("Select this page").click();
  await button("Use 44 selected links").waitFor();
  await mkdir("test-results/captures", { recursive: true });
  if (process.argv.includes("--capture"))
    await page.screenshot({
      path: "test-results/captures/campaign-library-desktop.png",
      fullPage: true,
    });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Campaign mobile overflow",
  );
  const clipping = await library.evaluate((root) => {
    const bounds = root.getBoundingClientRect();
    return [...root.querySelectorAll("input,button,select")]
      .filter((el) => {
        const box = el.getBoundingClientRect();
        return (
          box.width > 0 &&
          (box.left < bounds.left - 1 || box.right > bounds.right + 1)
        );
      })
      .map((el) => el.outerHTML.slice(0, 100));
  });
  assert.deepEqual(clipping, [], "Campaign picker clips controls");
  if (process.argv.includes("--capture"))
    await page.screenshot({
      path: "test-results/captures/campaign-library-mobile.png",
      fullPage: true,
    });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await button("Use 44 selected links").click();
  assert.equal(
    await page.locator('input[type="hidden"][name="link"]').count(),
    44,
  );
  await params();
  await page
    .getByRole("button", { name: "Save variants on 44 links", exact: true })
    .click();
  await page.waitForURL((url) => url.searchParams.get("variants") === "44");
  const variantFilter = {
    workspaceId: workspace._id,
    "utmLinks.campaign.title": title,
  };
  assert.equal(
    await db.collection(physicalNames.links).countDocuments(variantFilter),
    44,
  );
  await open();
  await button("Clear selection").click();
  await tag(tagNames[1]!);
  await library.getByText(/4 matching links/).waitFor();
  await button("Select all results").click();
  await button("Use 4 selected links").click();
  await params();
  await page
    .getByRole("button", { name: "Save variants on 4 links", exact: true })
    .click();
  await page.waitForURL(
    (url) =>
      url.searchParams.get("variants") === "0" &&
      url.searchParams.get("skipped") === "4",
  );
  assert.equal(
    await db.collection(physicalNames.links).countDocuments(variantFilter),
    44,
  );
  await open();
  await button("Clear selection").click();
  await tag(tagNames[0]!);
  await library.getByText(/1,001 matching links/).waitFor();
  await button("Select all results").click();
  await button("Use 500 selected links").waitFor();
  assert(await button("Select all results").isDisabled());
  await button("Use 500 selected links").click();
  assert.equal(
    await page.locator('input[type="hidden"][name="link"]').count(),
    500,
  );
  const validId = (await page
    .locator('input[type="hidden"][name="link"]')
    .first()
    .getAttribute("value"))!;
  const before = await db
    .collection(physicalNames.links)
    .findOne({ _id: new ObjectId(validId) });
  await page
    .locator('input[type="hidden"][name="link"]')
    .evaluateAll((inputs, foreignId) => {
      inputs.slice(2).forEach((input) => input.remove());
      (inputs[1] as HTMLInputElement).value = foreignId;
    }, String(foreign._id));
  await page
    .getByRole("button", { name: "Save variants on 500 links", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: /no longer exists/ })
    .waitFor();
  assert.deepEqual(
    (
      await db
        .collection(physicalNames.links)
        .findOne({ _id: new ObjectId(validId) })
    )?.utmLinks,
    before?.utmLinks,
  );
  assert.equal(
    (await db.collection(physicalNames.links).findOne({ _id: foreign._id }))
      ?.utmLinks,
    undefined,
  );
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "Campaign library: 1005 tagged links, grouping, multi-page/cross-filter selection, 44 real variant saves, duplicate retries, 500-link cap, foreign-target preflight, desktop/mobile bounds, no sheets and no console errors passed.",
  );
} finally {
  await browser.close();
  await db.collection(physicalNames.campaigns).deleteOne({ _id: campaignId });
  await db.collection(physicalNames.links).deleteMany({
    _id: { $in: [...docs.map((link) => link._id), foreign._id] },
  });
  await db.collection(physicalNames.tags).deleteMany({ _id: { $in: tagIds } });
  cache.disconnect();
  await client.close();
}
