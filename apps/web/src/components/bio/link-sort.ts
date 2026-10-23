export const linkSorts = [
  "titleAsc",
  "titleDesc",
  "highlightedFirst",
  "hiddenLast",
  "reverse",
] as const;
export type LinkSort = (typeof linkSorts)[number];
/** Stable, so links that tie keep their current relative order. */
export function sortLinks<T extends { visible: boolean; highlight: boolean }>(
  items: readonly T[],
  order: LinkSort,
  titleOf: (item: T) => string,
): T[] {
  if (order === "reverse") return [...items].reverse();
  const collator = new Intl.Collator(undefined, {
    sensitivity: "base",
    numeric: true,
  });
  const compare: (a: T, b: T) => number =
    order === "titleAsc"
      ? (a, b) => collator.compare(titleOf(a), titleOf(b))
      : order === "titleDesc"
        ? (a, b) => collator.compare(titleOf(b), titleOf(a))
        : order === "highlightedFirst"
          ? (a, b) => Number(b.highlight) - Number(a.highlight)
          : (a, b) => Number(!a.visible) - Number(!b.visible);
  return [...items].sort(compare);
}
