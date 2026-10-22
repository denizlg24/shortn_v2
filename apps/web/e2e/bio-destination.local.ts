import { strict as assert } from "node:assert";
import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";
import { MongoClient, ObjectId } from "mongodb";
import { physicalNames } from "@shortn/db";
import { encodeSelection } from "../src/lib/bulk-selection";
import { newBioLinksSection } from "@shortn/core/bio-content";
const credentials = JSON.parse(
  await readFile("/tmp/shortn-p5-login.json", "utf8"),
);
assert.equal(
  new URL(credentials.directoryEditor).origin,
  "http://localhost:3100",
);
const mongo = await new MongoClient(
  "mongodb://127.0.0.1:27020/?replicaSet=rs0",
).connect();
const db = mongo.db("shortn_p5_dev");
const [workspace, , sourceId] = new URL(credentials.directoryEditor).pathname
  .slice(1)
  .split("/");
const source = (await db
  .collection(physicalNames.bio_pages)
  .findOne({ _id: new ObjectId(sourceId) }))!;
const pageId = new ObjectId(),
  marker = `bio-destination-${pageId.toHexString().slice(-8)}`,
  tagId = new ObjectId();
const fixtures = Array.from({ length: 1005 }, (_, index) => ({
  _id: new ObjectId(),
  workspaceId: source.workspaceId,
  key: `${marker}-${index}`,
  urlCode: `${marker}-${index}`,
  domain: "localhost:3102",
  longUrl: `https://example.com/${marker}/${index}`,
  title: `${marker} ${String(index).padStart(4, "0")}`,
  date: new Date(),
  tags: [{ _id: tagId, name: marker, tagName: marker }],
}));
await db.collection(physicalNames.links).insertMany(fixtures);
await db.collection(physicalNames.tags).insertOne({
  _id: tagId,
  workspaceId: source.workspaceId,
  name: marker,
  tagName: marker,
});
await db.collection(physicalNames.bio_pages).insertOne({
  ...source,
  _id: pageId,
  slug: marker,
  handle: marker,
  title: marker,
  draftRevision: 0,
  publishedRevision: 0,
  published: false,
  draft: {
    ...source.draft,
    blocks: [
      source.draft.blocks[0],
      { ...newBioLinksSection("articles"), title: "Articles" },
      { ...newBioLinksSection("shop"), title: "Shop" },
    ],
  },
});
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {}),
});
try {
  await mkdir("test-results/captures/bio-destination", { recursive: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await page.addLocatorHandler(
    page.getByRole("dialog").filter({
      has: page.getByRole("button", { name: "Close", exact: true }),
    }),
    async (dialog) => {
      await dialog.getByRole("button", { name: "Close", exact: true }).click();
    },
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:3100/login");
  await page.locator('input[name="identifier"]').fill(credentials.email);
  await page.locator('input[name="password"]').fill(credentials.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  const base = `http://localhost:3100/${workspace}`;
  await page.goto(`${base}/links?q=${marker}`);
  await page.locator('input[name="ids"]').first().check();
  await page.getByText("1 selected", { exact: true }).waitFor();
  const firstId = await page.locator('input[name="ids"]').first().inputValue();
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await page.waitForURL((url) => url.searchParams.get("page") === "2");
  await page.waitForFunction(
    (id) =>
      document.querySelector<HTMLInputElement>('input[name="ids"]')?.value !==
      id,
    firstId,
  );
  await page.locator('input[name="ids"]').first().check();
  await page.getByText("2 selected", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Add to bio page", exact: true })
    .click();
  await page.getByLabel("Search bio pages").fill(marker);
  await page.getByRole("button").filter({ hasText: marker }).click();
  await page
    .getByLabel("Links section", { exact: true })
    .selectOption("articles");
  await page.screenshot({
    path: "test-results/captures/bio-destination/desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Add 2 links to draft", exact: true })
    .click();
  await page.getByRole("link", { name: "Review and publish" }).waitFor();
  const draft = (await db
    .collection(physicalNames.bio_pages)
    .findOne({ _id: pageId }))!;
  assert.equal(
    draft.draft.blocks.find((block: { id: string }) => block.id === "articles")
      .items.length,
    2,
  );
  assert.equal(draft.publishedRevision, 0);
  await page.getByRole("link", { name: "Review and publish" }).click();
  await page
    .getByRole("button", { name: "Back to section", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Back to canvas", exact: true })
    .click();
  await page.getByRole("button", { name: "Add links", exact: true }).click();
  await page.getByRole("button", { name: /Articles.*2 links/ }).click();
  await page
    .getByRole("searchbox", { name: "Search", exact: true })
    .fill(marker);
  await page.getByText("1,005 matching links").waitFor();
  assert.equal(
    await page.locator(".studio-library-table tbody tr").count(),
    20,
  );
  await page
    .locator(".studio-link-manager")
    .getByRole("button", { name: /^Filter/ })
    .click();
  await page.getByRole("option", { name: "Tag", exact: true }).click();
  await page.getByRole("combobox", { name: "Search tags…" }).fill(marker);
  await page.getByRole("option", { name: marker, exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("searchbox", { name: "Search", exact: true }).fill("");
  await page.getByText("1,005 matching links").waitFor();

  await page.screenshot({
    path: "test-results/captures/bio-destination/editor-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 900 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: "test-results/captures/bio-destination/editor-mobile.png",
    fullPage: true,
  });
  await page.goto(
    `${base}/links/bio?selection=${encodeSelection([fixtures[1000]!._id.toHexString()])}`,
  );
  await page.getByLabel("Search bio pages").fill(marker);
  await page.getByRole("button").filter({ hasText: marker }).click();
  await page.getByLabel("Links section", { exact: true }).selectOption("");
  await page
    .getByLabel("Section title", { exact: true })
    .fill("New releases and announcements");
  await page.screenshot({
    path: "test-results/captures/bio-destination/mobile.png",
    fullPage: true,
  });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page
    .getByRole("button", { name: "Add 1 link to draft", exact: true })
    .click();
  await page.getByRole("link", { name: "Review and publish" }).waitFor();
  const changed = (await db
    .collection(physicalNames.bio_pages)
    .findOne({ _id: pageId }))!;
  assert.equal(
    changed.draft.blocks.at(-1).title,
    "New releases and announcements",
  );
  assert.equal(
    changed.draft.blocks.at(-1).items[0].linkId,
    fixtures[1000]!._id.toHexString(),
  );
  await page.goto(`${base}/links/new`);
  await page
    .getByLabel("Destination URL", { exact: true })
    .fill(`https://example.com/${marker}/created`);
  await page
    .getByRole("checkbox", { name: /Add this link to a bio page/ })
    .check();
  await page.getByRole("button", { name: "Create link", exact: true }).click();
  await page.waitForURL((url) => url.pathname.endsWith("/links/bio"));
  await page.getByLabel("Search bio pages").waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "Bio destination: existing/new sections, cross-page selection, 1,005-link library, mobile layout and Create Link passed.",
  );
} finally {
  await browser.close();
  await db.collection(physicalNames.bio_pages).deleteOne({ _id: pageId });
  await db.collection(physicalNames.links).deleteMany({
    workspaceId: source.workspaceId,
    $or: [
      { key: { $regex: `^${marker}` } },
      { longUrl: `https://example.com/${marker}/created` },
    ],
  });
  await db.collection(physicalNames.tags).deleteOne({ _id: tagId });
  await mongo.close();
}
