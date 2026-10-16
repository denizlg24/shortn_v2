import { describe, expect, test } from "bun:test";
import generator from "qrcode-generator";
import { planQrPrint, printColor, qrMatrix } from "./index";

describe("print-safe QR plans", () => {
  test("matrix preserves the existing editor's complete module layout", () => {
    const examples = [
      ["12345678901234567890", "Numeric"],
      ["HTTPS://SHORTN.AT/ABC-123", "Alphanumeric"],
      ["https://shortn.at/newsletter?qr=flyer-2026", "Byte"],
      ["https://custom.example/" + "bounded-key-".repeat(100), "Byte"],
      ["legacy-São-João", "Byte"],
    ] as const;
    for (const correction of ["L", "M", "Q", "H"] as const) {
      for (const [data, mode] of examples) {
        const reference = generator(0, correction);
        reference.addData(data, mode);
        reference.make();
        const result = qrMatrix(data, correction);
        expect(result.size).toBe(reference.getModuleCount());
        let differences = 0;
        for (let row = 0; row < result.size; row++) {
          for (let col = 0; col < result.size; col++) {
            if (result.dark(row, col) !== reference.isDark(row, col))
              differences++;
          }
        }
        expect(differences).toBe(0);
      }
    }
  });

  test("enforces four quiet modules at every allowed output size", () => {
    for (const size of [128, 300, 1024, 4096]) {
      const result = planQrPrint({}, "https://shortn.at/flyer", size);
      expect(result.quietZoneModules).toBeGreaterThanOrEqual(4);
      expect(
        result.margin * 2 + result.matrix.size * result.moduleSize,
      ).toBeLessThanOrEqual(size);
      expect(result.correction).toBe("Q");
      expect(result.minimumPrintMm).toBeGreaterThan(0);
    }
    const largerMargin = planQrPrint(
      { width: "300", margin: 80 },
      "https://shortn.at/flyer",
    );
    expect(largerMargin.margin).toBeGreaterThan(270);
  });

  test("logos raise error correction to H and lower stored levels are raised to Q", () => {
    expect(
      planQrPrint(
        { qrOptions: { errorCorrectionLevel: "L" } },
        "https://shortn.at/a",
      ).correction,
    ).toBe("Q");
    expect(
      planQrPrint(
        { qrOptions: { errorCorrectionLevel: "H" } },
        "https://shortn.at/a",
      ).correction,
    ).toBe("H");
    expect(
      planQrPrint(
        { image: "https://assets.example/logo.png" },
        "https://shortn.at/a",
      ).correction,
    ).toBe("H");
  });

  test("refuses weak modules, weak finder corners and crossing gradient colors", () => {
    for (const stored of [
      { dotsOptions: { color: "#ddd" } },
      { cornersSquareOptions: { color: "#ddd" } },
      { cornersDotOptions: { color: "#ddd" } },
      {
        dotsOptions: {
          gradient: {
            type: "linear",
            colorStops: [
              { offset: 0, color: "black" },
              { offset: 1, color: "white" },
            ],
          },
        },
      },
      // Foreground and background endpoints have contrast, but the gradients
      // cross between them. Testing corresponding stops alone would pass.
      {
        dotsOptions: {
          gradient: {
            type: "linear",
            colorStops: [
              { offset: 0, color: "black" },
              { offset: 1, color: "white" },
            ],
          },
        },
        backgroundOptions: {
          gradient: {
            type: "linear",
            colorStops: [
              { offset: 0, color: "white" },
              { offset: 1, color: "black" },
            ],
          },
        },
      },
    ])
      expect(() => planQrPrint(stored, "https://shortn.at/a")).toThrow(
        "low_contrast",
      );
    expect(
      planQrPrint({ dotsOptions: { color: "navy" } }, "https://shortn.at/a")
        .contrast,
    ).toBeGreaterThan(3);
  });

  test("canonicalizes CSS colors and rejects CSS references, alpha and markup", () => {
    expect(printColor("white", "#000")).toBe("#fff");
    expect(printColor("rgb(0 0 0)", "#fff")).toBe("#000");
    for (const value of [
      "url(https://attacker.example/x)",
      "var(--color)",
      "transparent",
      "rgba(0,0,0,.5)",
      'red" onload="alert(1)',
      "",
    ]) {
      expect(() => printColor(value, "#fff")).toThrow("invalid_color");
    }
  });

  test("bounds output, payload, margins and gradient complexity before rendering", () => {
    expect(() => planQrPrint({}, "https://shortn.at/a", 8192)).toThrow(
      "invalid_size",
    );
    expect(() => planQrPrint({}, "a".repeat(2049))).toThrow("invalid_data");
    expect(() => planQrPrint({ margin: 200 }, "https://shortn.at/a")).toThrow(
      "invalid_design",
    );
    expect(() =>
      planQrPrint(
        {
          dotsOptions: {
            gradient: {
              type: "linear",
              colorStops: Array.from({ length: 17 }, () => ({
                offset: 0,
                color: "black",
              })),
            },
          },
        },
        "https://shortn.at/a",
      ),
    ).toThrow("invalid_design");
    expect(() =>
      planQrPrint(
        {
          dotsOptions: {
            gradient: {
              type: "linear",
              colorStops: [
                { offset: 1, color: "black" },
                { offset: 0, color: "navy" },
              ],
            },
          },
        },
        "https://shortn.at/a",
      ),
    ).toThrow("invalid_design");
  });
});
