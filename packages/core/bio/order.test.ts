import { expect, test } from "bun:test";
import {
  bioContentSchema,
  migratedBioContent,
  newBioLinksSection,
  orderBioLinks,
  stampBioLinksAdded,
  type BioLinkFacts,
  type BioLinkItem,
  type BioLinkOrder,
} from "./content";

// One letter per link: a–d have facts, e has none.
const hex = (letter: string) => letter.repeat(24);
const facts: Record<string, BioLinkFacts> = {
  a: { createdAt: "2026-01-01T00:00:00.000Z", title: "banana" },
  b: { createdAt: "2026-03-01T00:00:00.000Z", title: "Apple 10" },
  c: { createdAt: "2026-02-01T00:00:00.000Z", title: "apple 9" },
  d: { createdAt: "2026-03-01T00:00:00.000Z", title: "Cherry" },
};
const lookup = (linkId: string) => facts[linkId[0]!];
const item = (letter: string, extra: Partial<BioLinkItem> = {}) => ({
  id: `item-${letter}`,
  linkId: hex(letter),
  title: "",
  visible: true,
  image: "",
  highlight: false,
  ...extra,
});
const base = migratedBioContent({ title: "Order" });
const page = (order: BioLinkOrder, items: ReturnType<typeof item>[]) =>
  bioContentSchema.parse({
    ...base,
    blocks: [base.blocks[0], { ...newBioLinksSection("links"), order, items }],
  });
const order = (content: ReturnType<typeof page>) =>
  content.blocks
    .flatMap((block) => (block.type === "links" ? block.items : []))
    .map((i) => i.linkId[0])
    .join("");

test("newest orders by link creation; ties and unknown times stay stable", () => {
  const content = page(
    "newest",
    ["a", "e", "b", "c", "d"].map((l) => item(l)),
  );
  expect(order(orderBioLinks(content, lookup))).toBe("bdcae");
});

test("added orders by when each link joined the section", () => {
  const content = page("added", [
    item("a", { addedAt: "2026-05-01T00:00:00.000Z" }),
    item("b"),
    item("c", { addedAt: "2026-06-01T00:00:00.000Z" }),
  ]);
  expect(order(orderBioLinks(content, lookup))).toBe("cab");
});

test("title sorts A–Z by the shown title, case-insensitive and numeric", () => {
  const content = page("title", [
    item("a"),
    item("b"),
    item("c"),
    item("d", { title: "aardvark" }),
  ]);
  expect(order(orderBioLinks(content, lookup))).toBe("dcba");
});

test("manual and already ordered sections come back unchanged", () => {
  const manual = page("manual", [item("a"), item("b")]);
  expect(orderBioLinks(manual, lookup)).toBe(manual);
  const ordered = page("newest", [item("b"), item("c"), item("a")]);
  expect(orderBioLinks(ordered, lookup)).toBe(ordered);
});

test("stamping keeps append order, so the latest addition sorts first once", () => {
  const stamped = stampBioLinksAdded([
    item("a"),
    item("b", { addedAt: "2026-06-01T00:00:00.000Z" }),
    item("c"),
  ]);
  const content = page("added", stamped);
  const sorted = orderBioLinks(content, lookup);
  expect(order(sorted)).toBe("bca");
  expect(orderBioLinks(sorted, lookup)).toBe(sorted);
  const already = stampBioLinksAdded(stamped);
  expect(already).toBe(stamped);
});
