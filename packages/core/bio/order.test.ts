import { expect, test } from "bun:test";
import {
  bioContentSchema,
  migratedBioContent,
  newBioLinksSection,
  orderBioLinks,
} from "./content";

// One letter per link: a–d have creation times, e has none.
const hex = (letter: string) => letter.repeat(24);
const item = (letter: string) => ({
  id: `item-${letter}`,
  linkId: hex(letter),
  title: "",
  visible: true,
  image: "",
  highlight: false,
});
const base = migratedBioContent({ title: "Order" });
const page = (order: "manual" | "newest", linkIds: string[]) =>
  bioContentSchema.parse({
    ...base,
    blocks: [
      base.blocks[0],
      { ...newBioLinksSection("links"), order, items: linkIds.map(item) },
    ],
  });
const created: Record<string, string> = {
  a: "2026-01-01T00:00:00.000Z",
  b: "2026-03-01T00:00:00.000Z",
  c: "2026-02-01T00:00:00.000Z",
  d: "2026-03-01T00:00:00.000Z",
};
const linkIdsOf = (content: ReturnType<typeof page>) =>
  content.blocks.flatMap((block) =>
    block.type === "links" ? block.items.map((i) => i.linkId[0]) : [],
  );

test("newest sections order by creation, ties and unknown times stay stable", () => {
  const content = page("newest", ["a", "e", "b", "c", "d"]);
  expect(linkIdsOf(orderBioLinks(content, (id) => created[id[0]!]))).toEqual([
    "b",
    "d",
    "c",
    "a",
    "e",
  ]);
});

test("manual sections and already ordered sections come back unchanged", () => {
  const manual = page("manual", ["a", "b"]);
  expect(orderBioLinks(manual, (id) => created[id[0]!])).toBe(manual);
  const ordered = page("newest", ["b", "c", "a"]);
  expect(orderBioLinks(ordered, (id) => created[id[0]!])).toBe(ordered);
});
