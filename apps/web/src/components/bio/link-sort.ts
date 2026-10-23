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

/**
 * Moves `from` to `to`'s place among `among` only: the other links keep
 * their slots, so a drag in a filtered list never shifts what's hidden.
 */
export function moveAmong<T extends { id: string }>(
  items: readonly T[],
  among: readonly string[],
  from: string,
  to: string,
): T[] {
  const order = [...among];
  const at = order.indexOf(from),
    target = order.indexOf(to);
  if (at < 0 || target < 0) return [...items];
  order.splice(target, 0, ...order.splice(at, 1));
  const members = new Set(among);
  const byId = new Map(items.map((item) => [item.id, item]));
  let next = 0;
  return items.map((item) =>
    members.has(item.id) ? (byId.get(order[next++]!) ?? item) : item,
  );
}
