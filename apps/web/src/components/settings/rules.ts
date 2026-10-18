// packages/core enforces the same pattern (workspaceSlugPattern) and also
// rejects reserved words; it can't be imported here without pulling in Mongo.
const workspaceSlugPattern = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/;

export const workspaceNameMaxLength = 64;
export const workspaceSlugMaxLength = 48;

export const isWorkspaceSlug = (value: string) =>
  workspaceSlugPattern.test(value);

/** Lowercase while typing; spaces become hyphens so pasted names still fit. */
export const normalizeSlugInput = (value: string) =>
  value.toLowerCase().replace(/\s+/g, "-").slice(0, workspaceSlugMaxLength);

export const slugFromName = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, workspaceSlugMaxLength)
    .replace(/-+$/, "");
