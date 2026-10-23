"use server";
import {
  bioVersions,
  listLinks,
  listTags,
  ownedBioDocument,
  publicBioFromDocument,
  changeBioHandle,
  publishBioDraft,
  readBioDraft,
  restoreBioVersion,
  saveBioDraft,
  shortenBioUrl,
} from "@shortn/core";
import { revalidatePath, revalidateTag } from "next/cache";
import { linkListQueryOf, linksViewQuery } from "../link-list-query";
import { requestTime } from "../time";
import { serviceContext } from "../context";

export async function saveBioContentAction(
  workspace: string,
  id: string,
  revision: number,
  content: unknown,
) {
  return saveBioDraft(await serviceContext(workspace), id, revision, content);
}
export async function publishBioContentAction(
  workspace: string,
  id: string,
  revision: number,
) {
  const result = await publishBioDraft(
    await serviceContext(workspace),
    id,
    revision,
  );
  if (result.ok) {
    revalidateTag(`bio:${id}`, { expire: 0 });
    revalidatePath(`/${workspace}/bio/${id}`);
  }
  return result;
}
export async function restoreBioContentAction(
  workspace: string,
  id: string,
  revision: number,
  version: number,
) {
  const ctx = await serviceContext(workspace);
  const result = await restoreBioVersion(ctx, id, revision, version);
  if (!result.ok) return result;
  const draft = await readBioDraft(ctx, id),
    page = await ownedBioDocument(ctx, id);
  const { env } = await import("../env");
  const resolved =
    draft && page
      ? await publicBioFromDocument(
          ctx.db,
          { ...page, publishedContent: draft.content },
          env().PUBLIC_ORIGIN,
          false,
        )
      : null;
  return { ok: true as const, draft, links: resolved?.links ?? {} };
}
export async function shortenBioContentAction(
  workspace: string,
  id: string,
  url: string,
  title: string,
) {
  return shortenBioUrl(await serviceContext(workspace), id, url, title);
}
export async function changeBioHandleAction(
  workspace: string,
  id: string,
  handle: string,
) {
  const result = await changeBioHandle(
    await serviceContext(workspace),
    id,
    handle,
  );
  if (result.ok) {
    revalidateTag(`bio:${id}`, { expire: 0 });
    revalidatePath(`/${workspace}/bio/${id}`);
  }
  return result;
}
export async function bioVersionListAction(workspace: string, id: string) {
  return bioVersions(await serviceContext(workspace), id);
}

export async function bioLinkFiltersAction(workspace: string) {
  return listTags(await serviceContext(workspace));
}

export async function searchBioLinksAction(
  workspace: string,
  search: string,
  page = 1,
  tags: string[] = [],
  query?: string,
) {
  const ctx = await serviceContext(workspace);
  const result = await listLinks(ctx, {
    ...(query !== undefined
      ? linksViewQuery(linkListQueryOf(query.slice(0, 4000)), requestTime())
          .filter
      : {}),
    ...(query === undefined
      ? {
          search: search.slice(0, 200),
          tags: tags.slice(0, 50).map((tag) => tag.slice(0, 64)),
        }
      : {}),
    page: Math.max(1, Math.min(10000, Math.floor(page) || 1)),
    limit: 20,
    trash: false,
    archived: false,
    includeHidden: true,
  });
  const { env } = await import("../env");
  return {
    pages: result.pages ?? 1,
    total: result.total ?? 0,
    links: result.links.map((link) => ({
      id: link.id,
      title: link.title || link.key,
      tags: link.tags.map((tag) => tag.name),
      href: `${new URL(env().PUBLIC_ORIGIN).protocol}//${link.domain}/${link.key}`,
      createdAt: link.createdAt,
    })),
  };
}

/** Bounded bulk selection; the library can be much larger than a section. */
export async function selectBioLinksAction(
  workspace: string,
  search: string,
  tags: string[],
  excluded: string[],
  capacity: number,
  query?: string,
) {
  const ctx = await serviceContext(workspace);
  const limit = Math.max(0, Math.min(1000, Math.floor(capacity) || 0));
  const skip = new Set(excluded.slice(0, 2000));
  const selected: Awaited<ReturnType<typeof searchBioLinksAction>>["links"] =
    [];
  const { env } = await import("../env");
  const protocol = new URL(env().PUBLIC_ORIGIN).protocol;
  // At most 3,000 records: 1,000 available slots plus up to 2,000 exclusions.
  for (let page = 1; page <= 15 && selected.length < limit; page++) {
    const result = await listLinks(ctx, {
      ...(query !== undefined
        ? linksViewQuery(linkListQueryOf(query.slice(0, 4000)), requestTime())
            .filter
        : {}),
      ...(query === undefined
        ? {
            search: search.slice(0, 200),
            tags: tags.slice(0, 50).map((tag) => tag.slice(0, 64)),
          }
        : {}),
      page,
      limit: 200,
      trash: false,
      archived: false,
      includeHidden: true,
    });
    for (const link of result.links) {
      if (!skip.has(link.id))
        selected.push({
          id: link.id,
          title: link.title || link.key,
          tags: link.tags.map((tag) => tag.name),
          href: `${protocol}//${link.domain}/${link.key}`,
          createdAt: link.createdAt,
        });
      if (selected.length >= limit) break;
    }
    if (page >= (result.pages ?? 1)) break;
  }
  return selected;
}
