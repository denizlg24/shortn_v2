"use server";

import { listLinks } from "@shortn/core";
import { z } from "zod";
import { serviceContext } from "../context";

const filters = z.object({
  search: z.string().max(200),
  tags: z.array(z.string().max(48)).max(50),
});

export async function searchLinkLibraryAction(
  workspace: string,
  input: unknown,
) {
  const parsed = filters
    .extend({ page: z.number().int().min(1).max(10000) })
    .parse(input);
  return listLinks(await serviceContext(workspace), {
    ...parsed,
    limit: 20,
    includeHidden: true,
  });
}

/** Bulk selection is bounded independently of the workspace library's size. */
export async function selectLinkLibraryAction(
  workspace: string,
  input: unknown,
) {
  const parsed = filters
    .extend({
      excluded: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(500),
      capacity: z.number().int().min(0).max(500),
    })
    .parse(input);
  const ctx = await serviceContext(workspace),
    excluded = new Set(parsed.excluded);
  const selected: Awaited<ReturnType<typeof searchLinkLibraryAction>>["links"] =
    [];
  for (let page = 1; page <= 5 && selected.length < parsed.capacity; page++) {
    const result = await listLinks(ctx, {
      search: parsed.search,
      tags: parsed.tags,
      page,
      limit: 200,
      includeHidden: true,
    });
    for (const link of result.links) {
      if (!excluded.has(link.id)) selected.push(link);
      if (selected.length >= parsed.capacity) break;
    }
    if (page >= (result.pages ?? 1)) break;
  }
  return selected;
}
