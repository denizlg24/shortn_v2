import { strict as assert } from "node:assert";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
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
  db = mongo.db("shortn_p6_dev");
const cache = new Redis("redis://127.0.0.1:16380/6"),
  durable = new Redis("redis://127.0.0.1:16379/6");
const directory = ".impeccable/review/p6-bulk-tags",
  captures: object[] = [],
  errors: string[] = [],
  fixturePath = "/tmp/shortn-p6-bulk-tags-fixture.json";
await mkdir(directory, { recursive: true });
const incumbent =
  process.argv.includes("--incumbent") || process.argv.includes("--seed");
if (incumbent) {
  const workspaceId = new ObjectId(),
    slug = `bulk-tags-${crypto.randomUUID()}`;
  const workspace = {
    _id: workspaceId,
    name: "Synthetic bulk tag library",
    slug,
    personal: false,
    ownerUserId: login.userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const previousUser = await db
    .collection(physicalNames.user)
    .findOne({ _id: new ObjectId(login.userId) });
  await collection(db, "workspaces").insertOne(workspace);
  await collection(db, "workspace_members").insertOne({
    _id: new ObjectId(),
    workspaceId,
    userId: login.userId,
    role: "owner",
    createdAt: new Date(),
  });
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
  }));
  await db.collection(physicalNames.links).insertMany(links);
  await writeFile(
    fixturePath,
    JSON.stringify({
      workspaceId: String(workspaceId),
      slug,
      ids: links.map((link) => String(link._id)),
      lastWorkspaceId: previousUser?.lastWorkspaceId,
    }),
  );
}
const fixture = JSON.parse(await readFile(fixturePath, "utf8")),
  workspaceId = new ObjectId(fixture.workspaceId),
  root = `${login.origin}/${fixture.slug}/links`;
const browser = await chromium.launch({ headless: true });
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
try {
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
  if (incumbent && !process.argv.includes("--seed")) {
    await capture(page, "incumbent-links-1440", 1440);
    await capture(page, "incumbent-links-390", 390);
    console.log(
      "Incumbent captures ready; fixture retained for UI verification.",
    );
  } else if (process.argv.includes("--recapture-choice")) {
    await page.goto(
      `${root}/tags?selection=${encodeSelection(fixture.ids.slice(0, 26))}`,
    );
    await page.waitForURL((url) => url.searchParams.has("selectionRef"));
    await page.locator("#bulk-tag-choice").click();
    await page
      .getByPlaceholder("Search all workspace tags…")
      .fill("Synthetic tag 095");
    await page
      .getByRole("option", { name: "Synthetic tag 095", exact: true })
      .click();
    await page.keyboard.press("Escape");
    await page
      .locator("[data-radix-popper-content-wrapper]")
      .waitFor({ state: "detached" });
    await capture(page, "en-choice-light-1440", 1440);
    const evidence = JSON.parse(
      await readFile(`${directory}/browser-evidence.json`, "utf8"),
    );
    evidence.captures = evidence.captures.map((entry: { file: string }) =>
      entry.file.endsWith("/en-choice-light-1440.png") ? captures[0] : entry,
    );
    evidence.captureNote =
      "Choice image recaptured after the closing popover detached; no product edits. Local incumbent-links images were refreshed after adding the entry; pre-extension references are p6-health-ui/selection-links-1440.png and selection-links-390.png.";
    await writeFile(
      `${directory}/browser-evidence.json`,
      JSON.stringify(evidence, null, 2),
    );
    console.log("Choice screenshot recaptured after menu settled.");
  } else if (!incumbent) {
    await page
      .getByRole("checkbox", { name: "Select this page", exact: true })
      .check();
    await page.goto(`${root}?page=2`);
    await page.locator('input[name="ids"]').first().check();
    await page.getByText("26 selected", { exact: true }).waitFor();
    await page.goto(`${root}?tag=Synthetic%20tag%20000`);
    await page.getByText("26 selected", { exact: true }).waitFor();
    await capture(page, "en-selected-light-1440", 1440);
    await capture(page, "en-selected-light-390", 390);
    await page.getByRole("button", { name: "Edit tags", exact: true }).click();
    await page.waitForURL((url) => url.searchParams.has("selectionRef"));
    await page
      .getByText("26 links selected across pages and filters.", { exact: true })
      .waitFor();
    await page.getByRole("link", { name: "Cancel", exact: true }).click();
    await page.getByText("26 selected", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Edit tags", exact: true }).click();
    await page.waitForURL((url) => url.searchParams.has("selectionRef"));
    async function chooseTag(name: string) {
      await page.locator("#bulk-tag-choice").click();
      await page.getByPlaceholder("Search all workspace tags…").fill(name);
      await page.getByRole("option", { name, exact: true }).waitFor();
      await page.getByRole("option", { name, exact: true }).click();
      await page.keyboard.press("Escape");
    }
    await chooseTag("Synthetic tag 095");
    await capture(page, "en-choice-light-1440", 1440);
    // A failed action keeps the exact selection and chosen tags for retry.
    const actionUrl = page.url();
    await page.route(actionUrl, async (route) => {
      if (route.request().method() === "POST")
        await route.fulfill({ status: 503, body: "Synthetic unavailable" });
      else await route.continue();
    });
    await page
      .getByRole("button", { name: "Apply tag changes", exact: true })
      .click();
    await page
      .getByText(
        "Tag changes could not be saved. Your selection is kept. Try again.",
        { exact: true },
      )
      .waitFor();
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
    await page
      .getByRole("button", { name: "Apply tag changes", exact: true })
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
        "Tags updated on 26 of 26 selected links. Unchanged links needed no update.",
        { exact: true },
      )
      .waitFor();
    await page.unroute(actionUrl);
    await capture(page, "en-success-light-390", 390);
    assert.equal(
      await db
        .collection(physicalNames.links)
        .countDocuments({ workspaceId, "tags.tagName": "Synthetic tag 095" }),
      26,
    );
    await page
      .getByRole("link", { name: "Back to links", exact: true })
      .click();
    await page
      .getByRole("checkbox", { name: "Select this page", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("region", { name: "Selection", exact: true })
        .count(),
      0,
    );
    const selection = encodeSelection(fixture.ids.slice(0, 51));
    await page.goto(`${root}/tags?selection=${selection}`);
    await page.waitForURL((url) => url.searchParams.has("selectionRef"));
    const ref = new URL(page.url()).searchParams.get("selectionRef")!;
    assert.equal(await page.locator("ul.divide-y > li").count(), 25);
    await capture(page, "en-review-light-1440", 1440);
    await capture(page, "en-review-light-390", 390);
    await page.goto(`${root}/tags?selectionRef=${ref}&page=2`);
    assert.equal(await page.locator("ul.divide-y > li").count(), 25);
    await page.goto(
      `${root}/tags?selectionRef=${ref}&tag=Synthetic%20tag%20000`,
    );
    await page
      .getByText("26 of 51 selected links match this view.", { exact: true })
      .waitFor();
    await page.goto(
      `${root}/tags?selectionRef=${ref}&q=no-matching-synthetic-link`,
    );
    await page
      .getByText("No selected links match these filters.", { exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByText("Apply to 51 selected links · 0 tags chosen", {
          exact: true,
        })
        .count(),
      1,
    );
    await page.goto(`${root}/tags?selectionRef=${ref}&q=example.com%2F50`);
    await page
      .getByText("1 of 51 selected links match this view.", { exact: true })
      .waitFor();
    await page.getByLabel("Operation", { exact: true }).selectOption("replace");
    assert.equal(
      await page
        .getByRole("button", { name: "Remove all tags", exact: true })
        .isDisabled(),
      true,
    );
    await capture(page, "en-clear-confirmation-light-390", 390);
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
    await page.getByLabel("Operation", { exact: true }).selectOption("replace");
    await chooseTag("Synthetic tag 099");
    await page
      .getByRole("button", { name: "Apply tag changes", exact: true })
      .click();
    await page
      .getByText(
        "Tags updated on 51 of 51 selected links. Unchanged links needed no update.",
        { exact: true },
      )
      .waitFor();
    const replaced = await db
      .collection(physicalNames.links)
      .find({
        _id: {
          $in: fixture.ids.slice(0, 51).map((id: string) => new ObjectId(id)),
        },
      })
      .toArray();
    assert(
      replaced.every(
        (row) =>
          row.tags.length === 1 && row.tags[0].tagName === "Synthetic tag 099",
      ),
    );
    await page.goto(
      `${root}/tags?selection=${encodeSelection(fixture.ids.slice(0, 2))}`,
    );
    await page.waitForURL((url) => url.searchParams.has("selectionRef"));
    await page.getByLabel("Operation", { exact: true }).selectOption("remove");
    await chooseTag("Synthetic tag 099");
    await page
      .getByRole("button", { name: "Apply tag changes", exact: true })
      .click();
    await page
      .getByText(
        "Tags updated on 2 of 2 selected links. Unchanged links needed no update.",
        { exact: true },
      )
      .waitFor();
    await page.goto(
      `${root}/tags?selection=${encodeSelection(fixture.ids.slice(2, 4))}`,
    );
    await page.waitForURL((url) => url.searchParams.has("selectionRef"));
    await page.getByLabel("Operation", { exact: true }).selectOption("replace");
    await page
      .getByRole("checkbox", {
        name: "Remove every tag from all 2 selected links.",
        exact: true,
      })
      .check();
    await page
      .getByRole("button", { name: "Remove all tags", exact: true })
      .click();
    await page
      .getByText(
        "Tags updated on 2 of 2 selected links. Unchanged links needed no update.",
        { exact: true },
      )
      .waitFor();
    assert.equal(
      await db.collection(physicalNames.links).countDocuments({
        _id: {
          $in: fixture.ids.slice(0, 4).map((id: string) => new ObjectId(id)),
        },
        tags: { $size: 0 },
      }),
      4,
    );
    // An editor can select other creators' links for tagging, while delete remains restricted.
    await collection(db, "workspace_members").updateOne(
      { workspaceId, userId: login.userId },
      { $set: { role: "editor" } },
    );
    await db
      .collection(physicalNames.links)
      .updateMany(
        { workspaceId },
        { $set: { createdBy: "synthetic-other-editor" } },
      );
    await page.goto(root);
    assert.equal(await page.locator('input[name="ids"]').count(), 25);
    await page.locator('input[name="ids"]').first().check();
    await page.getByRole("button", { name: "Edit tags", exact: true }).click();
    await page.waitForURL((url) => url.searchParams.has("selectionRef"));
    await page
      .getByText("1 link selected across pages and filters.", { exact: true })
      .waitFor();
    await collection(db, "workspace_members").updateOne(
      { workspaceId, userId: login.userId },
      { $set: { role: "viewer" } },
    );
    await chooseTag("Synthetic tag 090");
    await page
      .getByRole("button", { name: "Apply tag changes", exact: true })
      .click();
    await page
      .getByText(
        "You do not have permission to edit these links. Ask a workspace admin.",
        { exact: true },
      )
      .waitFor();
    assert.equal(
      await db
        .collection(physicalNames.links)
        .countDocuments({ workspaceId, "tags.tagName": "Synthetic tag 090" }),
      0,
    );
    await page.reload();
    await page
      .getByText(
        "You do not have permission to edit these links. Ask a workspace admin.",
        { exact: true },
      )
      .waitFor();
    await capture(page, "en-forbidden-light-390", 390);
    await page.goto(root);
    assert.equal(await page.locator('input[name="ids"]').count(), 0);
    await collection(db, "workspace_members").updateOne(
      { workspaceId, userId: login.userId },
      { $set: { role: "owner" } },
    );
    await page.goto(
      `${root}/tags?selection=${encodeSelection(fixture.ids.slice(0, 2))}`,
    );
    await page.waitForURL((url) => url.searchParams.has("selectionRef"));
    const staleUrl = page.url();
    await db
      .collection(physicalNames.links)
      .updateOne(
        { _id: new ObjectId(fixture.ids[1]) },
        { $set: { deletedAt: new Date() } },
      );
    await chooseTag("Synthetic tag 091");
    await page
      .getByRole("button", { name: "Apply tag changes", exact: true })
      .click();
    await page
      .getByText(
        "This selection has expired or contains links that are no longer available. Nothing changed. Return to Links and select them again.",
        { exact: true },
      )
      .waitFor();
    assert.equal(
      await db
        .collection(physicalNames.links)
        .countDocuments({ workspaceId, "tags.tagName": "Synthetic tag 091" }),
      0,
    );
    await capture(page, "en-stale-light-1440", 1440);
    const staleRef = new URL(staleUrl).searchParams.get("selectionRef");
    await durable.del(
      `links:tag-selection:${workspaceId}:${login.userId}:${staleRef}`,
    );
    await page.goto(staleUrl);
    await page
      .getByText(
        "This selection has expired or contains links that are no longer available. Nothing changed. Return to Links and select them again.",
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
          links: 5001,
          tags: 100,
          selectedLimit: 500,
          tagLimit: 50,
          captures,
          checks: [
            "cross-page/filter selection",
            "cancel retains selection",
            "tag beyond first 50",
            "retry and duplicate guards",
            "DB add26/replace51/remove2/clear2",
            "25-row pagination/search/tag/group review",
            "filtered review keeps original operation selection",
            "clear confirmation",
            "success clears selection",
            "editor may tag other creators",
            "viewer/accessloss/stale atomic refusal",
            "expired selection",
            "en/pt/es light/dark1440/390",
            "no browser errors",
          ],
        },
        null,
        2,
      ),
    );
    console.log("Bulk tags browser checks passed.");
  }
} finally {
  await browser.close();
  if (!incumbent) {
    await db.collection(physicalNames.user).updateOne(
      {
        _id: new ObjectId(login.userId),
        lastWorkspaceId: String(workspaceId),
      },
      fixture.lastWorkspaceId
        ? { $set: { lastWorkspaceId: fixture.lastWorkspaceId } }
        : { $unset: { lastWorkspaceId: "" } },
    );
    for (const name of [
      physicalNames.links,
      physicalNames.tags,
      physicalNames.workspace_members,
    ])
      await db.collection(name).deleteMany({ workspaceId });
    await collection(db, "workspaces").deleteOne({ _id: workspaceId });
    let cursor = "0";
    do {
      const [next, keys] = await durable.scan(
        cursor,
        "MATCH",
        `links:tag-selection:${workspaceId}:*`,
        "COUNT",
        1000,
      );
      cursor = next;
      if (keys.length) await durable.unlink(...keys);
    } while (cursor !== "0");
    await unlink(fixturePath);
  }
  cache.disconnect();
  durable.disconnect();
  await mongo.close();
}
