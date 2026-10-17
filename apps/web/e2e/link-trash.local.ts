import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright-core";
import { MongoClient, ObjectId } from "mongodb";
import { z } from "zod";
import { collection } from "@shortn/db";

const login = z
  .object({
    email: z.string(),
    password: z.string(),
    workspace: z.string(),
    workspaceId: z.string(),
    userId: z.string(),
    origin: z.string(),
  })
  .parse(JSON.parse(await readFile("/tmp/shortn-p6-login.json", "utf8")));
assert.equal(login.origin, "http://localhost:3200");
const client = await new MongoClient(
  "mongodb://127.0.0.1:27020/?directConnection=true",
).connect();
const db = client.db("shortn_p6_dev"),
  workspaceId = new ObjectId(login.workspaceId);
const prefix = "p6-trash-browser-";
const fixtures = { workspaceId, key: { $regex: `^${prefix}` } };
await collection(db, "links").deleteMany(fixtures);
const now = new Date();
const tagId = new ObjectId();
await collection(db, "tags").insertOne({
  _id: tagId,
  workspaceId,
  tagName: "Trash fixture",
  color: "#123456",
});
await collection(db, "links").insertMany(
  Array.from({ length: 1001 }, (_, index) => ({
    _id: new ObjectId(),
    workspaceId,
    createdBy: login.userId,
    domain: "shortn.at",
    key: `${prefix}${index}`,
    urlCode: `${prefix}${index}`,
    longUrl: "https://example.com/trash",
    title:
      index === 1000
        ? "Long deleted title ".repeat(30)
        : `Trash fixture ${index}`,
    tags: [{ _id: tagId, tagName: "Trash fixture" }],
    createdAt: new Date(now.getTime() - index * 1000),
    updatedAt: now,
    deletedAt: now,
    isQrCode: false,
    clicks: { total: index, lastClick: null },
  })),
);
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", url: login.origin },
  ]);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${login.origin}/login`);
  await page.locator('input[name="identifier"]').fill(login.email);
  await page.locator('input[name="password"]').fill(login.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  const base = `${login.origin}/${login.workspace}/links`;
  await page.goto(`${base}?trash=1`);
  await page.getByRole("heading", { name: "Trash", exact: true }).waitFor();
  assert.equal(await page.locator('input[name="ids"]').count(), 25);
  assert.equal(await page.locator("tbody tr").count(), 25);
  const first = await page.locator('input[name="ids"]').first().inputValue();
  await page.locator('input[name="ids"]').first().check();
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await page.waitForURL((url) => url.searchParams.get("page") === "2");
  const second = await page.locator('input[name="ids"]').first().inputValue();
  assert.notEqual(first, second);
  await page.locator('input[name="ids"]').first().check();
  await page.getByRole("status").filter({ hasText: "2 selected" }).waitFor();
  await page
    .getByRole("searchbox", { name: "Search", exact: true })
    .fill("does-not-exist");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.getByText("No links match these filters.").waitFor();
  assert.equal(new URL(page.url()).searchParams.get("trash"), "1");
  await page.getByRole("status").filter({ hasText: "2 selected" }).waitFor();
  await page.getByRole("link", { name: "Clear all", exact: true }).click();
  await page.waitForURL(
    (url) =>
      url.searchParams.get("trash") === "1" && !url.searchParams.has("q"),
  );
  assert.equal(await page.locator('input[name="ids"]').count(), 25);
  // A full reload exercises storage as well as client navigation.
  await page.goto(`${base}?trash=1&tag=Trash+fixture&group=tag`);
  await page.getByRole("status").filter({ hasText: "2 selected" }).waitFor();
  await page
    .getByRole("columnheader", { name: "Trash fixture", exact: true })
    .waitFor();
  await page.screenshot({
    path: ".impeccable/review/p6/trash-desktop.png",
    fullPage: true,
    caret: "initial",
  });
  await page
    .getByRole("button", { name: "Restore selected", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "2 links restored." })
    .waitFor();
  assert.equal(
    await collection(db, "links").countDocuments({
      _id: { $in: [new ObjectId(first), new ObjectId(second)] },
      deletedAt: { $exists: false },
    }),
    2,
  );
  await page.reload();
  await page.getByRole("status").filter({ hasText: "0 selected" }).waitFor();
  for (const [locale, title] of [
    ["en", "Trash"],
    ["pt", "Lixo"],
    ["es", "Papelera"],
  ]) {
    await context.addCookies([
      { name: "NEXT_LOCALE", value: locale!, url: login.origin },
    ]);
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.goto(`${base}?trash=1&sort=oldest&tag=Trash+fixture&group=tag`);
    await page.getByRole("heading", { name: title!, exact: true }).waitFor();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.equal(await page.locator('input[name="ids"]').count(), 25);
    await page.screenshot({
      path: `.impeccable/review/p6/trash-mobile-${locale}.png`,
      fullPage: true,
      caret: "initial",
    });
  }
  assert.deepEqual(errors, []);
  console.log(
    "Trash browser flows passed with 1,001 links, pagination, cross-filter selection, restore, grouping and three locales.",
  );
} finally {
  await browser.close();
  await collection(db, "links").deleteMany(fixtures);
  await collection(db, "tags").deleteOne({ _id: tagId });
  await client.close();
}
