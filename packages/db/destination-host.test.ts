import { expect, test } from "bun:test";
import { destinationHostRev } from "./destination-host";
test("destination host keys normalize DNS names and preserve suffix boundaries", () => {
  expect(destinationHostRev("https://Login.Example.COM./path?q=secret")).toBe(
    "com.example.login",
  );
  expect(destinationHostRev("https://example.com")).toBe("com.example");
  expect(destinationHostRev("https://bücher.example")).toBe(
    "example.xn--bcher-kva",
  );
  expect(destinationHostRev("javascript:alert(1)")).toBeNull();
  expect(destinationHostRev("broken")).toBeNull();
  const prefix = /^com\.example(?:\.|$)/;
  expect(prefix.test(destinationHostRev("https://login.example.com")!)).toBe(
    true,
  );
  expect(prefix.test(destinationHostRev("https://notexample.com")!)).toBe(
    false,
  );
  expect(
    prefix.test(destinationHostRev("https://example.com.evil.test")!),
  ).toBe(false);
});
