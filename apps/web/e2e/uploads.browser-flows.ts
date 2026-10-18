import { strict as assert } from "node:assert";
import type { Page } from "playwright-core";

export const fixtureSvg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="white"/><rect x="16" y="16" width="32" height="32" fill="#123456"/></svg>',
);

export async function uploadFixtureImage(
  page: Page,
  label: string,
  whileUploading?: () => Promise<void>,
) {
  let release: (() => void) | undefined;
  if (whileUploading) {
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(
      "**/api/uploads/**",
      async (route) => {
        await gate;
        await route.continue();
      },
      { times: 1 },
    );
  }
  const response = page.waitForResponse(
    (response) =>
      response.url().includes("/api/uploads/") &&
      response.request().method() === "POST",
  );
  await page.getByLabel(label, { exact: true }).setInputFiles({
    name: "fixture.svg",
    mimeType: "image/svg+xml",
    buffer: fixtureSvg,
  });
  if (whileUploading) {
    try {
      await whileUploading();
    } finally {
      release?.();
    }
  }
  const result = await response;
  assert.equal(result.status(), 200, await result.text());
  const { url } = await result.json();
  assert.match(
    url,
    /\/api\/assets\/uploads\/workspaces\/[a-f0-9]{24}\/[a-f0-9-]{36}\.png$/,
  );
  await page.locator(`img[src="${url}"]`).first().waitFor();
  await page.waitForFunction(
    (url) =>
      [...document.images].some(
        (image) =>
          image.src === url && image.complete && image.naturalWidth > 0,
      ),
    url,
    { timeout: 15_000 },
  );
  return url as string;
}

export async function rejectInvalidUpload(page: Page, label: string) {
  await page.getByLabel(label, { exact: true }).setInputFiles({
    name: "invalid.png",
    mimeType: "image/png",
    buffer: Buffer.from("This is not an image"),
  });
  await page
    .getByRole("alert")
    .filter({ hasText: "This image could not be read" })
    .waitFor();
}
