import { expect, test } from "bun:test";
import {
  assetUrl,
  isOwnedUploadKey,
  isValidUploadKey,
  keyFromAssetUrl,
} from "../lib/storage-keys";

test.each([
  "uploads/google|123/photo.png",
  "uploads/github|456/photo.jpg",
  "uploads/authS|abc/photo.webp",
])("asset URL round-trip: %s", (key) => {
  const url = assetUrl(key);
  expect(url).toStartWith("https://shortn.test/api/assets/uploads/");
  expect(keyFromAssetUrl(url)).toBe(key);
  expect(isValidUploadKey(key)).toBe(true);
});

test.each([
  "",
  "uploads",
  "uploads/user",
  "private/user/photo.png",
  "uploads-other/user/photo.png",
  "uploads//photo.png",
  "uploads/user/",
  "uploads/user/../photo.png",
  "uploads/user/./photo.png",
  "uploads/user/%2e%2e/photo.png",
  "uploads/user/%252e%252e/photo.png",
  "uploads/user/..\\photo.png",
  "uploads/user/\x00photo.png",
])("rejects invalid asset keys: %s", (key) => {
  expect(isValidUploadKey(key)).toBe(false);
  expect(() => assetUrl(key)).toThrow("Invalid asset key");
});

test.each([
  "https://sapphire-high-sailfish-380.mypinata.cloud/ipfs/old-cid",
  "https://evil.test/api/assets/uploads/user/photo.png",
  "https://shortn.test.evil.test/api/assets/uploads/user/photo.png",
  "https://evil.test@shortn.test/api/assets/uploads/user/photo.png",
  "http://shortn.test/api/assets/uploads/user/photo.png",
  "https://shortn.test/api/assets/private/user/photo.png",
  "https://shortn.test/api/assets/uploads/user/../other/photo.png",
  "https://shortn.test/api/assets/uploads/user/%2e%2e/other/photo.png",
  "https://shortn.test/api/assets/uploads/user/%252e%252e/photo.png",
  "https://shortn.test/api/assets/uploads/user%2Fother/photo.png",
  "https://shortn.test/api/assets/uploads/user/photo.png?download=1",
  "https://shortn.test/api/assets/uploads/user/photo.png#fragment",
  "/api/assets/uploads/user/photo.png",
  "invalid-url",
])("ignores URLs outside the canonical asset namespace: %s", (url) => {
  expect(keyFromAssetUrl(url)).toBeNull();
});

test("ownership uses the entire user segment", () => {
  expect(isOwnedUploadKey("uploads/google|123/photo.png", "google|123")).toBe(
    true,
  );
  for (const sub of ["", "google|12", "google|1234", "other", "google|123/.."])
    expect(isOwnedUploadKey("uploads/google|123/photo.png", sub)).toBe(false);
  expect(
    isOwnedUploadKey("uploads/google|123/../other/photo.png", "google|123"),
  ).toBe(false);
});
