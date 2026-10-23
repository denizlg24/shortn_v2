import { expect, test } from "bun:test";
import { moveAmong, sortLinks } from "./link-sort";

const items = [
  { id: "a", title: "banana", visible: true, highlight: false },
  { id: "b", title: "Apple 10", visible: false, highlight: true },
  { id: "c", title: "apple 9", visible: true, highlight: false },
  { id: "d", title: "Cherry", visible: false, highlight: true },
];
const ids = (list: typeof items) => list.map((item) => item.id).join("");
const title = (item: (typeof items)[number]) => item.title;

test("titles sort case-insensitively with numeric runs in order", () => {
  expect(ids(sortLinks(items, "titleAsc", title))).toBe("cbad");
  expect(ids(sortLinks(items, "titleDesc", title))).toBe("dabc");
});

test("flag sorts are stable and reverse flips the order", () => {
  expect(ids(sortLinks(items, "highlightedFirst", title))).toBe("bdac");
  expect(ids(sortLinks(items, "hiddenLast", title))).toBe("acbd");
  expect(ids(sortLinks(items, "reverse", title))).toBe("dcba");
});

test("sorting never mutates the input", () => {
  const before = ids(items);
  sortLinks(items, "titleAsc", title);
  expect(ids(items)).toBe(before);
});

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
