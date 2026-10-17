import { decodeSelection } from "../src/lib/bulk-selection";
import { strict as assert } from "node:assert";
import { mkdir } from "node:fs/promises";
import type { Page } from "playwright-core";

export async function checkBulkSelection({
  page,
  go,
  captureDir,
}: {
  page: Page;
  go: (path: string) => Promise<unknown>;
  captureDir: string | undefined;
}) {
  for (const path of ["/links", "/qr", "/qr?view=list"]) {
    await go(path);
    const rows = page.locator('input[name="ids"]');
    const total = await rows.count();
    assert(total > 0);
    const all = page.getByRole("checkbox", {
      name: "Select this page",
      exact: true,
    });
    const remove = page.getByRole("button", {
      name: "Delete selected",
      exact: true,
    });
    assert(await remove.isDisabled());
    await rows.first().check();
    assert.equal(
      await page
        .getByRole("status")
        .filter({ hasText: /^1 selected$/ })
        .count(),
      1,
    );
    assert.equal(
      await all.evaluate((input: HTMLInputElement) => input.indeterminate),
      total > 1,
    );
    await all.check();
    assert.equal(
      await rows.evaluateAll(
        (inputs) =>
          inputs.filter((input) => (input as HTMLInputElement).checked).length,
      ),
      total,
    );
    assert(await all.isChecked());
    if (captureDir) {
      await mkdir(captureDir, { recursive: true });
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await all.scrollIntoViewIfNeeded();
        await page.waitForFunction(
          () => document.documentElement.scrollWidth <= innerWidth,
        );
        await page.screenshot({
          path: `${captureDir}/selection-${path.includes("links") ? "links" : path.includes("list") ? "qr-list" : "qr-grid"}-${width}.png`,
        });
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await page
      .getByRole("button", { name: "Clear selection", exact: true })
      .click();
    assert(await remove.isDisabled());
    assert.equal(
      await rows.evaluateAll(
        (inputs) =>
          inputs.filter((input) => (input as HTMLInputElement).checked).length,
      ),
      0,
    );
    await rows.first().check();
    const chosen = await rows.first().inputValue();
    await remove.click();
    await page.waitForURL((url) => url.pathname.endsWith("/delete"));
    assert.deepEqual(
      decodeSelection(new URL(page.url()).searchParams.get("selection")),
      [chosen],
    );
    await page.getByRole("link", { name: "Cancel", exact: true }).click();
    await page.waitForURL((url) => !url.pathname.endsWith("/delete"));
    assert(
      await page
        .getByRole("button", { name: "Delete selected", exact: true })
        .isDisabled(),
    );
  }
  await go("/links");
  await page.locator('input[name="ids"]').first().check();
  await page
    .getByRole("searchbox", { name: "Search", exact: true })
    .fill("Dashboard fixture");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.waitForURL(
    (url) => url.searchParams.get("q") === "Dashboard fixture",
  );
  assert(
    await page
      .getByRole("button", { name: "Delete selected", exact: true })
      .isEnabled(),
  );
  await page
    .getByRole("status")
    .filter({ hasText: /^1 selected$/ })
    .waitFor();
  await page
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();
  console.log(
    "Bulk selection passed: count, mixed state, current-page selection, clear, confirmation/cancel and cross-filter persistence.",
  );
}
