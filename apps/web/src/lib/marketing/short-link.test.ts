import { expect, test } from "bun:test";
import { shortLinkKey } from "./short-link";

const hosts = ["shortn.at"];

test("accepts a bare key, a host path or a full URL", () => {
  expect(shortLinkKey("abc123", hosts)).toBe("abc123");
  expect(shortLinkKey(" shortn.at/abc123 ", hosts)).toBe("abc123");
  expect(shortLinkKey("https://shortn.at/abc123/", hosts)).toBe("abc123");
  expect(shortLinkKey("HTTP://SHORTN.AT/Ab_c", hosts)).toBe("Ab_c");
});

test("rejects other hosts and malformed keys", () => {
  expect(shortLinkKey("https://evil.example/abc", hosts)).toBeNull();
  expect(shortLinkKey("shortn.at/a/b", hosts)).toBeNull();
  expect(shortLinkKey("shortn.at/", hosts)).toBeNull();
  expect(shortLinkKey("not a link", hosts)).toBeNull();
});
