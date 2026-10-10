import type { Role } from "@shortn/core";
import { copyText } from "@shortn/ui";

export interface Viewer {
  userId: string;
  role: Role;
}

export const canWrite = (viewer: Viewer) => viewer.role !== "viewer";

// Mirrors can(actor, "resource.delete", link) in @shortn/core (05 §Roles),
// which the client can't import: members delete only links they created.
export const canDeleteLink = (
  viewer: Viewer,
  link: { createdBy: string | null },
) =>
  viewer.role === "owner" ||
  viewer.role === "admin" ||
  (viewer.role === "member" && link.createdBy === viewer.userId);

/**
 * Starts the clipboard write inside the user gesture and fills it when the
 * text resolves; Safari rejects writes that start after an await.
 */
export async function copyWhenReady(text: Promise<string>): Promise<boolean> {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": text.then(
            (value) => new Blob([value], { type: "text/plain" }),
          ),
        }),
      ]);
      return true;
    } catch {
      // Falls through to the plain write once the text is known.
    }
  }
  try {
    return await copyText(await text);
  } catch {
    return false;
  }
}
