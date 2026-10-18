import { describe, expect, test } from "bun:test";
import { readStored, writeStored } from "./browser-store";
import { failingSources, memorySource } from "./test-stores";

describe("browser store", () => {
  test("reads, writes and removes through the store", () => {
    const source = memorySource();
    expect(readStored(source, "k")).toEqual({ available: true, value: null });
    expect(writeStored(source, "k", "v")).toBe(true);
    expect(readStored(source, "k")).toEqual({ available: true, value: "v" });
    expect(writeStored(source, "k", null)).toBe(true);
    expect(readStored(source, "k")).toEqual({ available: true, value: null });
  });

  test.each(failingSources)(
    "degrades to unavailable without throwing: %s",
    (_, source) => {
      expect(readStored(source, "k")).toEqual({ available: false });
      expect(writeStored(source, "k", "v")).toBe(false);
      expect(writeStored(source, "k", null)).toBe(false);
    },
  );
});
