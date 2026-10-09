import { expect, test } from "bun:test";
import { detectImageType } from "../lib/image-type";

test.each([
  ["png", "image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  ["jpg", "image/jpeg", [0xff, 0xd8, 0xff, 0xe0]],
  ["gif", "image/gif", [...Buffer.from("GIF87a")]],
  ["gif", "image/gif", [...Buffer.from("GIF89a")]],
  ["webp", "image/webp", [...Buffer.from("RIFF\x00\x00\x00\x00WEBPVP8 ")]],
  ["webp", "image/webp", [...Buffer.from("RIFF\x00\x00\x00\x00WEBPVP8L")]],
  ["webp", "image/webp", [...Buffer.from("RIFF\x00\x00\x00\x00WEBPVP8X")]],
] as const)("detects %s from bytes", (ext, contentType, signature) => {
  expect(detectImageType(new Uint8Array(signature))).toEqual({
    ext,
    contentType,
  });
});

test.each([
  "",
  "<svg onload='alert(1)'/>",
  "<?xml version='1.0'?><svg/>",
  "<html></html>",
  "GIF90a",
  "RIFF\x00\x00\x00\x00WAVE",
  "RIFF\x00\x00\x00\x00WEBPbad!",
])("rejects unsupported bytes: %s", (input) => {
  expect(detectImageType(Buffer.from(input))).toBeNull();
});

test("rejects truncated signatures", () => {
  for (const bytes of [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    new Uint8Array([0xff, 0xd8]),
    Buffer.from("GIF89"),
    Buffer.from("RIFF\x00\x00\x00\x00WEBP"),
  ])
    expect(detectImageType(bytes)).toBeNull();
});
