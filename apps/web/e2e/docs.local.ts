import { strict as assert } from "node:assert";
import { chromium } from "playwright-core";

const origin = "http://localhost:3200";
for (const path of [
  "/docs",
  "/docs/api",
  "/docs.md",
  "/docs/getting-started.md",
  "/docs/webhooks",
  "/docs/webhooks.md",
  "/docs/mcp.md",
  "/llms.txt",
  "/llms-full.txt",
  "/openapi.json",
  "/robots.txt",
]) {
  const response = await fetch(origin + path);
  assert.equal(response.status, 200, path);
  if (path.endsWith(".md") || path.includes("llms"))
    assert.match(response.headers.get("content-type") ?? "", /text\/markdown/);
}
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin + "/docs");
  await page
    .getByRole("heading", {
      name: "Shortn developer documentation",
      exact: true,
    })
    .waitFor();
  await page
    .getByRole("link", { name: "Getting started", exact: true })
    .click();
  await page
    .getByRole("heading", {
      name: "Getting started with the Shortn API",
      exact: true,
    })
    .waitFor();
  await page.setViewportSize({ width: 375, height: 812 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page
    .getByRole("link", { name: "API reference", exact: true })
    .first()
    .click();
  await page
    .getByRole("heading", { name: "Shortn API", exact: true })
    .waitFor({ timeout: 60000 });
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    "Public docs, markdown routes, mobile guide and Scalar reference passed",
  );
} finally {
  await browser.close();
}
