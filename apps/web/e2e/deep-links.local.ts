import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";
import { createApp } from "../../redirect/src/app";
const ua =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
let clicks = 0;
const app = createApp({
  resolver: {
    resolve: async (_domain, key) => ({
      kind: "link",
      id: "0123456789abcdef01234567",
      key,
      dest: "https://example.com/web",
      status: "ok",
      pwd: false,
      rules: {
        deepLink: {
          ios: "youtube://watch?v=123",
          android: "spotify:track:abc",
          fallback: key.endsWith("store") ? "store" : "web",
          store: {
            ios: "https://apps.apple.com/app/id123",
            android: "https://play.google.com/store/apps/details?id=example",
          },
        },
      },
    }),
  },
  enqueue: () => {
    clicks++;
  },
  health: async () => true,
  secrets: { legacy: new Uint8Array(32) },
  origin: "https://shortn.at",
  linkDomain: "shortn.at",
});
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch });
const browser = await chromium.launch({ headless: true });
const directory = "test-results/captures/p6-deep-links";
await mkdir(directory, { recursive: true });
const captures: object[] = [];
try {
  for (const locale of ["en", "es", "pt"])
    for (const colorScheme of ["light", "dark"] as const)
      for (const viewport of [
        { width: 375, height: 812 },
        { width: 1280, height: 900 },
      ]) {
        const context = await browser.newContext({
          viewport,
          colorScheme,
          userAgent: ua,
        });
        await context.addCookies([
          { name: "NEXT_LOCALE", value: locale, url: server.url.origin },
        ]);
        const page = await context.newPage();
        await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
        await page.clock.pauseAt(new Date("2026-01-01T01:00:00Z"));
        for (const fallback of ["web", "store"]) {
          const response = await page.goto(
            `${server.url.origin}/deeplink-${fallback}`,
            { waitUntil: "commit" },
          );
          assert.equal(response!.status(), 200);
          await page.evaluate(() => document.fonts.ready);
          assert.equal(await page.locator("html").getAttribute("lang"), locale);
          assert.equal(
            await page.locator("#open-app").getAttribute("href"),
            "youtube://watch?v=123",
          );
          assert.equal(
            await page.locator("#fallback").getAttribute("href"),
            fallback === "web"
              ? "https://example.com/web"
              : "https://apps.apple.com/app/id123",
          );
          const metrics = await page.evaluate(() => ({
            overflow: document.documentElement.scrollWidth > innerWidth,
            font: getComputedStyle(document.querySelector("h1")!).fontFamily,
            controls: [...document.querySelectorAll("nav a")].map((a) => ({
              width: a.getBoundingClientRect().width,
              height: a.getBoundingClientRect().height,
            })),
            body: getComputedStyle(document.body).backgroundColor,
          }));
          assert.equal(metrics.overflow, false);
          assert(metrics.font.includes("Geist"));
          assert(
            metrics.controls.every(
              (control) =>
                control.height >= 44 && control.width <= viewport.width,
            ),
          );
          await page.keyboard.press("Tab");
          assert.equal(
            await page
              .locator("#open-app")
              .evaluate((el) => el === document.activeElement),
            true,
          );
          const path = `${directory}/${locale}-${fallback}-${colorScheme}-${viewport.width}.png`;
          await page.screenshot({ path, fullPage: true });
          captures.push({
            path,
            locale,
            fallback,
            colorScheme,
            viewport,
            metrics,
          });
        }
        await context.close();
      }
  await writeFile(
    `${directory}/captures.json`,
    JSON.stringify(captures, null, 2),
  );
  const context = await browser.newContext({ userAgent: ua });
  await context.route("https://example.com/**", (route) =>
    route.fulfill({ body: "Web fallback", contentType: "text/html" }),
  );
  const page = await context.newPage();
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T01:00:00Z"));
  let before = clicks;
  await page.goto(`${server.url.origin}/deeplink-web`, { waitUntil: "commit" });
  await page.locator("#fallback").waitFor();
  await page.clock.runFor(1000);
  assert.equal(new URL(page.url()).hostname, "127.0.0.1");
  await page.clock.runFor(1000);
  await page.waitForURL("https://example.com/web");
  assert.equal(clicks - before, 1);
  before = clicks;
  await page.goto(`${server.url.origin}/deeplink-web`, { waitUntil: "commit" });
  await page.locator("#fallback").waitFor();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(3000);
  assert.equal(new URL(page.url()).hostname, "127.0.0.1");
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      get: () => "visible",
    });
    Object.defineProperty(document, "hidden", { get: () => false });
  });
  await page.locator("#open-app").click();
  await page.clock.runFor(2000);
  await page.waitForURL("https://example.com/web");
  assert.equal(clicks - before, 1);
  await context.close();
  const nojs = await browser.newContext({
    userAgent: ua,
    javaScriptEnabled: false,
  });
  await nojs.route("https://example.com/**", (route) =>
    route.fulfill({ body: "Web fallback", contentType: "text/html" }),
  );
  const manual = await nojs.newPage();
  before = clicks;
  await manual.goto(`${server.url.origin}/deeplink-web`);
  await manual.locator("#fallback").click();
  await manual.waitForURL("https://example.com/web");
  assert.equal(clicks - before, 1);
  await nojs.close();
  await writeFile(
    `${directory}/captures.json`,
    JSON.stringify(captures, null, 2),
  );
  console.log(
    "24 localized/theme/viewport captures passed; fallback, hidden-page cancellation, manual retry and single-click attribution passed",
  );
} finally {
  await browser.close();
  server.stop(true);
}
