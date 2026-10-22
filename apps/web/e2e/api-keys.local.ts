import { strict as assert } from "node:assert";
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "playwright-core";
import { MongoClient, ObjectId } from "mongodb";
import { z } from "zod";
import { collection } from "@shortn/db";

const credentials = z
  .object({
    email: z.string(),
    password: z.string(),
    workspace: z.string(),
    userId: z.string(),
    workspaceId: z.string(),
    origin: z.string(),
    api: z.string(),
  })
  .parse(JSON.parse(await readFile("/tmp/shortn-p6-login.json", "utf8")));
assert.equal(credentials.origin, "http://localhost:3200");
assert.equal(credentials.api, "http://localhost:3203");
const client = await new MongoClient(
  "mongodb://127.0.0.1:27020/?directConnection=true",
).connect();
const db = client.db("shortn_p6_dev"),
  workspaceId = new ObjectId(credentials.workspaceId);
const browser = await chromium.launch({ headless: true });
const errors: string[] = [];
const captures = "test-results/captures/p6";
await mkdir(captures, { recursive: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", url: credentials.origin },
  ]);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const initialCount = await collection(db, "api_keys").countDocuments({
    workspaceId,
  });
  assert(initialCount >= 60);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const capture = async (name: string) => {
    await page.evaluate(() => {
      document.querySelectorAll("*").forEach((element) => {
        if (element.scrollTop > 0) element.scrollTop = 0;
      });
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: `${captures}/${name}.png`,
      fullPage: true,
      caret: "initial",
    });
  };
  const base = `${credentials.origin}/${credentials.workspace}/settings/api-keys`;
  await page.goto(`${credentials.origin}/login`);
  await page.locator('input[name="identifier"]').fill(credentials.email);
  await page.locator('input[name="password"]').fill(credentials.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 30_000,
  });
  await page.goto(`${credentials.origin}/${credentials.workspace}/settings`);
  await page.getByRole("heading", { name: "General", exact: true }).waitFor();
  await capture("settings-incumbent");
  assert.equal((await page.goto(base))?.status(), 200);
  await page.getByRole("heading", { name: "API keys", exact: true }).waitFor();
  const keyList = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Workspace keys", exact: true }),
  });
  assert.equal(await keyList.locator("ul > li").count(), 25);
  await capture("keys-desktop");
  await page.getByRole("link", { name: "Older keys", exact: true }).click();
  await page.waitForURL("**/api-keys?before=*");
  assert.equal(await keyList.locator("ul > li").count(), 25);
  await page.getByRole("link", { name: "Newest keys", exact: true }).click();
  await page.waitForURL(base);
  await page.getByRole("button", { name: "Create key", exact: true }).click();
  await page.getByRole("button", { name: "Create key", exact: true }).click();
  await page
    .getByText("Enter a name between 1 and 100 characters.", { exact: true })
    .waitFor();
  assert.equal(
    await collection(db, "api_keys").countDocuments({ workspaceId }),
    initialCount,
  );
  const keyName = `Browser key ${Date.now()}`;
  await page.getByLabel("Name", { exact: true }).fill(keyName);
  await page.locator("form").getByRole("alert").waitFor({ state: "hidden" });
  await page.getByLabel("Links: Read", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Create key", exact: true }).click();
  await page
    .getByText("Select at least one permission.", { exact: true })
    .waitFor();
  await page.getByLabel("Links: Read", { exact: true }).check();
  await page.locator("form").getByRole("alert").waitFor({ state: "hidden" });
  await page.getByLabel(/Allowed IP addresses/).fill("invalid");
  await page.getByRole("button", { name: "Create key", exact: true }).click();
  await page
    .getByText("Use valid IPv4/IPv6 addresses or CIDRs, up to 100 entries.", {
      exact: true,
    })
    .waitFor();
  assert.equal(
    await collection(db, "api_keys").countDocuments({ workspaceId }),
    initialCount,
  );
  await page.getByLabel(/Allowed IP addresses/).fill("127.0.0.1, ::1");
  await page
    .getByLabel(/Expiration date/)
    .fill(new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10));
  await capture("create-desktop");
  await page.getByRole("button", { name: "Create key", exact: true }).click();
  const secretInput = page.getByLabel("API key secret", { exact: true });
  await secretInput.waitFor();
  const firstSecret = await secretInput.inputValue();
  assert.match(firstSecret, /^sk_live_[A-Za-z0-9]{24}$/);
  assert.equal(
    await page
      .getByRole("heading", { name: `Key for ${keyName}`, exact: true })
      .evaluate((element) => document.activeElement === element),
    true,
  );
  await page.getByRole("button", { name: "Copy key", exact: true }).click();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    firstSecret,
  );
  const api = (secret: string) =>
    fetch(`${credentials.api}/v1/links`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
  assert.equal((await api(firstSecret)).status, 200);
  assert.equal(
    (
      await fetch(`${credentials.api}/v1/links`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${firstSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: "https://example.com/denied" }),
      })
    ).status,
    403,
  );
  const stored = await collection(db, "api_keys").findOne({
    workspaceId,
    name: keyName,
  });
  assert(stored);
  assert(!JSON.stringify(stored).includes(firstSecret));
  await page
    .getByRole("button", { name: "I’ve saved the key", exact: true })
    .click();
  await secretInput.waitFor({ state: "hidden" });
  await page.reload();
  assert(!(await page.content().then((html) => html.includes(firstSecret))));
  const row = keyList
    .locator("li")
    .filter({ has: page.getByRole("heading", { name: keyName, exact: true }) });
  await row.getByRole("button", { name: "Rotate", exact: true }).click();
  await row.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal((await api(firstSecret)).status, 200);
  await row.getByRole("button", { name: "Rotate", exact: true }).click();
  await row.getByRole("button", { name: "Rotate key", exact: true }).click();
  await secretInput.waitFor();
  const secondSecret = await secretInput.inputValue();
  assert.notEqual(secondSecret, firstSecret);
  assert.equal((await api(firstSecret)).status, 401);
  assert.equal((await api(secondSecret)).status, 200);
  await page
    .getByRole("button", { name: "I’ve saved the key", exact: true })
    .click();
  const activeRow = keyList
    .locator("li")
    .filter({ has: page.getByRole("heading", { name: keyName, exact: true }) })
    .filter({ has: page.getByRole("button", { name: "Revoke", exact: true }) });
  await activeRow.getByRole("button", { name: "Revoke", exact: true }).click();
  await activeRow
    .getByRole("button", { name: "Revoke key", exact: true })
    .click();
  await page.getByRole("status").filter({ hasText: "Key revoked." }).waitFor();
  assert.equal((await api(secondSecret)).status, 401);

  // Narrow layouts and all locales use the same settings structure.
  for (const [locale, title, create] of [
    ["en", "API keys", "Create key"],
    ["pt", "Chaves de API", "Criar chave"],
    ["es", "Claves de API", "Crear clave"],
  ] as const) {
    await context.addCookies([
      { name: "NEXT_LOCALE", value: locale, url: credentials.origin },
    ]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base);
    await page.getByRole("heading", { name: title, exact: true }).waitFor();
    const bounds = await page.evaluate(() => ({
      content: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    assert(
      bounds.content <= bounds.viewport,
      `${locale}: horizontal page overflow`,
    );
    if (locale === "en") await capture("keys-mobile");
    await page.getByRole("button", { name: create, exact: true }).click();
    const fields = await page
      .locator("input:visible, textarea:visible")
      .evaluateAll((elements) =>
        elements.every(
          (element) =>
            element.getBoundingClientRect().right <= window.innerWidth,
        ),
      );
    assert(fields, `${locale}: form overflow`);
    if (locale === "pt") await capture("create-mobile-pt");
  }
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", url: credentials.origin },
  ]);
  await collection(db, "workspaces").updateOne(
    { _id: workspaceId },
    { $set: { platformFeatures: { api: false } } },
  );
  await page.goto(base);
  assert.equal(
    await page.getByRole("button", { name: "Create key", exact: true }).count(),
    0,
  );
  assert(
    await page
      .getByText("API access is not enabled for this workspace yet.", {
        exact: false,
      })
      .isVisible(),
  );
  assert(
    (await page.getByRole("button", { name: "Revoke", exact: true }).count()) >
      0,
  );
  await collection(db, "workspaces").updateOne(
    { _id: workspaceId },
    { $set: { platformFeatures: { api: true } } },
  );
  await collection(db, "workspace_members").updateOne(
    { workspaceId, userId: credentials.userId },
    { $set: { role: "viewer" } },
  );
  await page.goto(base);
  assert(
    await page
      .getByText("Only workspace owners and admins can manage API keys.", {
        exact: true,
      })
      .isVisible(),
  );
  assert.equal(await page.locator("code").count(), 0);
  assert.equal(
    await page.getByRole("button", { name: "Create key", exact: true }).count(),
    0,
  );
  assert.deepEqual(errors, []);
  console.log(
    "P6 API keys: 60-key pagination; validation; one-time secret; copy controls; restricted bearer use; rotate/cancel/revoke; flags/role gates; en/pt/es mobile bounds passed.",
  );
} finally {
  await collection(db, "workspace_members").updateOne(
    { workspaceId, userId: credentials.userId },
    { $set: { role: "owner" } },
  );
  await collection(db, "workspaces").updateOne(
    { _id: workspaceId },
    { $set: { platformFeatures: { api: true } } },
  );
  await browser.close();
  await client.close();
}
