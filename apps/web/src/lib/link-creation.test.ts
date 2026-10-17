import { expect, test } from "bun:test";
import { creationUrl, pastedCreationUrl } from "./link-creation";
test("destination normalization preserves query and fragment while paste only intercepts explicit web URLs", () => {
  expect(creationUrl(" example.com/page?x=1#section ")).toBe(
    "https://example.com/page?x=1#section",
  );
  expect(pastedCreationUrl("https://example.com/page#section")).toBe(
    "https://example.com/page#section",
  );
  for (const value of [
    "example.com",
    "ordinary sentence",
    "https://example.com\nhttps://example.org",
    "javascript:alert(1)",
    "https://user:secret@example.com",
    "https://localhost",
    "x".repeat(2049),
  ])
    expect(pastedCreationUrl(value)).toBeNull();
});
