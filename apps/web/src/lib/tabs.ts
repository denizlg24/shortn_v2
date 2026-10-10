/** Reads a `?tab=`-style value on the server, falling back to the first option. */
export function tabFrom<T extends string>(
  tabs: readonly [T, ...T[]],
  value: string | string[] | undefined,
): T {
  return tabs.find((tab) => tab === value) ?? tabs[0];
}
