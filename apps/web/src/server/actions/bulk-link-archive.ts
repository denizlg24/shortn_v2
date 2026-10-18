"use server";
import { revalidatePath } from "next/cache";
import { can, setLinksArchived } from "@shortn/core";
import { serviceContext } from "../context";
import { readBulkArchiveSelection } from "../bulk-link-archive";
export async function bulkLinkArchiveAction(
  workspace: string,
  ref: string,
  archived: boolean,
) {
  const ctx = await serviceContext(workspace);
  if (!can(ctx.actor, "resource.update"))
    return { error: "forbidden" as const };
  const ids = await readBulkArchiveSelection(ctx, ref);
  if (!ids.length) return { error: "not_found" as const };
  const result = await setLinksArchived(ctx, ids, archived);
  if (!result.ok) return { error: result.error };
  revalidatePath(`/${workspace}/links`);
  return { value: result.value };
}
