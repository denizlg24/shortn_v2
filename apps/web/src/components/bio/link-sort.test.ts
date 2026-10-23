import { expect, test } from "bun:test";
import { sortLinks } from "./link-sort";

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
