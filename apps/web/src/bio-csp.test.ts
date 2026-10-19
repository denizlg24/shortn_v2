import { expect, test } from "bun:test";
import { bioCsp } from "./lib/bio-csp";
import config from "../next.config";

const directive = (csp: string, name: string) =>
  csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `));

test("bio CSP takes the beacon origin from the runtime env", () => {
  const csp = bioCsp({ BIO_API_ORIGIN: "https://api.example.test" }, "n0nce");
  expect(directive(csp, "connect-src")).toBe(
    "connect-src 'self' https://api.example.test",
  );
  // Assets are same-origin under the asset prefix on every host.
  expect(directive(csp, "style-src")).toContain("'self'");
  expect(directive(csp, "script-src")).toContain("'self'");
});

test("bio scripts run only by nonce", () => {
  const csp = bioCsp({}, "n0nce");
  expect(directive(csp, "script-src")).toBe(
    "script-src 'self' 'nonce-n0nce' 'strict-dynamic'",
  );
  expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
});

test("the build output does not depend on environment origins", () => {
  // Staging and production share build caches, so nothing in next.config may
  // vary per environment.
  expect(config.assetPrefix).toBe("/_web");
});
