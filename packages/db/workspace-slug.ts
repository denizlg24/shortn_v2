import type { Document } from "mongodb";

// Shared by M2 and signup so a legacy-created user and a new signup get the
// same personal workspace slug whichever path runs first.
export function personalWorkspaceSlug(user: Document): string {
  const text = (value: unknown) =>
    typeof value === "string" ? value : undefined;
  const source =
    text(user.username) ??
    text(user.name) ??
    text(user.email)?.split("@")[0] ??
    "workspace";
  const base =
    source
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "workspace";
  return `${base}-${String(user._id ?? user.id).slice(-6)}`;
}
