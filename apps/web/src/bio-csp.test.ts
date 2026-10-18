import { expect, test } from "bun:test";

test("bio pages allow the asset origin for styles, scripts and fonts", async () => {
  process.env.WEB_ASSET_ORIGIN = "https://assets.example.test";
  const { default: config } = await import("../next.config");
  const rules = (await config.headers?.()) ?? [];
  const csp = rules
    .find((rule) => rule.source === "/_bio/:path*")
    ?.headers.find((header) => header.key === "Content-Security-Policy")?.value;
  expect(csp).toBeDefined();
  // Bio pages are served on handle and custom-domain hosts, where the asset
  // origin is never 'self'; a missing directive drops the page's CSS or JS.
  for (const directive of ["style-src", "script-src", "font-src"]) {
    const value = csp
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${directive} `));
    expect(value).toContain("https://assets.example.test");
  }
});
