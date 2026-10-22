import type { Documents } from "@shortn/db";

/** A staff takedown freezes the link for its owner; only delete remains
 * (23 §3.3). */
export const isTakenDown = (link: Pick<Documents["links"], "moderation">) =>
  Boolean(link.moderation);
