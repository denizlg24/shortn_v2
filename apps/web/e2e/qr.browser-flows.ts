import { strict as assert } from "node:assert";
import { readFile, mkdir } from "node:fs/promises";
import type { Page } from "playwright-core";
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
