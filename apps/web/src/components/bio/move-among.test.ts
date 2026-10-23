import { expect, test } from "bun:test";
import { moveAmong } from "./move-among";

test("moving among search matches leaves the other links in place", () => {
  const list = ["a", "x", "b", "y", "c"].map((id) => ({ id }));
  const moved = (from: string, to: string, among = ["a", "b", "c"]) =>
    moveAmong(list, among, from, to)
      .map((item) => item.id)
      .join("");
  expect(moved("a", "c")).toBe("bxcya");
  expect(moved("c", "a")).toBe("cxayb");
  expect(moved("a", "y", ["a", "x", "b", "y", "c"])).toBe("xbyac");
});
