import { strict as assert } from "node:assert";
import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";
import { MongoClient, ObjectId } from "mongodb";
import { physicalNames } from "@shortn/db";
const c = JSON.parse(await readFile("/tmp/shortn-p6-login.json", "utf8")) as {
  origin: string;
  email: string;
  password: string;
  workspace: string;
  workspaceId: string;
};
assert.equal(c.origin, "http://localhost:3200");
const client = await new MongoClient(
  "mongodb://127.0.0.1:27020/?directConnection=true",
).connect();
const db = client.db("shortn_p6_dev"),
  workspaceId = new ObjectId(c.workspaceId),
  fixture = `Browser hook ${crypto.randomUUID().slice(0, 8)}`;
const ids = Array.from({ length: 1001 }, () => new ObjectId());
await db.collection(physicalNames.webhook_endpoints).insertMany(
  ids.map((_id, i) => ({
    _id,
    workspaceId,
    name: `${fixture} ${String(i).padStart(4, "0")}${i === 1000 ? " — " + "A long label ".repeat(5) : ""}`,
    url: `https://receiver.example/${"long-segment/".repeat(i === 1000 ? 30 : 1)}${i}`,
    events: ["link.created", "link.clicked"],
    enabled: true,
    secret: "synthetic-not-used-by-a-sender",
    createdBy: "fixture",
    createdAt: new Date(),
    updatedAt: new Date(),
  })),
);
const browser = await chromium.launch({ headless: true });
const captures = "test-results/captures/webhooks";
await mkdir(captures, { recursive: true });
const errors: string[] = [];
const createdIds: ObjectId[] = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", url: c.origin },
  ]);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  async function capture(name: string) {
    await page.evaluate(async () => {
      await document.fonts.ready;
      document.querySelectorAll("*").forEach((element) => {
        if (element.scrollTop) element.scrollTop = 0;
      });
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(250);
    await page.screenshot({
      path: `${captures}/${name}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }

  await page.goto(`${c.origin}/login`);
  await page.locator('input[name="identifier"]').fill(c.email);
  await page.locator('input[name="password"]').fill(c.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  const base = `${c.origin}/${c.workspace}/settings/webhooks`;
  await page.goto(`${base}?search=${encodeURIComponent(fixture)}`);
  await page.getByRole("heading", { name: "Endpoints", exact: true }).waitFor();
  assert.equal(await page.locator("section ul > li").count(), 25);
  await page.screenshot({ path: `${captures}/desktop.png`, fullPage: true });
  await page.getByRole("link", { name: "Older results", exact: true }).click();
  assert.equal(await page.locator("section ul > li").count(), 25);
  await page.getByRole("link", { name: "First page", exact: true }).click();
  await page
    .getByRole("button", { name: "Create endpoint", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  console.log("Checking create focus");
  await page
    .waitForFunction(
      () => document.activeElement?.textContent?.trim() === "Create endpoint",
      undefined,
      { timeout: 5000 },
    )
    .catch(async (error) => {
      console.log(
        await page.evaluate(() => ({
          active: document.activeElement?.tagName,
          id: document.activeElement?.id,
          label:
            document.activeElement?.tagName === "BUTTON"
              ? document.activeElement.textContent?.trim()
              : "",
          ids: Array.from(document.querySelectorAll("button[id]"))
            .slice(0, 3)
            .map((el) => el.id),
        })),
      );
      throw error;
    });
  await page
    .getByRole("button", { name: "Create endpoint", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill(`${fixture} created`);
  await page
    .getByLabel("Receiver URL", { exact: true })
    .fill("https://receiver.example/new");
  await capture("form");
  await page
    .getByRole("button", { name: "Save endpoint", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Save your signing secret", exact: true })
    .waitFor();
  const secret = await page
    .locator("code")
    .filter({ hasText: "whsec_" })
    .innerText();
  assert(secret.startsWith("whsec_"));
  await page.getByRole("button", { name: "Copy secret", exact: true }).click();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    secret,
  );
  await page
    .getByRole("button", { name: "I saved the secret", exact: true })
    .click();
  console.log("Checking create focus");
  await page
    .waitForFunction(
      () => document.activeElement?.textContent?.trim() === "Create endpoint",
      undefined,
      { timeout: 5000 },
    )
    .catch(async (error) => {
      console.log(
        await page.evaluate(() => ({
          active: document.activeElement?.tagName,
          id: document.activeElement?.id,
          label:
            document.activeElement?.tagName === "BUTTON"
              ? document.activeElement.textContent?.trim()
              : "",
          ids: Array.from(document.querySelectorAll("button[id]"))
            .slice(0, 3)
            .map((el) => el.id),
        })),
      );
      throw error;
    });
  await page.reload();
  assert.equal(await page.getByText(secret, { exact: true }).count(), 0);
  const row = page.locator("section ul > li").filter({
    has: page.getByRole("heading", {
      name: `${fixture} created`,
      exact: true,
    }),
  });
  await row.getByRole("button", { name: "Edit endpoint", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill(`${fixture} edited`);
  await page
    .getByRole("button", { name: "Save endpoint", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Endpoint saved." })
    .waitFor();
  console.log("Checking edit focus");
  await page
    .waitForFunction(
      () => document.activeElement?.textContent?.trim() === "Edit endpoint",
      undefined,
      { timeout: 5000 },
    )
    .catch(async (error) => {
      console.log(
        await page.evaluate(() => ({
          active: document.activeElement?.tagName,
          id: document.activeElement?.id,
          label:
            document.activeElement?.tagName === "BUTTON"
              ? document.activeElement.textContent?.trim()
              : "",
          ids: Array.from(document.querySelectorAll("button[id]"))
            .slice(0, 3)
            .map((el) => el.id),
        })),
      );
      throw error;
    });
  const edited = page.locator("section ul > li").filter({
    has: page.getByRole("heading", {
      name: `${fixture} edited`,
      exact: true,
    }),
  });
  await edited.getByRole("button", { name: "Send test", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Delivery queued." })
    .waitFor();
  const made = await db
    .collection(physicalNames.webhook_endpoints)
    .findOne({ workspaceId, name: `${fixture} edited` });
  assert(made);
  createdIds.push(made._id);
  const now = new Date();
  await db.collection(physicalNames.webhook_deliveries).insertMany(
    Array.from({ length: 35 }, (_, i) => ({
      workspaceId,
      webhookId: made._id,
      event: {
        id: crypto.randomUUID(),
        type: "link.created",
        createdAt: now.toISOString(),
        workspaceId: String(workspaceId),
        data: {},
      },
      status: i % 2 ? "failed" : "delivered",
      attempts: 2,
      createdAt: now,
      nextAttemptAt: now,
      retryUntil: new Date(now.getTime() + 86400000),
      expiresAt: new Date(now.getTime() + 30 * 86400000),
      lastStatus: i % 2 ? 503 : 204,
      ...(i % 2 ? { lastError: "http_status" } : { deliveredAt: now }),
    })),
  );
  await edited.getByRole("link", { name: "Delivery log", exact: true }).click();
  await page
    .getByRole("heading", { name: "Delivery log", exact: true })
    .waitFor();
  assert.equal(await page.locator("section ul > li").count(), 25);
  await capture("deliveries");
  const firstEvent = await page
    .locator("section ul > li")
    .first()
    .locator("code")
    .innerText();
  await page
    .getByRole("button", { name: "Redeliver", exact: true })
    .first()
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Delivery queued." })
    .waitFor();
  assert.equal(
    await db
      .collection(physicalNames.webhook_deliveries)
      .countDocuments({ webhookId: made._id, "event.id": firstEvent }),
    2,
  );
  await page.getByRole("link", { name: "Older results", exact: true }).click();
  assert((await page.locator("section ul > li").count()) <= 25);
  await page.goto(`${base}?search=${encodeURIComponent(fixture)}`);
  const current = page.locator("section ul > li").filter({
    has: page.getByRole("heading", {
      name: `${fixture} edited`,
      exact: true,
    }),
  });
  await page.setViewportSize({ width: 375, height: 900 });
  const longRow = page.locator("section ul > li").first();
  const longId = made._id;
  await db
    .collection(physicalNames.webhook_endpoints)
    .updateOne(
      { _id: longId },
      { $set: { name: `${fixture} ${"X".repeat(100 - fixture.length - 1)}` } },
    );
  await page.reload();
  await longRow
    .getByRole("button", { name: "Delete endpoint", exact: true })
    .click();
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await capture("confirmation-mobile");
  await longRow.getByRole("button", { name: "Cancel", exact: true }).click();
  assert(
    await longRow
      .getByRole("button", { name: "Delete endpoint", exact: true })
      .evaluate((el) => document.activeElement === el),
  );
  await db
    .collection(physicalNames.webhook_endpoints)
    .updateOne({ _id: longId }, { $set: { name: `${fixture} edited` } });
  await page.reload();
  await current.getByRole("button", { name: "Pause", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Endpoint saved." })
    .waitFor();
  assert(
    await current
      .getByRole("button", { name: "Send test", exact: true })
      .isDisabled(),
  );
  for (const [locale, label] of [
    ["pt", "Destinos"],
    ["es", "Destinos"],
  ] as const) {
    await context.addCookies([
      { name: "NEXT_LOCALE", value: locale, url: c.origin },
    ]);
    await page.reload();
    await page.getByRole("heading", { name: label, exact: true }).waitFor();
    await page.setViewportSize({ width: 375, height: 900 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await capture(`mobile-${locale}`);
  }
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", url: c.origin },
  ]);
  await page.reload();
  await current
    .getByRole("button", { name: "Delete endpoint", exact: true })
    .click();
  await current
    .getByRole("button", { name: "Delete endpoint", exact: true })
    .last()
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Endpoint deleted." })
    .waitFor();
  console.log("Checking create focus");
  await page
    .waitForFunction(
      () => document.activeElement?.textContent?.trim() === "Create endpoint",
      undefined,
      { timeout: 5000 },
    )
    .catch(async (error) => {
      console.log(
        await page.evaluate(() => ({
          active: document.activeElement?.tagName,
          id: document.activeElement?.id,
          label:
            document.activeElement?.tagName === "BUTTON"
              ? document.activeElement.textContent?.trim()
              : "",
          ids: Array.from(document.querySelectorAll("button[id]"))
            .slice(0, 3)
            .map((el) => el.id),
        })),
      );
      throw error;
    });
  assert.equal(
    await db
      .collection(physicalNames.webhook_endpoints)
      .countDocuments({ _id: made._id }),
    0,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Webhook browser checks passed: 1,001 endpoints; CRUD/secret/test/log pagination/redelivery; pt/es mobile bounds.",
  );
} finally {
  const hooks = await db
    .collection(physicalNames.webhook_endpoints)
    .find(
      { workspaceId, name: { $regex: `^${fixture}` } },
      { projection: { _id: 1 } },
    )
    .toArray();
  const all = [...ids, ...createdIds, ...hooks.map((h) => h._id)];
  await db
    .collection(physicalNames.webhook_endpoints)
    .deleteMany({ _id: { $in: all } });
  await db
    .collection(physicalNames.webhook_deliveries)
    .deleteMany({ workspaceId, webhookId: { $in: all } });
  await browser.close();
  await client.close();
}
