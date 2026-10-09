import { describe, expect, test } from "bun:test";
import { cn } from "@shortn/ui";

describe("cn", () => {
  test("drops falsy inputs", () => {
    expect(cn("px-2", false, undefined, null, "", "py-1")).toBe("px-2 py-1");
  });

  test("keeps a text colour next to a type-scale size", () => {
    expect(cn("text-fg-muted", "text-small")).toBe("text-fg-muted text-small");
  });

  test("lets the later type-scale size win", () => {
    expect(cn("text-small", "text-body")).toBe("text-body");
  });

  test("resolves conflicts within the custom radius, shadow and spacing scales", () => {
    expect(cn("rounded-chip", "rounded-control")).toBe("rounded-control");
    expect(cn("shadow-overlay", "shadow-none")).toBe("shadow-none");
    expect(cn("h-row", "h-header-row")).toBe("h-header-row");
    expect(cn("px-cell", "px-gutter")).toBe("px-gutter");
  });
});
