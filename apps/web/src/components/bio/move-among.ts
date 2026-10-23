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
