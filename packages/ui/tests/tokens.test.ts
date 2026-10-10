import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runTokenChecks, type TokenCheckResult } from "../scripts/token-checks";

const tokens = readFileSync(join(import.meta.dir, "../src/tokens.css"), "utf8");

const describeFailure = (result: TokenCheckResult) =>
  `${result.theme} ${result.section}: ${result.name} (${result.detail})`;

describe("design tokens", () => {
  test("meet contrast, chart separation and gamut targets in both themes", () => {
    const results = runTokenChecks(tokens);

    expect(new Set(results.map((result) => result.theme))).toEqual(
      new Set(["light", "dark"]),
    );
    expect(
      results.filter((result) => !result.pass).map(describeFailure),
    ).toEqual([]);
  });

  test("flag a text colour that drops below AA", () => {
    const washedOut = tokens.replace(
      /(:root\s*\{[^}]*?--fg-subtle:\s*)[^;]+;/,
      "$1oklch(0.92 0 0);",
    );
    expect(washedOut).not.toBe(tokens);

    const failing = runTokenChecks(washedOut)
      .filter((result) => !result.pass)
      .map((result) => `${result.theme} ${result.name}`);

    expect(failing).toContain("light fg-subtle on bg");
  });
});
