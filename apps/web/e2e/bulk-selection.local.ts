import { strict as assert } from "node:assert";
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "playwright-core";
import { MongoClient, ObjectId } from "mongodb";
import { Redis } from "ioredis";
import { z } from "zod";
import { collection, physicalNames } from "@shortn/db";
import { createLink, createQr, type ServiceContext } from "@shortn/core";
import { checkBulkSelection } from "./selection.browser-flows";
import { decodeSelection } from "../src/lib/bulk-selection";
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
  ).connect(),
  db = client.db("shortn_p6_dev"),
  cache = new Redis("redis://127.0.0.1:16380/6");
const workspace = (await collection(db, "workspaces").findOne({
  _id: new ObjectId(login.workspaceId),
}))!;
const ctx: ServiceContext = {
  db,
  cache,
  workspace,
  actor: { userId: login.userId, role: "owner" },
  linkDomain: "shortn.invalid",
};
const linkIds: ObjectId[] = [];
const qrIds: ObjectId[] = [],
  publicIds: string[] = [];
const directory = ".impeccable/review/p6-health-ui";
await mkdir(directory, { recursive: true });
const subscriptionId = new ObjectId();
await db.collection(physicalNames.subscriptions).insertOne({
  _id: subscriptionId,
  workspaceId: workspace._id,
  polarSubscriptionId: `bulk-ui-${crypto.randomUUID()}`,
  status: "active",
  plan: "pro",
  currentPeriodStart: new Date(Date.now() - 86400000),
  currentPeriodEnd: new Date(Date.now() + 29 * 86400000),
  cancelAtPeriodEnd: false,
});
const browser = await chromium.launch({ headless: true });
try {
  for (let n = 0; n < 3; n++) {
    const result = await createLink(ctx, {
      url: `https://example.com/bulk-link/${n}`,
      title: `Bulk selection link fixture ${n}`,
    });
    if (!result.ok) throw new Error(result.error);
    linkIds.push(new ObjectId(result.value.id));
  }
  for (let n = 0; n < 30; n++) {
    const result = await createQr(ctx, {
      url: `https://example.com/bulk-qr/${n}`,
      title: `Bulk selection fixture ${n}`,
      tags: ["Bulk selection fixture"],
    });
    if (!result.ok) throw new Error(result.error);
    qrIds.push(new ObjectId(result.value.id));
    publicIds.push(result.value.publicId);
  }
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", url: login.origin },
  ]);
  await page.goto(`${login.origin}/login`);
  await page.locator('input[name="identifier"]').fill(login.email);
  await page.locator('input[name="password"]').fill(login.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await checkBulkSelection({
    page,
    go: (path) => page.goto(`${login.origin}/${login.workspace}${path}`),
    captureDir: directory,
  });
  await page.goto(
    `${login.origin}/${login.workspace}/qr?view=list&tag=Bulk+selection+fixture`,
  );
  await page.locator('input[name="ids"]').first().check();
  const firstId = await page.locator('input[name="ids"]').first().inputValue();
  await page
    .getByRole("status")
    .filter({ hasText: /^1 selected$/ })
    .waitFor();
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await page.waitForURL((url) => url.searchParams.get("page") === "2");
  await page.waitForFunction(
    (id) =>
      document.querySelector<HTMLInputElement>('input[name="ids"]')?.value !==
      id,
    firstId,
  );
  await page.locator('input[name="ids"]').first().check();
  await page
    .getByRole("status")
    .filter({ hasText: /^2 selected$/ })
    .waitFor();
  await page
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (this === sessionStorage && key.startsWith("shortn:bulk-selection:"))
        throw new DOMException(
          "Synthetic write rejection",
          "QuotaExceededError",
        );
      return original.call(this, key, value);
    };
  });
  const fallbackId = await page
    .locator('input[name="ids"]')
    .first()
    .inputValue();
  await page.locator('input[name="ids"]').first().check();
  await page
    .getByRole("status")
    .filter({ hasText: /^1 selected$/ })
    .waitFor();
  await page
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: /^0 selected$/ })
    .waitFor();
  assert.equal(
    await page.locator('input[name="ids"]').first().isChecked(),
    false,
  );
  await page.locator('input[name="ids"]').first().check();
  await page
    .getByRole("status")
    .filter({ hasText: /^1 selected$/ })
    .waitFor();
  await page
    .getByRole("button", { name: "Delete selected", exact: true })
    .click();
  await page.waitForURL((url) => url.pathname.endsWith("/qr/delete"));
  assert.deepEqual(
    decodeSelection(new URL(page.url()).searchParams.get("selection")),
    [fallbackId],
  );
  assert.deepEqual(errors, []);
  console.log(
    "Shared Links/QR bulk selector passed counts, mixed state, clear, compact review/cancel, cross-filter, QR cross-page persistence and readable-storage/write-failure fallback",
  );
  await context.close();
} finally {
  await browser.close();
  await collection(db, "links").deleteMany({ _id: { $in: linkIds } });
  await collection(db, "qr_codes").deleteMany({ _id: { $in: qrIds } });
  await collection(db, "links").deleteMany({
    workspaceId: workspace._id,
    qrCodeId: { $in: publicIds },
  });
  await collection(db, "tags").deleteMany({
    workspaceId: workspace._id,
    tagName: "Bulk selection fixture",
  });
  await db
    .collection(physicalNames.subscriptions)
    .deleteOne({ _id: subscriptionId });
  cache.disconnect();
  await client.close();
}
