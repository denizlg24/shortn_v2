import { describe, expect, test } from "bun:test";
import { gradientsIn, mergeDesign, printedOptions } from "./qr-options";

const legacy: Record<string, unknown> = {
  width: "1000",
  data: "https://shortn.at/AbC123",
  dotsOptions: {
    type: "rounded",
    color: "#000000",
    gradient: {
      type: "linear",
      rotation: 0.5,
      colorStops: [
        { offset: 0, color: "#ff0000" },
        { offset: 1, color: "#0000ff" },
      ],
    },
  },
  backgroundOptions: { color: "#ffffff", round: 0.1 },
  cornersSquareOptions: { type: "not-a-style" },
};

describe("printedOptions", () => {
  test("keeps what legacy stored, gradients included", () => {
    const options = printedOptions(legacy, "https://shortn.at/other");
    expect(options.width).toBe(1000);
    expect(options.height).toBe(1000);
    expect(options.data).toBe("https://shortn.at/AbC123");
    expect(options.dotsOptions?.gradient?.colorStops).toHaveLength(2);
    expect(options.backgroundOptions?.round).toBe(0.1);
    expect(options.cornersSquareOptions).toEqual({});
  });

  test("falls back to the short URL and library defaults", () => {
    const options = printedOptions({}, "https://shortn.at/xYz789");
    expect(options.data).toBe("https://shortn.at/xYz789");
    expect(options.width).toBe(300);
  });
});

describe("mergeDesign", () => {
  test("a colour change keeps the group's gradient, like the server", () => {
    const merged = mergeDesign(legacy, { dotsOptions: { color: "#123456" } });
    const options = printedOptions(merged, "");
    expect(options.dotsOptions?.color).toBe("#123456");
    expect(options.dotsOptions?.gradient).toBeDefined();
    expect(gradientsIn(merged)).toEqual(["dotsOptions"]);
  });
});
