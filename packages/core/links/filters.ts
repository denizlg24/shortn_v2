// Dependency-free so client filter bars can import it.
export const linkStatuses = ["password", "interstitial", "disabled"] as const;
export type LinkStatusFilter = (typeof linkStatuses)[number];
export const linkSorts = ["newest", "oldest", "clicks"] as const;
export type LinkSort = (typeof linkSorts)[number];
export const createdWindows = ["7", "30", "90", "365"] as const;
export type CreatedWindow = (typeof createdWindows)[number];

const oneOf =
  <T extends string>(list: readonly T[]) =>
  (value: unknown): value is T =>
    typeof value === "string" && (list as readonly string[]).includes(value);

export const isLinkStatus = oneOf(linkStatuses);
export const isLinkSort = oneOf(linkSorts);
export const isCreatedWindow = oneOf(createdWindows);
