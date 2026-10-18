import { strict as assert } from "node:assert";
import type { Db } from "mongodb";
import { ObjectId } from "mongodb";
import { physicalNames } from "@shortn/db";
import type { Page } from "playwright-core";

export async function checkQrFilters({
  page,
  go,
  captureDir,
}: {
  page: Page;
  go: (path: string) => Promise<unknown>;
  captureDir: string | undefined;
}) {
  await go("/qr");
  await page.getByRole("combobox", { name: "Tag", exact: true }).click();
  await page.getByRole("option", { name: "Print", exact: true }).click();
  await page.waitForURL((url) => url.searchParams.get("tag") === "Print");
  await page.getByRole("option", { name: "Event", exact: true }).click();
  await page.waitForURL((url) => url.searchParams.getAll("tag").length === 2);
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "List", exact: true }).click();
  await page.waitForURL((url) => url.searchParams.get("view") === "list");
  assert.deepEqual(new URL(page.url()).searchParams.getAll("tag").sort(), [
    "Event",
    "Print",
  ]);
  assert.equal(await page.locator('input[name="ids"]').count(), 1);
  if (captureDir) {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForFunction(
        () => document.documentElement.scrollWidth <= innerWidth,
      );
      await page.screenshot({ path: `${captureDir}/qr-tags-${width}.png` });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.getByRole("button", { name: "Remove Print", exact: true }).click();
  await page.waitForURL(
    (url) => url.searchParams.getAll("tag").join() === "Event",
  );
  await page.getByRole("link", { name: "Grid", exact: true }).click();
  await page.waitForURL((url) => !url.searchParams.has("view"));
  assert.equal(new URL(page.url()).searchParams.get("tag"), "Event");
  await go("/qr?view=list&tag=Missing&q=unmatched");
  await page
    .getByText("No QR codes match these filters.", { exact: true })
    .waitFor();
  await page.getByRole("link", { name: "Clear all", exact: true }).click();
  await page.waitForURL((url) => url.search === "?view=list");
  assert.equal(await page.locator('input[name="ids"]').count(), 1);
  console.log(
    "QR filters passed: multiple tags, repeated URL parameters, view switching, chip removal, empty state and view-preserving clear.",
  );
}

export async function checkLinkDetails({
  page,
  go,
  db,
  linkId,
  creatorId,
  captureDir,
}: {
  page: Page;
  go: (path: string) => Promise<unknown>;
  db: Db;
  linkId: string;
  creatorId: string;
  captureDir: string | undefined;
}) {
  const links = db.collection(physicalNames.links);
  const filter = { _id: new ObjectId(linkId) };
  const initial = await links.findOne(filter);
  assert(initial);
  const detail = (name: string) =>
    page
      .locator("dt")
      .filter({ hasText: new RegExp(`^${name}$`) })
      .locator("..")
      .locator("dd");
  try {
    for (const [status, label] of [
      ["pending", "Scanning"],
      ["safe", "No issues found"],
      ["suspicious", "Suspicious destination"],
      ["malicious", "Unsafe destination"],
      ["blocked", "Blocked"],
      ["future-status", "Safety status unavailable"],
    ]) {
      await links.updateOne(filter, {
        $set: {
          safetyStatus: status,
          disabled: false,
          requiresInterstitial: false,
        },
      });
      await go(`/links/${linkId}`);
      assert.equal(await detail("Safety").innerText(), label);
      assert.equal(await detail("Created by").innerText(), "Dashboard checks");
    }
    await links.updateOne(filter, {
      $set: {
        safetyStatus: "suspicious",
        disabled: false,
        requiresInterstitial: true,
      },
    });
    await go(`/links/${linkId}`);
    assert.match(
      await detail("Safety").innerText(),
      /Visitors see a safety page/,
    );
    if (captureDir) {
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await detail("Safety").scrollIntoViewIfNeeded();
        await page.waitForFunction(
          () => document.documentElement.scrollWidth <= innerWidth,
        );
        await page.screenshot({
          path: `${captureDir}/link-safety-${width}.png`,
        });
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await links.updateOne(filter, {
      $set: {
        safetyStatus: "blocked",
        disabled: true,
        createdBy: new ObjectId().toHexString(),
      },
    });
    await go(`/links/${linkId}`);
    await page
      .getByRole("status")
      .filter({ hasText: "This short link is disabled" })
      .waitFor();
    assert.match(await detail("Safety").innerText(), /Disabled for safety/);
    assert.equal(await detail("Created by").innerText(), "Creator unavailable");
  } finally {
    const set: Record<string, unknown> = { createdBy: creatorId };
    const unset: Record<string, ""> = {};
    for (const field of ["safetyStatus", "disabled", "requiresInterstitial"]) {
      if (Object.hasOwn(initial, field)) set[field] = initial[field];
      else unset[field] = "";
    }
    await links.updateOne(filter, {
      $set: set,
      ...(Object.keys(unset).length ? { $unset: unset } : {}),
    });
  }
  console.log(
    "Link details passed: safety states, interstitial explanation, disabled notice, creator and unavailable-creator fallback.",
  );
}
