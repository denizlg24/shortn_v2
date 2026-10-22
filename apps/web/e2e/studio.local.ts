import { readFile, mkdir } from "node:fs/promises";
import { strict as assert } from "node:assert";
import { chromium } from "playwright-core";
import sharp from "sharp";
import { MongoClient, ObjectId } from "mongodb";
import { physicalNames } from "@shortn/db";
const credentials = JSON.parse(
  await readFile("/tmp/shortn-p5-login.json", "utf8"),
);
assert(new URL(credentials.directoryEditor).origin === "http://localhost:3100");
// Keep browser mutations isolated from the demo the user is editing.
const mongo = await new MongoClient(
  "mongodb://127.0.0.1:27020/?replicaSet=rs0",
).connect();
const db = mongo.db("shortn_p5_dev"),
  fixtureId = new ObjectId(),
  fixtureHandle = `p5-browser-${fixtureId.toHexString().slice(-6)}`;
const sourceId = new URL(credentials.directoryEditor).pathname.split("/")[3]!;
const source = (await db
  .collection(physicalNames.bio_pages)
  .findOne({ _id: new ObjectId(sourceId) }))!;
const resources = await db
  .collection(physicalNames.links)
  .find({ workspaceId: source.workspaceId, key: /^p5-resource-/ })
  .sort({ key: 1 })
  .toArray();
const tagNames = [
  `Browser Alpha ${fixtureHandle}`,
  `Browser Beta ${fixtureHandle}`,
];
const tagIds = [new ObjectId(), new ObjectId()];
await db.collection(physicalNames.tags).insertMany(
  tagNames.map((name, at) => ({
    _id: tagIds[at],
    workspaceId: source.workspaceId,
    name,
    tagName: name,
  })),
);
const libraryFixtures = Array.from({ length: 1005 }, (_, at) => {
  const group = at < 1001 ? 0 : 1,
    key = `${fixtureHandle}-library-${at}`;
  return {
    _id: new ObjectId(),
    workspaceId: source.workspaceId,
    key,
    urlCode: key,
    title: `Bulk sample ${String(at).padStart(4, "0")}`,
    domain: "localhost:3102",
    longUrl: `https://example.com/${key}`,
    hidden: true,
    date: new Date(),
    tags: [
      { _id: tagIds[group], tagName: tagNames[group], name: tagNames[group] },
    ],
  };
});
// Matching foreign-workspace data must never enter the picker or bulk selection.
libraryFixtures.push({
  ...libraryFixtures[0]!,
  _id: new ObjectId(),
  workspaceId: new ObjectId(),
  key: `${fixtureHandle}-foreign`,
  urlCode: `${fixtureHandle}-foreign`,
  title: "Foreign workspace secret",
});
await db.collection(physicalNames.links).insertMany(libraryFixtures);
const content = {
  ...source.draft,
  seo: { title: "", description: "", noindex: true },
  blocks: [
    {
      id: "profile",
      type: "profile",
      visible: true,
      title: "Studio resource directory",
      description: "",
      avatar: "",
      align: "center",
      avatarShape: "circle",
    },
    {
      id: "directory-intro",
      visible: true,
      type: "text",
      text: "Synthetic demo: 125 sample resources for testing search, pagination and visual editing.",
    },
    {
      id: "directory-links",
      visible: true,
      type: "links",
      title: "Resources",
      layout: "paginated",
      pageSize: 10,
      items: resources.map((link) => ({
        id: `resource-${link.key}`,
        visible: true,
        linkId: String(link._id),
        title: link.title,
        image: "",
        highlight: false,
      })),
    },
    {
      id: "directory-footer",
      visible: true,
      type: "header",
      text: "Made for testing",
    },
  ],
};
await db.collection(physicalNames.bio_pages).insertOne({
  _id: fixtureId,
  workspaceId: source.workspaceId,
  handle: fixtureHandle,
  published: true,
  publicationManaged: true,
  draftRevision: 0,
  publishedRevision: 0,
  draft: content,
  publishedContent: content,
});
credentials.directoryEditor = credentials.directoryEditor.replace(
  sourceId,
  String(fixtureId),
);
credentials.directoryBio = `http://localhost:3100/_bio/${fixtureHandle}`;
const browser = await chromium.launch({ headless: true });
const capture = process.argv.includes("--capture");
const review = "test-results/captures";
await mkdir(review, { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("http://localhost:3100/login");
  await page.locator('input[name="identifier"]').fill(credentials.email);
  await page.locator('input[name="password"]').fill(credentials.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await page.goto(credentials.directoryEditor);
  await page.locator(".studio-section").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.getByRole("dialog").count(), 0);
  if (capture)
    await page.screenshot({ path: `${review}/desktop.png`, fullPage: true });
  // Every focused editor view keeps a live preview, beside controls on wide screens.
  const sidePreview = page.getByRole("complementary", { name: "Live preview" });
  for (const name of [
    "Add section",
    "Sections",
    "Theme",
    "Page settings",
    "History",
  ]) {
    await page.getByRole("button", { name, exact: true }).first().click();
    assert(await sidePreview.isVisible(), `Missing preview in ${name}`);
    const controls = (await page
      .locator(".studio-workspace-body")
      .boundingBox())!;
    const preview = (await sidePreview.boundingBox())!;
    assert(
      preview.x >= controls.x + controls.width,
      `Preview is not beside ${name}`,
    );
    if (name === "Theme") {
      const preset = page.getByLabel("Preset theme", { exact: true });
      await preset.selectOption("forest");
      assert.equal(await preset.inputValue(), "forest");
      await page.getByRole("button", { name: "Back to canvas" }).click();
      await page.getByRole("button", { name: "Theme", exact: true }).click();
      assert.equal(await preset.inputValue(), "forest");
      await page.getByLabel("Background", { exact: true }).fill("#edf3f8");
      assert.equal(await preset.inputValue(), "");
      assert.equal(
        await preset.locator("option:checked").innerText(),
        "Custom",
      );
      assert.equal(
        await sidePreview
          .locator(".bio-page")
          .evaluate((el) =>
            getComputedStyle(el).getPropertyValue("--bio-bg").trim(),
          ),
        "#edf3f8",
      );
      if (capture)
        await page.screenshot({
          path: `${review}/side-preview-theme.png`,
          fullPage: true,
        });
    }
    await page.getByRole("button", { name: "Back to canvas" }).click();
  }
  // A short text section must retain its size when moved over a tall collection.
  const section = page.locator('[data-section-id="directory-intro"]');
  const before = (await section.boundingBox())!;
  const drag = section.locator(".studio-section-tools button").first();
  await drag.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(350);
  const during = (await section.boundingBox())!;
  assert(
    Math.abs(during.height - before.height) < 1,
    `Drag changed height ${before.height} → ${during.height}`,
  );
  assert(
    Math.abs(during.width - before.width) < 1,
    `Drag changed width ${before.width} → ${during.width}`,
  );
  await page.keyboard.press("Escape");
  await section.scrollIntoViewIfNeeded();
  await section.hover();
  const handle = (await drag.boundingBox())!,
    pointerBefore = (await section.boundingBox())!;
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 100, {
    steps: 8,
  });
  const pointerDuring = (await section.boundingBox())!;
  assert(
    Math.abs(pointerDuring.height - pointerBefore.height) < 1,
    "Pointer drag changed section height",
  );
  assert(
    Math.abs(pointerDuring.width - pointerBefore.width) < 1,
    "Pointer drag changed section width",
  );
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.waitForTimeout(100);
  await page.getByRole("button", { name: "Sections", exact: true }).click();
  await page
    .locator(".studio-workspace")
    .getByRole("button", { name: "Links · 125", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Display links").inputValue(),
    "paginated",
  );
  assert(await sidePreview.isVisible());
  for (const style of ["small-grid", "large-grid", "image-grid", "list"]) {
    await page.getByLabel("Link cards").selectOption(style);
    assert.equal(
      await page.locator(`.studio-canvas [data-layout="${style}"]`).count(),
      1,
    );
    assert.equal(
      await sidePreview.locator(`[data-layout="${style}"]`).count(),
      1,
    );
  }
  await page.getByLabel("Link cards").selectOption("large-grid");
  await page.getByLabel("Card corners").selectOption("rounded");
  await page.getByLabel("Card content").selectOption("image-text");
  await page.getByLabel("Pagination controls").selectOption("arrows");
  await page.getByLabel("Show page count", { exact: true }).uncheck();
  await page.getByLabel("Show link count", { exact: true }).check();
  if (capture)
    await page.screenshot({
      path: `${review}/desktop-customization.png`,
      fullPage: true,
    });
  await page.getByRole("button", { name: "Manage 125 links" }).click();
  assert.equal(
    await page.getByRole("button", { name: "Edit link", exact: true }).count(),
    20,
  );
  assert(await sidePreview.isVisible());
  await page.getByRole("button", { name: "Next", exact: true }).click();
  assert.equal(
    await page
      .getByRole("navigation", { name: "Link pages" })
      .innerText()
      .then((s) => s.includes("2 / 7")),
    true,
  );
  await page.getByLabel("Search links").fill("125");
  assert.equal(
    await page.getByRole("button", { name: "Edit link", exact: true }).count(),
    1,
  );
  await page.getByLabel("Search links").fill("");
  if (capture)
    await page.screenshot({
      path: `${review}/desktop-links.png`,
      fullPage: true,
    });
  await page.getByRole("button", { name: "Add link", exact: true }).click();
  await page.getByLabel("Search links").fill("Sample resource");
  await page.getByRole("button", { name: "Next", exact: true }).waitFor();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Link pages" })
    .filter({ hasText: "2 / 7" })
    .waitFor();
  await page.getByLabel("Search links").fill("125");
  await page.getByText("Sample resource 125", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Back to links" }).click();
  // Select from a thousand-link library by tag, preserving choices across pages/filters.
  await page.getByRole("button", { name: "Back to canvas" }).click();
  await page
    .getByRole("button", { name: "Add section", exact: true })
    .first()
    .click();
  await page
    .locator(".studio-workspace-body")
    .getByRole("button", { name: "Links", exact: true })
    .click();
  await page
    .getByLabel("Display links", { exact: true })
    .selectOption("paginated");
  await page
    .getByRole("button", { name: "Manage 0 links", exact: true })
    .click();
  await page.getByRole("button", { name: "Add link", exact: true }).click();
  async function chooseTag(tag: string) {
    await page
      .getByRole("combobox", { name: "Filter by tags", exact: true })
      .click();
    await page.getByRole("option", { name: tag, exact: true }).click();
    await page.keyboard.press("Escape");
  }
  await chooseTag(tagNames[0]!);
  await page.getByText(/1,001 matching links/).waitFor();
  assert.equal(
    await page.getByText("Foreign workspace secret", { exact: true }).count(),
    0,
  );
  await page
    .getByRole("button", { name: "Select this page", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add 20 selected", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("button", { name: "Select group on this page", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add 40 selected", exact: true })
    .waitFor();
  await chooseTag(tagNames[1]!);
  await page.getByText(/1,005 matching links/).waitFor();
  const tagFilter = page.getByRole("combobox", {
    name: "Filter by tags",
    exact: true,
  });
  assert.equal(await tagFilter.innerText(), "2 tags");
  const tagBounds = (await tagFilter.boundingBox())!;
  const groupBounds = (await page
    .getByLabel("Group results", { exact: true })
    .boundingBox())!;
  assert(
    tagBounds.x + tagBounds.width < groupBounds.x,
    "Selected tags overlap grouping field",
  );
  if (capture)
    await page.screenshot({
      path: `${review}/tag-library-multiple-desktop.png`,
      fullPage: true,
    });
  await page
    .getByRole("button", { name: `Remove tag ${tagNames[0]}`, exact: true })
    .click();
  await page.getByText(/4 matching links/).waitFor();
  await page
    .getByRole("button", { name: "Select this page", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add 44 selected", exact: true })
    .waitFor();
  if (capture)
    await page.screenshot({
      path: `${review}/tag-library-desktop.png`,
      fullPage: true,
    });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Tag picker mobile overflow",
  );
  const libraryClipping = await page
    .locator(".studio-workspace-body")
    .evaluate((root) => {
      const outer = root.getBoundingClientRect();
      return [...root.querySelectorAll("button,input,select")]
        .filter((el) => {
          const box = el.getBoundingClientRect();
          return (
            box.width > 0 &&
            (box.left < outer.left - 1 || box.right > outer.right + 1)
          );
        })
        .map((el) => el.outerHTML.slice(0, 100));
    });
  assert.deepEqual(libraryClipping, [], "Tag picker controls clipped");
  if (capture)
    await page.screenshot({
      path: `${review}/tag-library-mobile.png`,
      fullPage: true,
    });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await chooseTag(tagNames[0]!);
  await page.getByText(/1,001 matching links/).waitFor();
  await page
    .getByRole("button", { name: "Select all results", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add 1000 selected", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Select all results", exact: true })
      .isDisabled(),
    true,
  );
  await page
    .getByRole("button", { name: "Add 1000 selected", exact: true })
    .click();
  await page
    .getByText("1,000 links in this section", { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Back to section", exact: true })
    .click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("button", { name: "Sections", exact: true }).click();
  await page
    .locator(".studio-workspace-body")
    .getByRole("button", { name: "Links · 125", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Manage 125 links", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit link", exact: true })
    .first()
    .click();
  const png = await sharp({
    create: { width: 80, height: 80, channels: 4, background: "#315c40" },
  })
    .png()
    .toBuffer();
  async function upload(label: string) {
    const response = page.waitForResponse(
      (r) =>
        r.url().includes("/api/uploads/") && r.request().method() === "POST",
    );
    await page
      .locator('input[type="file"]')
      .and(page.getByLabel(label, { exact: true }))
      .setInputFiles({
        name: "studio-test.png",
        mimeType: "image/png",
        buffer: png,
      });
    const result = await response;
    assert.equal(result.status(), 200, await result.text());
    const body = await result.json();
    assert.equal((await page.request.get(body.url)).status(), 200);
    await page
      .locator('[data-uploading="true"]')
      .waitFor({ state: "detached" });
    assert.equal(
      await page.locator('input[type="url"]').count(),
      0,
      "Image editor should not expose a URL field",
    );
  }
  await upload("Thumbnail");
  await page.getByRole("button", { name: "Back to canvas" }).click();
  await page.getByRole("button", { name: "Sections", exact: true }).click();
  await page
    .locator(".studio-workspace")
    .getByRole("button", { name: "Profile", exact: true })
    .click();
  const titleInput = page.getByLabel("Title", { exact: true });
  await titleInput.fill("Live profile change");
  assert.equal(
    await sidePreview.locator("h1").innerText(),
    "Live profile change",
  );
  await titleInput.fill("Studio resource directory");
  await upload("Avatar");
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("button", { name: "Theme", exact: true }).click();
  await upload("Cover image (optional)");
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page
    .getByRole("button", { name: "Add section", exact: true })
    .first()
    .click();
  await page
    .locator(".studio-workspace")
    .getByRole("button", { name: "Image", exact: true })
    .click();
  await upload("Image");
  await page
    .getByLabel("Image description", { exact: true })
    .fill("Uploaded test image");
  await page.getByRole("button", { name: "Back to canvas" }).click();
  assert.equal(await page.locator(".studio-canvas .bio-image").count(), 1);
  await page.getByRole("button", { name: "Sections", exact: true }).click();
  await page
    .locator(".studio-workspace")
    .getByRole("button", { name: "Image", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove", exact: true })
    .last()
    .click();
  assert.equal(await page.locator(".studio-canvas .bio-image").count(), 0);
  await page
    .getByRole("button", { name: "Page settings", exact: true })
    .click();
  await upload("Favicon");
  const favicon = await page
    .locator(".studio-workspace-body img")
    .getAttribute("src");
  await page.getByRole("button", { name: "Back to canvas" }).click();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page
    .locator(".studio-status [role=status]")
    .filter({ hasText: "Published" })
    .waitFor();
  const publicPage = await browser.newPage();
  await publicPage.goto(credentials.directoryBio);
  assert.equal(await publicPage.locator(".bio-link").count(), 10);
  const labelHeights = await publicPage
    .locator(".bio-link span")
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  assert(
    labelHeights.every((height) => height >= 14),
    "Square card labels must remain visibly sized",
  );
  assert.equal(
    await publicPage
      .locator('link[rel="icon"]')
      .evaluateAll((els) =>
        els.some(
          (el) =>
            el.getAttribute("href") ===
            document
              .querySelector('link[rel="shortcut icon"]')
              ?.getAttribute("href"),
        ),
      ),
    true,
  );
  assert(favicon);
  assert(
    await publicPage
      .locator('link[rel="icon"]')
      .evaluateAll(
        (els, href) => els.some((el) => el.getAttribute("href") === href),
        favicon,
      ),
  );
  assert.equal(
    await publicPage
      .locator('.bio-link-list[data-layout="large-grid"]')
      .count(),
    1,
  );
  assert.equal(
    await publicPage.locator(".bio-pagination span:not(.bio-sr-only)").count(),
    0,
  );
  assert.equal(
    await publicPage.locator(".bio-collection-count").innerText(),
    "125 links",
  );
  await publicPage.getByRole("button", { name: "Next links" }).click();
  assert.equal(
    await publicPage
      .locator(".bio-link")
      .first()
      .innerText()
      .then((s) => s.trim()),
    "Sample resource 011",
  );
  if (capture)
    await publicPage.screenshot({
      path: `${review}/public-grid.png`,
      fullPage: true,
    });
  assert(
    (
      await publicPage.locator(".bio-link").first().getAttribute("href")
    )?.includes("block=resource-p5-resource-011"),
  );
  // Image-only square cards hide the visual caption while retaining an accessible link name.
  await page.getByRole("button", { name: "Sections", exact: true }).click();
  await page
    .locator(".studio-workspace")
    .getByRole("button", { name: "Links · 125", exact: true })
    .click();
  await page.getByLabel("Card content").selectOption("image-only");
  await page.getByLabel("Card corners").selectOption("square");
  await page.getByLabel("Image fit").selectOption("contain");
  if (capture)
    await page.screenshot({
      path: `${review}/desktop-customization.png`,
      fullPage: true,
    });
  await page.getByRole("button", { name: "Back to canvas" }).click();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page
    .locator(".studio-status [role=status]")
    .filter({ hasText: "Published" })
    .waitFor();
  await publicPage.reload();
  const imageCard = publicPage
    .locator('.bio-link[data-content="image-only"]')
    .first();
  assert.equal(
    await imageCard.getAttribute("aria-label"),
    "Sample resource 001",
  );
  assert.equal(
    await imageCard.evaluate((el) => getComputedStyle(el).borderRadius),
    "0px",
  );
  assert.equal(
    await imageCard
      .locator("img")
      .evaluate((el) => getComputedStyle(el).objectFit),
    "contain",
  );
  assert.equal(await imageCard.locator("span").isVisible(), false);
  assert.equal(
    await publicPage
      .locator('.bio-link[data-content="text"]')
      .first()
      .locator("span")
      .isVisible(),
    true,
  );
  if (capture)
    await publicPage.screenshot({
      path: `${review}/public-image-cards.png`,
      fullPage: true,
    });
  // Minimal surfaces remain borderless even when the page theme requests outlines.
  await page.getByRole("button", { name: "Theme", exact: true }).click();
  await page.getByLabel("Button style").selectOption("outline");
  await page.getByRole("button", { name: "Sections", exact: true }).click();
  await page
    .locator(".studio-workspace")
    .getByRole("button", { name: "Links · 125", exact: true })
    .click();
  await page.getByLabel("Link cards").selectOption("list");
  await page.getByText("Link styling", { exact: true }).click();
  await page.getByLabel("Link surface").selectOption("minimal");
  await page.getByLabel("Link border").selectOption("none");
  await page.getByLabel("Text weight").selectOption("regular");
  await page.getByLabel("Link spacing").selectOption("compact");
  await page.getByLabel("Show link arrows", { exact: true }).uncheck();
  await page.getByLabel("Pagination appearance").selectOption("muted");
  await page.getByLabel("Pagination size").selectOption("small");
  // Toggle both flags on an older draft, then create a section and toggle its defaulted flags.
  await page.getByLabel("Show page count", { exact: true }).check();
  await page.getByLabel("Show page count", { exact: true }).uncheck();
  await page.getByLabel("Show link count", { exact: true }).uncheck();
  await page.getByLabel("Show link count", { exact: true }).check();
  await page
    .getByRole("button", { name: "Add section", exact: true })
    .first()
    .click();
  await page
    .locator(".studio-workspace")
    .getByRole("button", { name: "Links", exact: true })
    .click();
  await page.getByLabel("Show link count", { exact: true }).check();
  await page.getByLabel("Show link count", { exact: true }).uncheck();
  await page.getByLabel("Display links").selectOption("paginated");
  await page.getByLabel("Show page count", { exact: true }).uncheck();
  await page.getByLabel("Show page count", { exact: true }).check();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page
    .locator(".studio-status [role=status]")
    .filter({ hasText: "Published" })
    .waitFor();
  await publicPage.reload();
  const bareLink = publicPage.locator(".bio-link").first();
  const linkStyle = await bareLink.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      border: style.borderTopWidth,
      background: style.backgroundColor,
      weight: style.fontWeight,
    };
  });
  assert.equal(linkStyle.border, "0px");
  assert.equal(linkStyle.background, "rgba(0, 0, 0, 0)");
  assert.equal(linkStyle.weight, "400");
  assert.equal(await bareLink.locator("svg").count(), 0);
  const pagerStyle = await publicPage
    .getByRole("button", { name: "Next links" })
    .evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        border: style.borderTopWidth,
        height: el.getBoundingClientRect().height,
      };
    });
  assert.equal(pagerStyle.border, "0px");
  assert.equal(pagerStyle.height, 32);
  await bareLink.focus();
  assert.equal(
    await bareLink.evaluate((el) => getComputedStyle(el).outlineStyle),
    "solid",
  );
  await publicPage.getByRole("button", { name: "Next links" }).click();
  assert.equal(
    await publicPage.locator(".bio-link").first().getAttribute("aria-label"),
    "Sample resource 011",
  );
  if (capture)
    await publicPage.screenshot({
      path: `${review}/public-minimal-desktop.png`,
      fullPage: true,
    });
  await publicPage.setViewportSize({ width: 390, height: 844 });
  if (capture)
    await publicPage.screenshot({
      path: `${review}/public-minimal-mobile.png`,
      fullPage: true,
    });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".studio-canvas").evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Mobile document overflow",
  );
  if (capture)
    await page.screenshot({ path: `${review}/mobile.png`, fullPage: true });
  await page.getByRole("button", { name: "Sections", exact: true }).click();
  await page
    .locator(".studio-workspace")
    .getByRole("button", { name: "Links · 125", exact: true })
    .click();
  await page.getByRole("button", { name: "Manage 125 links" }).click();
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Mobile manager overflow",
  );
  const clipped = await page.locator(".studio-workspace").evaluate((root) => {
    const outer = root.getBoundingClientRect();
    return [...root.querySelectorAll("button,input")]
      .filter((el) => {
        const box = el.getBoundingClientRect();
        return (
          box.width > 0 &&
          (box.left < outer.left - 1 || box.right > outer.right + 1)
        );
      })
      .map((el) => el.outerHTML.slice(0, 100));
  });
  assert.deepEqual(clipped, [], "Mobile controls clipped inside workspace");
  const mobileControls = (await page
    .locator(".studio-workspace-body")
    .boundingBox())!;
  const mobilePreview = (await sidePreview.boundingBox())!;
  assert(
    mobilePreview.y >= mobileControls.y + mobileControls.height,
    "Mobile preview must follow controls",
  );
  await sidePreview.scrollIntoViewIfNeeded();
  if (capture)
    await page.screenshot({
      path: `${review}/side-preview-mobile.png`,
      fullPage: true,
    });
  await page.setViewportSize({ width: 1100, height: 900 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Intermediate preview overflow",
  );
  assert.equal(await page.getByRole("dialog").count(), 0);
  if (capture)
    await page.screenshot({
      path: `${review}/mobile-links.png`,
      fullPage: true,
    });
  assert.deepEqual(errors, []);
  console.log(
    "Studio: preset selection/custom detection, tag filtering/grouping, persistent multi-page selection, 1000-link bulk cap, workspace isolation, no select overflow, 125 links, search/library pagination, all five image uploads, favicon metadata, no sheets, keyboard/pointer drag dimensions, four layouts, image-only cards, corners/fit, publish, attribution and mobile bounds passed.",
  );
} finally {
  await browser.close();
  await db.collection(physicalNames.bio_pages).deleteOne({ _id: fixtureId });
  await db
    .collection(physicalNames.bio_page_versions)
    .deleteMany({ bioPageId: fixtureId });
  await db
    .collection(physicalNames.bio_delivery_jobs)
    .deleteMany({ bioPageId: fixtureId });
  await db
    .collection(physicalNames.links)
    .deleteMany({ _id: { $in: libraryFixtures.map((link) => link._id) } });
  await db.collection(physicalNames.tags).deleteMany({ _id: { $in: tagIds } });
  await mongo.close();
}
