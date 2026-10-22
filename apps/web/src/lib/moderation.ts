import { moderationCategories } from "@shortn/db";

type ModerationCategory = (typeof moderationCategories)[number];

/** The translation key for a takedown category; unknown values read as
 * "other" rather than exposing a raw code. */
export const moderationCategoryKey = (
  value: string | null | undefined,
): ModerationCategory =>
  moderationCategories.find((category) => category === value) ?? "other";
