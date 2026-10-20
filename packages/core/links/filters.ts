// Dependency-free so client filter bars can import it.
export const linkStatuses = ["password", "interstitial", "disabled"] as const;
export type LinkStatusFilter = (typeof linkStatuses)[number];
export const linkSorts = ["newest", "oldest", "clicks"] as const;
export type LinkSort = (typeof linkSorts)[number];
export const createdWindows = ["7", "30", "90", "365"] as const;
export type CreatedWindow = (typeof createdWindows)[number];
/** How several selected tags combine: links carrying any of them, or all. */
export const tagMatchModes = ["any", "all"] as const;
export type TagMatchMode = (typeof tagMatchModes)[number];

const oneOf =
  <T extends string>(list: readonly T[]) =>
  (value: unknown): value is T =>
    typeof value === "string" && (list as readonly string[]).includes(value);

export const isLinkStatus = oneOf(linkStatuses);
export const isLinkSort = oneOf(linkSorts);
export const isCreatedWindow = oneOf(createdWindows);
export const isTagMatchMode = oneOf(tagMatchModes);

// Development link domains carry a port (localhost:3102); equality is all the
// filter needs, so the shape is only bounded, not resolved.
const hostname = /^[a-z\d](?:[a-z\d.-]{0,251}[a-z\d])?(?::\d{1,5})?$/;
/** A lowercase link hostname, or null when the value cannot be one. */
export function linkDomainFilter(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const domain = value.trim().toLowerCase();
  return hostname.test(domain) ? domain : null;
}
export const isObjectIdHex = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
