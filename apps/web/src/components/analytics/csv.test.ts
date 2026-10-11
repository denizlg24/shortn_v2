import { describe, expect, test } from "bun:test";
import { toCsv } from "./csv";

describe("toCsv", () => {
  test("quotes fields and escapes quotes", () => {
    expect(
      toCsv([
        ["Name", "Total"],
        ['Say "hi"', 3],
      ]),
    ).toBe('"Name","Total"\n"Say ""hi""","3"\n');
  });

  test("defuses formulas in text but keeps negative-looking numbers", () => {
    expect(toCsv([["=SUM(A1)", "+1", "@x", -2]])).toBe(
      `"'=SUM(A1)","'+1","'@x","-2"\n`,
    );
  });
});
