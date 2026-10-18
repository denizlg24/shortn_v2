import { expect, test } from "bun:test";
import sharp from "sharp";
import {
  imageForStorage,
  boundedUploadBody,
  maxImageBytes,
} from "./upload-image";

test("decodes actual bytes and produces a metadata-free PNG", async () => {
  const jpeg = await sharp({
    create: { width: 32, height: 16, channels: 3, background: "red" },
  })
    .jpeg()
    .withMetadata()
    .toBuffer();
  const output = await imageForStorage(jpeg);
  const metadata = await sharp(output).metadata();
  expect(metadata.format).toBe("png");
  expect(metadata.width).toBe(32);
  expect(metadata.exif).toBeUndefined();
});
test("rasterizes SVG logos and refuses external resources or active documents", async () => {
  const svg = (content: string) =>
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">${content}</svg>`,
    );
  expect(
    (
      await sharp(
        await imageForStorage(svg('<rect width="64" height="64" fill="red"/>')),
      ).metadata()
    ).format,
  ).toBe("png");
  for (const content of [
    '<image href="file:///etc/passwd"/>',
    '<image href="http://localhost/internal"/>',
    "<script>alert(1)</script>",
    '<style>@import "http://localhost/private";</style>',
  ])
    await expect(imageForStorage(svg(content))).rejects.toThrow();
});
test("rejects fake images, excess bytes and excessive image dimensions", async () => {
  await expect(imageForStorage(Buffer.from("not a PNG"))).rejects.toThrow();
  await expect(
    imageForStorage(new Uint8Array(maxImageBytes + 1)),
  ).rejects.toThrow("size");
  await expect(
    imageForStorage(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100000" height="100000"/>',
      ),
    ),
  ).rejects.toThrow();
});
test("bounds chunked bodies before parsing multipart", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(maxImageBytes + 65 * 1024));
    },
    cancel() {
      cancelled = true;
    },
  });
  await expect(
    boundedUploadBody(
      new Request("http://localhost/upload", {
        method: "POST",
        body: stream,
        duplex: "half",
      } as RequestInit),
    ),
  ).rejects.toThrow("size");
  expect(cancelled).toBe(true);
});
