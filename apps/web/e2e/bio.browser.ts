import { strict as assert } from "node:assert";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
const base = new URL(process.env.BIO_BROWSER_ORIGIN ?? "http://localhost:3100");
assert(
  ["localhost", "127.0.0.1"].includes(base.hostname),
  "Bio fixtures require a loopback server",
);
const name = `fixtures-${crypto.randomUUID()}`,
  dir = fileURLToPath(new URL(`../src/app/%255Fbio/${name}/`, import.meta.url));
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
await mkdir(dir, { recursive: true });
try {
  await writeFile(
    `${dir}/page.tsx`,
    'export { default } from "../../../../e2e/fixtures/bio";\n',
  );
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
  });
  const errors: string[] = [];
  await mkdir(".impeccable/review/p5", { recursive: true });
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    await page.route("https://assets.example.test/**", (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#a8b5a2"/></svg>',
      }),
    );
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/favicon.ico", (route) =>
      route.fulfill({ status: 204 }),
    );
    await page.route("https://www.youtube-nocookie.com/**", (route) =>
      route.fulfill({ status: 204 }),
    );
    for (const locale of ["en", "pt", "es"])
      for (const count of [0, 2, 25]) {
        let response = await page.goto(
          `${base.origin}/_bio/${name}?locale=${locale}&count=${count}&theme=${locale === "es" ? "ink" : "paper"}&embed=1`,
        );
        for (let retry = 0; response?.status() === 404 && retry < 4; retry++) {
          await new Promise((resolve) => setTimeout(resolve, 400));
          response = await page.reload();
        }
        assert.equal(response?.status(), 200);
        await page.locator(".bio-page").waitFor();
        assert.equal(await page.locator(".bio-link").count(), count);
        assert.equal(
          await page.locator(".bio-link img").count(),
          Math.ceil(count / 3),
        );
        for (const image of await page.locator(".bio-link img").all()) {
          const box = await image.boundingBox();
          assert(
            box && box.width === 48 && box.height === 48,
            "Thumbnails retain their dimensions",
          );
        }
        assert.equal(
          await page.locator("iframe").count(),
          0,
          "Embeds must wait for consent",
        );
        const geometry = await page.evaluate(() => ({
          viewport: innerWidth,
          width: document.documentElement.scrollWidth,
        }));
        assert(
          geometry.width <= geometry.viewport,
          `Overflow at ${width}/${locale}/${count}`,
        );
        if (count === 25 && locale === "pt") {
          await page.screenshot({
            path: `.impeccable/review/p5/${width === 390 ? "mobile" : "desktop"}.png`,
            fullPage: true,
          });
          await page.keyboard.press("Tab");
          assert.equal(
            await page
              .locator(".bio-link")
              .first()
              .evaluate((el) => el === document.activeElement),
            true,
          );
        }
        await page.getByRole("button", { name: "Load youtube" }).click();
        assert.equal(await page.locator("iframe").count(), 1);
      }
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log(
    "Bio renderer: 18 mobile/desktop/locale/content cases passed; consent and keyboard checks passed.",
  );
} finally {
  await browser?.close();
  await rm(dir, { recursive: true, force: true });
}
