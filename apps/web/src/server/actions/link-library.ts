"use server";

import { listLinks, tagColorsByName, type TagColor } from "@shortn/core";
import { z } from "zod";
import { serviceContext } from "../context";
import { linkListQueryOf, linksViewQuery } from "../link-list-query";
import { requestTime } from "../time";

// The picker posts its toolbar state as a Links view query string, so it is
// validated and bounded exactly like the Links page URL.
const view = z.object({ query: z.string().max(4000) });
const filterOf = (query: string) => {
  const { filter } = linksViewQuery(linkListQueryOf(query), requestTime());
  return { ...filter, trash: false, archived: false, includeHidden: true };
};

export async function searchLinkLibraryAction(
  workspace: string,
  input: unknown,
) {
  const parsed = view
    .extend({ page: z.number().int().min(1).max(10000) })
    .parse(input);
  const ctx = await serviceContext(workspace);
  const result = await listLinks(ctx, {
    ...filterOf(parsed.query),
    page: parsed.page,
    limit: 20,
  });
  const colors: Record<string, TagColor> = await tagColorsByName(
    ctx,
    result.links.flatMap((link) => link.tags.map((tag) => tag.name)),
  );
  return { ...result, colors };
}

/** Bulk selection is bounded independently of the workspace library's size. */
export async function selectLinkLibraryAction(
  workspace: string,
  input: unknown,
) {
  const parsed = view
    .extend({
      excluded: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(500),
      capacity: z.number().int().min(0).max(500),
    })
    .parse(input);
  const ctx = await serviceContext(workspace),
    excluded = new Set(parsed.excluded),
    filter = filterOf(parsed.query);
  const selected: Awaited<ReturnType<typeof listLinks>>["links"] = [];
  for (let page = 1; page <= 5 && selected.length < parsed.capacity; page++) {
    const result = await listLinks(ctx, { ...filter, page, limit: 200 });
    for (const link of result.links) {
      if (!excluded.has(link.id)) selected.push(link);
      if (selected.length >= parsed.capacity) break;
    }
    if (page >= (result.pages ?? 1)) break;
  }
  return selected;
}
