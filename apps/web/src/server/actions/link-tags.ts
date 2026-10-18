"use server";
import { cursorTags } from "@shortn/core";
import { serviceContext } from "../context";
export async function searchLinkTagsAction(workspace: string, search: string) {
  const ctx = await serviceContext(workspace);
  if (typeof search !== "string" || search.length > 200)
    return { items: [], error: "invalid_input" };
  try {
    const result = await cursorTags(ctx, { search, limit: 50 });
    return {
      items: result.items.map((tag) => ({ value: tag.name, label: tag.name })),
    };
  } catch {
    return { items: [], error: "failed" };
  }
}
