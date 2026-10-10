import { describe, expect, test } from "bun:test";
import { parseColor, scanIssues, type ScanInput } from "./qr-scan-check";

const base: ScanInput = {
  foreground: "#000000",
  background: "#ffffff",
  corners: [],
  logo: false,
  logoSize: 0.4,
  errorLevel: "Q",
  logoUnavailable: false,
};

const kinds = (input: Partial<ScanInput>) =>
  scanIssues({ ...base, ...input }).map((issue) =>
    issue.kind === "contrast" ? `contrast:${issue.tone}` : issue.kind,
  );

describe("parseColor", () => {
  test("reads hex in every length", () => {
    expect(parseColor("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor("#1e90ff")).toEqual({ r: 30, g: 144, b: 255, a: 1 });
    expect(parseColor("#00000080")?.a).toBeCloseTo(0.5, 2);
  });

  test("reads rgb() and rgba()", () => {
    expect(parseColor("rgb(30, 144, 255)")).toEqual({
      r: 30,
      g: 144,
      b: 255,
      a: 1,
    });
    expect(parseColor("rgba(0,0,0,0.25)")?.a).toBe(0.25);
  });

  test("rejects what it can't judge", () => {
    expect(parseColor("linear-gradient(red, blue)")).toBeNull();
    expect(parseColor("#12")).toBeNull();
  });
});

describe("scanIssues", () => {
  test("black on white is fine", () => {
    expect(kinds({})).toEqual(["contrast:ok"]);
  });

  test("the default blue still reads as good contrast", () => {
    expect(kinds({ foreground: "#1e90ff" })).toEqual(["contrast:ok"]);
  });

  test("pale codes are flagged", () => {
    expect(kinds({ foreground: "#cccccc" })).toEqual(["contrast:danger"]);
    expect(kinds({ foreground: "#bbbbbb" })).toEqual(["contrast:warning"]);
    expect(kinds({ foreground: "#888888" })).toEqual(["contrast:ok"]);
  });

  test("a light corner on a dark code still counts", () => {
    expect(kinds({ corners: ["#eeeeee"] })[0]).toBe("contrast:danger");
  });

  test("inverted and transparent codes are called out", () => {
    expect(kinds({ foreground: "#ffffff", background: "#000000" })).toEqual([
      "inverted",
      "contrast:ok",
    ]);
    expect(kinds({ background: "transparent" })).toContain("transparent");
  });

  test("unknown colours skip the contrast check", () => {
    expect(kinds({ background: "papayawhip" })).toEqual(["unknownColor"]);
  });

  test("logo checks follow its share of the error correction", () => {
    expect(kinds({ logo: true, logoSize: 0.6 })).toContain("logoLarge");
    expect(kinds({ logo: true, logoSize: 0.4 })).toEqual(["contrast:ok"]);
    expect(kinds({ logo: true, errorLevel: "L" })).toContain("logoSmall");
    expect(kinds({ logo: true, logoUnavailable: true })).toContain(
      "logoUnavailable",
    );
  });
});
