// Dependency-free so client components can import it. Each key maps to a
// `--tag-<key>` design token; tags without a stored colour render as slate.
export const tagColors = [
  "slate",
  "blue",
  "teal",
  "violet",
  "magenta",
  "ochre",
  "rust",
] as const;
export type TagColor = (typeof tagColors)[number];
export const defaultTagColor: TagColor = "slate";

export const isTagColor = (value: unknown): value is TagColor =>
  typeof value === "string" && (tagColors as readonly string[]).includes(value);

/** Stored colours outside the palette (legacy or hand-edited) fall back to slate. */
export const tagColorOf = (value: unknown): TagColor =>
  isTagColor(value) ? value : defaultTagColor;

export const tagSorts = ["name", "newest"] as const;
export type TagSort = (typeof tagSorts)[number];
export const isTagSort = (value: unknown): value is TagSort =>
  typeof value === "string" && (tagSorts as readonly string[]).includes(value);
