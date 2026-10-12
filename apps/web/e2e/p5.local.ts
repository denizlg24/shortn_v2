import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";
import { chromium } from "playwright-core";
const credentials = JSON.parse(
  await readFile("/tmp/shortn-p5-login.json", "utf8"),
) as {
  email: string;
  password: string;
  dashboard: string;
  editor: string;
  bio: string;
};
assert(new URL(credentials.editor).hostname === "localhost");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:3100/login");
  await page.locator('input[name="identifier"]').fill(credentials.email);
  await page.locator('input[name="password"]').fill(credentials.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 30000,
  });
  const dashboard = await page.goto(credentials.dashboard);
  assert.equal(dashboard?.status(), 200);
  const editor = await page.goto(credentials.editor);
  assert.equal(editor?.status(), 200);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Published" })
    .waitFor({ timeout: 30000 });
  const publicPage = await browser.newPage();
  assert.equal((await publicPage.goto(credentials.bio))?.status(), 200);
  assert.equal(await publicPage.locator(".bio-link").count(), 4);
  assert.equal(await publicPage.locator(".bio-qr img").count(), 1);
  assert.equal(await publicPage.locator("iframe").count(), 0);
  const href = await publicPage
    .locator(".bio-link")
    .first()
    .getAttribute("href");
  assert(href?.startsWith("http://localhost:3102/"));
  const redirect = await fetch(href!, { redirect: "manual" });
  assert.equal(redirect.status, 302);
  assert.equal(
    redirect.headers.get("location"),
    "https://example.com/portfolio",
  );
  assert.deepEqual(errors, []);
  console.log(
    "P5 sandbox: login, dashboard, editor, publish, public bio, QR, consent and local redirect passed.",
  );
} finally {
  await browser.close();
}
