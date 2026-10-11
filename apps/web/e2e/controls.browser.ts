import { strict as assert } from "node:assert";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

// Run against a local `bun run dev`; the fixture is never deployed or retained.
const base = new URL(process.env.CONTROLS_BASE_URL ?? "http://localhost:3000");
assert(
  ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname),
  "Controls checks require a local Next dev server.",
);
const route = `p4-controls-${crypto.randomUUID()}`;
const routeDir = fileURLToPath(
  new URL(`../src/app/${route}/`, import.meta.url),
);
const captureDir = process.env.CONTROLS_SCREENSHOT_DIR;
await mkdir(routeDir);
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  await writeFile(
    `${routeDir}/page.tsx`,
    'export { default } from "../../../e2e/fixtures/controls";\n',
  );
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
  });
  const errors: string[] = [];
  for (const locale of ["en", "pt", "es"]) {
    const context = await browser.newContext({
      locale,
      permissions: ["clipboard-read", "clipboard-write"],
      viewport: { width: 1440, height: 1000 },
    });
    await context.addCookies([
      { name: "NEXT_LOCALE", value: locale, url: base.origin },
    ]);
    // The temporary fixture has no favicon; keep its request out of UI errors.
    await context.route("**/favicon.ico", (route) =>
      route.fulfill({ status: 204 }),
    );
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(30000);
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error")
        errors.push(`${message.text()} (${message.location().url})`);
    });
    const url = new URL(route, base.origin);
    await page.goto(url.href);
    await page.locator('html[data-controls-ready="true"]').waitFor();
    const country = page
      .getByRole("region", { name: "Choice filters" })
      .getByRole("combobox");
    await page.goto(`${url.href}?country=unknown&country=unknown`);
    await country.click();
    assert.equal(
      await page.getByRole("listbox").getByRole("option").count(),
      4,
    );
    assert.equal(await page.locator('input[name="country"]').count(), 1);
    await page
      .getByRole("option", { name: "Any country", exact: true })
      .click();
    await page.waitForURL((value) => !value.searchParams.has("country"));
    for (let cycle = 0; cycle < 3; cycle++) {
      await country.click();
      assert.equal(
        await page.getByRole("listbox").getByRole("option").count(),
        3,
      );
      await page.getByRole("option", { name: "Denmark", exact: true }).click();
      await page.waitForURL(
        (value) => value.searchParams.get("country") === "dk",
      );
      await country.click();
      await page
        .getByRole("option", { name: "Any country", exact: true })
        .click();
      await page.waitForURL((value) => !value.searchParams.has("country"));
      assert.equal(await country.textContent(), "Any country");
      assert.equal(await page.locator('input[name="country"]').count(), 0);
      await country.click();
      assert.deepEqual(
        await page.getByRole("listbox").getByRole("option").allTextContents(),
        ["Any country", "Denmark", "Portugal"],
      );
      await page.keyboard.press("Escape");
    }
    const links = page.getByRole("region", { name: "Links filters" });
    const qr = page.getByRole("region", { name: "QR filters" });
    const tagForm = page.getByRole("form", { name: "Tags form" });
    if (locale === "en") {
      await tagForm.getByRole("combobox").click();
      await page.getByPlaceholder("Find or create a tag…").fill("Newsletter");
      await page
        .getByRole("option", { name: "Newsletter", exact: true })
        .click();
      await page.getByPlaceholder("Find or create a tag…").fill("Nova edição");
      await page.getByRole("option", { name: "Create “Nova edição”" }).click();
      await page.keyboard.press("Escape");
      await tagForm
        .getByRole("button", { name: "Remove Editorial", exact: true })
        .click();
      await tagForm.getByRole("button", { name: "Submit tags" }).click();
      assert.equal(
        await page.getByTestId("posted-tags").textContent(),
        '["Newsletter","Nova edição"]',
      );
      await links.getByRole("combobox").first().click();
      await page.getByPlaceholder("Search options…").fill("Print");
      await page.getByRole("option", { name: "Print", exact: true }).click();
      await page.waitForURL(
        (value) => value.searchParams.get("tag") === "Print",
      );
      await page.getByPlaceholder("Search options…").fill("Newsletter");
      await page
        .getByRole("option", { name: "Newsletter", exact: true })
        .click();
      await page.waitForURL(
        (value) => value.searchParams.getAll("tag").length === 2,
      );
      await page.keyboard.press("Escape");
      await links.getByLabel("Period", { exact: true }).selectOption("custom");
      await page.waitForURL(
        (value) => value.searchParams.get("created") === "custom",
      );
      assert(new URL(page.url()).searchParams.has("from"));
      await links.getByLabel("From (UTC)", { exact: true }).fill("2026-09-01");
      await links.getByLabel("To (UTC)", { exact: true }).fill("2026-09-30");
      await links.getByRole("button", { name: "Apply", exact: true }).click();
      await page.waitForURL(
        (value) =>
          value.searchParams.get("from") === "2026-09-01" &&
          value.searchParams.get("to") === "2026-09-30",
      );
      assert.deepEqual(new URL(page.url()).searchParams.getAll("tag"), [
        "Print",
        "Newsletter",
      ]);
      await links.getByLabel("Period", { exact: true }).selectOption("7");
      await page.waitForURL(
        (value) => value.searchParams.get("created") === "7",
      );
      assert(!new URL(page.url()).searchParams.has("from"));
      await links.getByRole("link", { name: "Clear all" }).click();
      await page.waitForURL((value) => !value.search);
      await qr.getByLabel("Period", { exact: true }).selectOption("custom");
      await page.waitForURL(
        (value) => value.searchParams.get("created") === "custom",
      );
      await qr.getByLabel("From (UTC)", { exact: true }).fill("2026-09-01");
      await qr.getByRole("button", { name: "Apply", exact: true }).click();
      await page.waitForURL(
        (value) => value.searchParams.get("from") === "2026-09-01",
      );
      // Exercise the clipboard fallback even when installed Chrome has Web Share.
      await page.evaluate(() =>
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: undefined,
        }),
      );
      await page.getByRole("button", { name: "Share", exact: true }).click();
      await page
        .getByRole("status")
        .filter({ hasText: "Link copied." })
        .waitFor();
      assert.equal(
        await page.evaluate(() => navigator.clipboard.readText()),
        "https://shortn.at/p4-browser-check",
      );
      let shared: { url?: string } | undefined;
      await page.exposeFunction("captureShare", (data: { url?: string }) => {
        shared = data;
      });
      await page.evaluate(() =>
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: (data: ShareData) =>
            (
              window as unknown as {
                captureShare: (data: ShareData) => Promise<void>;
              }
            ).captureShare(data),
        }),
      );
      await page.getByRole("button", { name: "Share", exact: true }).click();
      await page.waitForFunction(
        () => !document.querySelector("button[disabled]"),
      );
      assert.equal(shared?.url, "https://shortn.at/p4-browser-check");
      await page.evaluate(() =>
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: () =>
            Promise.reject(new DOMException("Dismissed", "AbortError")),
        }),
      );
      await page.getByRole("button", { name: "Share", exact: true }).click();
      await page.waitForFunction(
        () => !document.querySelector("button[disabled]"),
      );
      assert.equal(await page.getByRole("status").last().textContent(), "");
    }
    const confirmation = page.getByRole("region", { name: "UTM confirmation" });
    const translated = {
      en: {
        confirm: "Remove variant",
        error: "The variants have changed",
        cancel: "Cancel",
      },
      pt: {
        confirm: "Remover variante",
        error: "As variantes foram alteradas",
        cancel: "Cancelar",
      },
      es: {
        confirm: "Eliminar variante",
        error: "Las variantes han cambiado",
        cancel: "Cancelar",
      },
    }[locale]!;
    const edit = page.getByRole("region", { name: "UTM edit" });
    const source = edit.locator('input[name="source"]');
    if (locale === "en") {
      await edit
        .getByRole("combobox", { name: "Suggestions for Source", exact: true })
        .click();
      await page
        .locator('[data-state="open"] input[placeholder="Search suggestions…"]')
        .fill("par");
      await page.getByRole("option", { name: "partner", exact: true }).click();
      assert.equal(await source.inputValue(), "partner");
      await source.fill("my-custom-source");
      await edit
        .getByRole("combobox", {
          name: "Suggestions for Campaign",
          exact: true,
        })
        .click();
      await page.getByRole("option", { name: "Winter", exact: true }).click();
      assert.equal(await source.inputValue(), "my-custom-source");
      await edit
        .getByRole("combobox", { name: "Suggestions for Source", exact: true })
        .click();
      await page
        .locator('[data-state="open"] input[placeholder="Search suggestions…"]')
        .fill("winter");
      await page
        .getByRole("option", { name: "winter-news", exact: true })
        .waitFor();
      await page.keyboard.press("Enter");
      assert.equal(await source.inputValue(), "winter-news");
      await edit.locator('input[name="campaign"]').fill("Autumn");
    }
    await source.fill("partner-updated");
    await edit.locator('button[type="submit"]').click();
    await edit
      .getByRole("alert")
      .filter({ hasText: translated.error })
      .waitFor();
    assert.equal(await source.inputValue(), "partner-updated");
    await confirmation
      .getByRole("button", { name: translated.confirm, exact: true })
      .click();
    await confirmation
      .getByRole("alert")
      .filter({ hasText: translated.error })
      .waitFor();
    assert.equal(
      await confirmation
        .getByRole("link", { name: translated.cancel })
        .getAttribute("href"),
      "?returned=utm",
    );
    await page.locator(".recharts-area-area").waitFor();
    if (captureDir) await mkdir(captureDir, { recursive: true });
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (value) =>
          document.documentElement.classList.toggle("dark", value === "dark"),
        theme,
      );
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.waitForFunction(
          () => document.documentElement.scrollWidth <= innerWidth,
        );
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          `${locale}/${theme}/${width} overflow: ${await page.evaluate(() =>
            Array.from(document.querySelectorAll("*"))
              .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
              .slice(0, 8)
              .map((el) => `${el.tagName}.${el.className}`),
          )}`,
        );
        if (captureDir)
          await page.screenshot({
            path: `${captureDir}/${locale}-${theme}-${width}.png`,
            fullPage: true,
            caret: "initial",
          });
      }
    }
    await context.close();
  }
  assert.deepEqual(errors, [], "Browser errors");
  console.log(
    "Controls browser checks passed: tags, date ranges, repeated filters, sharing, UTM confirmation, chart, en/pt/es, light/dark, desktop/mobile.",
  );
} finally {
  await browser?.close();
  await rm(routeDir, { recursive: true, force: true });
}
