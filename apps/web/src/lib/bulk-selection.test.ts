import { expect, test } from "bun:test";
import {
  bulkSelectionLimit,
  decodeSelection,
  encodeSelection,
  normalizeSelection,
} from "./bulk-selection";
test("maximum selections round-trip below the request-target limit without dropping IDs", () => {
  const ids = Array.from({ length: bulkSelectionLimit }, (_, n) =>
    (n + 1).toString(16).padStart(24, "0"),
  );
  const value = encodeSelection(ids);
  expect(value.length).toBe(8000);
  expect(decodeSelection(value)).toEqual(ids);
  expect(
    `/${"w".repeat(64)}/links/delete?selection=${value}`.length,
  ).toBeLessThan(8192);
  expect(() => encodeSelection([...ids, "f".repeat(24)])).toThrow("limit");
  expect(decodeSelection(value + "aaaa")).toEqual([]);
});
test("malformed transport fails closed; persistence normalization is bounded and deduplicated", () => {
  for (const value of [
    null,
    undefined,
    ["aaa"],
    "x",
    "a".repeat(15),
    "a".repeat(16) + "=",
    "?".repeat(16),
  ])
    expect(decodeSelection(value)).toEqual([]);
  expect(() => encodeSelection(["invalid"])).toThrow();
  expect(() => encodeSelection(["a".repeat(24), "a".repeat(24)])).toThrow();
  expect(normalizeSelection([null, 1, "A".repeat(24), "a".repeat(24)])).toEqual(
    ["a".repeat(24)],
  );
});
