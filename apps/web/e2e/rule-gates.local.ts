import { strict as assert } from "node:assert";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";
import { createApp } from "../../redirect/src/app";

const app = createApp({
  resolver: {
    resolve: async (_domain, key) => ({
      kind: "link",
      id: "0123456789abcdef01234567",
      key,
      dest: "https://example.com",
      status: "ok",
      pwd: false,
      rules:
        key === "scheduled"
          ? { activeFrom: Date.now() + 60000 }
          : key === "limit"
            ? { maxClicks: 0 }
            : { expiresAt: 0 },
    }),
  },
  enqueue: () => {
    throw new Error("A time gate attempted tracking");
  },
  health: async () => true,
  secrets: { legacy: new Uint8Array(32) },
  origin: "https://shortn.at",
  linkDomain: "shortn.at",
});
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch });
const browser = await chromium.launch({ headless: true });
const directory = ".impeccable/review/p6-rule-gates";
await mkdir(directory, { recursive: true });
try {
  for (const locale of ["en", "es", "pt"]) {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    await context.addCookies([
      { name: "NEXT_LOCALE", value: locale, url: server.url.origin },
    ]);
    const page = await context.newPage();
    for (const reason of ["scheduled", "expired", "limit"]) {
      const response = await page.goto(`${server.url.origin}/${reason}`);
      assert.equal(response!.status(), reason === "scheduled" ? 404 : 410);
      assert.equal(await page.locator("html").getAttribute("lang"), locale);
      assert(
        (await page.getByRole("heading", { level: 1 }).innerText()).length > 5,
      );
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.screenshot({
        path: `${directory}/${locale}-${reason}-375.png`,
        fullPage: true,
      });
    }
    await context.close();
  }
  console.log(
    "Scheduled/expired/limit pages passed en/es/pt mobile browser checks",
  );
} finally {
  await browser.close();
  server.stop(true);
}
