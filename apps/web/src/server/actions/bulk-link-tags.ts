"use server";
import { bulkLinkTags, bulkLinkTagsSchema, can } from "@shortn/core";
import { revalidatePath } from "next/cache";
import { serviceContext } from "../context";
import { readBulkTagSelection } from "../bulk-link-tags";
export async function bulkLinkTagsAction(
  workspace: string,
  ref: string,
  mode: unknown,
  tags: unknown,
) {
  const ctx = await serviceContext(workspace);
  if (!can(ctx.actor, "resource.update"))
    return { error: "forbidden" as const };
  const ids = await readBulkTagSelection(ctx, ref);
  if (!ids.length) return { error: "not_found" as const };
  const parsed = bulkLinkTagsSchema.safeParse({ ids, mode, tags });
  if (!parsed.success) return { error: "invalid_input" as const };
  const result = await bulkLinkTags(ctx, parsed.data);
  if (!result.ok) return { error: result.error };
  revalidatePath(`/${workspace}/links`);
  return { value: result.value };
}
