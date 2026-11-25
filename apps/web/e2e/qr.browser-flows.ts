import { strict as assert } from "node:assert";
import { readFile, mkdir } from "node:fs/promises";
import type { Page } from "playwright-core";
import type { Db, ObjectId } from "mongodb";
import { physicalNames } from "@shortn/db";
import {
  rejectInvalidUpload,
  uploadFixtureImage,
} from "./uploads.browser-flows";

/** Real design saves and files, including decoding the exported QR payload. */
export async function checkQrDesignAndDownloads({
  page,
  go,
  id,
  key,
  shortUrl,
  storedOptions,
  setStoredLogo,
  captureDir,
}: {
  page: Page;
  go: (path: string) => Promise<unknown>;
  id: string;
  key: string;
  shortUrl: string;
  storedOptions: () => Promise<Record<string, unknown> | undefined>;
  setStoredLogo: (url: string) => Promise<unknown>;
  captureDir: string | undefined;
}) {
  await go(`/qr/${id}/design`);
  await page
    .getByRole("textbox", { name: "Code", exact: true })
    .fill("#123456");
  await page
    .getByRole("radiogroup", { name: "Dots", exact: true })
    .getByRole("radio", { name: "Rounded", exact: true })
    .click();
  await page
    .getByRole("radiogroup", { name: "Corner squares", exact: true })
    .getByRole("radio", { name: "Extra rounded", exact: true })
    .click();
  await page
    .getByRole("radiogroup", { name: "Level", exact: true })
    .getByRole("radio", { name: "H · 30%", exact: true })
    .click();
  await rejectInvalidUpload(page, "Logo");
  assert.equal(
    await page.getByRole("textbox", { name: "Code", exact: true }).inputValue(),
    "#123456",
  );
  await uploadFixtureImage(page, "Logo");
  const preview = page.getByRole("complementary", {
    name: "Preview",
    exact: true,
  });
  await preview.getByRole("img").waitFor();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForFunction(
      () => document.documentElement.scrollWidth <= innerWidth,
    );
    if (captureDir) {
      await mkdir(captureDir, { recursive: true });
      await page.screenshot({
        path: `${captureDir}/qr-design-${width}.png`,
        fullPage: true,
      });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Save design", exact: true }).click();
  await page.waitForURL(`**/qr/${id}?saved=1`);
  const options = await storedOptions();
  assert.deepEqual(options?.dotsOptions, { type: "rounded", color: "#123456" });
  assert.equal(
    (options?.cornersSquareOptions as { type: string }).type,
    "extra-rounded",
  );
  assert.equal(
    (options?.qrOptions as { errorCorrectionLevel: string })
      .errorCorrectionLevel,
    "H",
  );

  await page.addScriptTag({
    content: await readFile(new URL(import.meta.resolve("jsqr")), "utf8"),
  });
  for (const [format, size, extension, mime] of [
    ["PNG", 512, "png", "image/png"],
    ["SVG (vector)", 1024, "svg", "image/svg+xml"],
    ["JPEG", 2048, "jpg", "image/jpeg"],
  ] as const) {
    await page
      .getByRole("combobox", { name: "Size", exact: true })
      .selectOption(String(size));
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: format, exact: true }).click();
    const file = await downloaded;
    assert.equal(await file.failure(), null);
    assert.equal(file.suggestedFilename(), `${key}.${extension}`);
    const path = await file.path();
    assert(path);
    const bytes = await readFile(path);
    assert(bytes.length > 100, `${format} contains an image`);
    if (extension === "svg")
      assert.match(
        bytes.toString(),
        /<image\b/,
        "The exported vector includes its logo",
      );
    const decoded = await page.evaluate(
      async ({ source }) => {
        const image = new Image();
        image.src = source;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 512;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, 512, 512);
        ctx.drawImage(image, 0, 0, 512, 512);
        const pixels = ctx.getImageData(0, 0, 512, 512);
        const decode = (
          window as unknown as {
            jsQR: (
              pixels: Uint8ClampedArray,
              width: number,
              height: number,
            ) => { data: string } | null;
          }
        ).jsQR;
        return {
          width: image.naturalWidth,
          height: image.naturalHeight,
          payload: decode(pixels.data, 512, 512)?.data,
        };
      },
      { source: `data:${mime};base64,${bytes.toString("base64")}` },
    );
    assert.equal(decoded.width, size, `${format} exported width`);
    assert.equal(decoded.height, size, `${format} exported height`);
    assert.equal(
      decoded.payload,
      shortUrl,
      `${format} scans to the unchanged QR short link`,
    );
  }
  const missingLogo = new URL("/qr-browser-unavailable.png", page.url()).href;
  await page.route(missingLogo, (route) => route.abort("failed"));
  await setStoredLogo(missingLogo);
  await go(`/qr/${id}/design`);
  await page
    .getByText("The logo didn't load, so the preview leaves it out.", {
      exact: false,
    })
    .waitFor();
  await page.getByRole("button", { name: "Save design", exact: true }).click();
  await page.waitForURL(`**/qr/${id}?saved=1`);
  let unexpectedDownload = false;
  const onDownload = () => {
    unexpectedDownload = true;
  };
  page.on("download", onDownload);
  await page.getByRole("button", { name: "PNG", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "download would be missing it" })
    .waitFor();
  assert.equal(
    unexpectedDownload,
    false,
    "An unavailable logo never silently disappears from an export",
  );
  page.off("download", onDownload);
  await go(`/qr/${id}/design`);
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("button", { name: "Save design", exact: true }).click();
  await page.waitForURL(`**/qr/${id}?saved=1`);
  assert.equal((await storedOptions())?.image, "");
  console.log(
    "QR design and downloads passed: saved colours/shapes/correction, validation, PNG/SVG/JPEG sizes and decoded payloads.",
  );
}

/** Focused create/share/edit acceptance, also run with dashboard.browser.ts --qr-sharing. */
export async function checkQrSharing({
  page,
  go,
  db,
  workspaceId,
  run,
  captureDir,
}: {
  page: Page;
  go: (path: string) => Promise<unknown>;
  db: Db;
  workspaceId: ObjectId;
  run: string;
  captureDir: string | undefined;
}) {
  if (captureDir) await mkdir(captureDir, { recursive: true });
  await go("/qr/new");
  await page
    .locator('input[name="url"]')
    .fill("https://example.org/qr-through-ui");
  await page.locator('input[name="title"]').fill("Created QR through UI");
  await page
    .getByRole("button", { name: "Create QR code", exact: true })
    .click();
  await page.waitForURL(/\/qr\/[a-f0-9]{24}\?created=1$/);
  assert.equal(
    await db.collection(physicalNames.qr_codes).countDocuments({
      workspaceId,
      title: "Created QR through UI",
    }),
    1,
  );

  await page
    .getByRole("heading", { name: "Share online", exact: true })
    .waitFor();
  const createdQr = await db
    .collection(physicalNames.qr_codes)
    .findOne({ workspaceId, title: "Created QR through UI" });
  assert(createdQr);
  assert.equal(createdQr.options.dotsOptions.color, "#000000");
  const scanAddress = createdQr.options.data;
  assert.equal(
    await page
      .getByRole("button", { name: "Copy short link", exact: true })
      .count(),
    0,
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    if (captureDir)
      await page.screenshot({
        path: `${captureDir}/qr-share-empty-${width}.png`,
        fullPage: true,
      });
  }
  await page
    .getByRole("link", { name: "Create short link", exact: true })
    .click();
  await page.locator('input[name="key"]').fill(`qr-share-${run}`);
  await page
    .getByRole("button", { name: "Create short link", exact: true })
    .click();
  await page.waitForURL(`**/qr/${createdQr._id}?saved=1`);
  await page
    .getByRole("link", { name: "Edit short link", exact: true })
    .waitFor();
  const attachedQr = await db
    .collection(physicalNames.qr_codes)
    .findOne({ _id: createdQr._id });
  assert(attachedQr?.attachedLinkId);
  assert.equal(attachedQr.options.data, scanAddress);
  await page
    .getByRole("button", { name: "Copy short link", exact: true })
    .click();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    `https://shortn.at/qr-share-${run}`,
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    if (captureDir)
      await page.screenshot({
        path: `${captureDir}/qr-share-attached-${width}.png`,
        fullPage: true,
      });
  }
  await page
    .getByRole("link", { name: "Edit short link", exact: true })
    .click();
  await page.locator('input[name="key"]').fill(`qr-renamed-${run}`);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.waitForURL(`**/links/${attachedQr.attachedLinkId}?saved=1`);
  await go(`/qr/${createdQr._id}`);
  await page
    .getByRole("button", { name: "Copy short link", exact: true })
    .click();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    `https://shortn.at/qr-renamed-${run}`,
  );
  assert.equal(
    (
      await db
        .collection(physicalNames.qr_codes)
        .findOne({ _id: createdQr._id })
    )?.options.data,
    scanAddress,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });

  console.log(
    "QR sharing acceptance passed: black default, create/copy/rename attached link, unchanged scan payload, desktop/mobile.",
  );
}
