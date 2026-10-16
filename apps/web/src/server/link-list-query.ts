import { isLinkSort, isLinkStatus } from "@shortn/core/links-filters";
import { createdBounds } from "@/components/page/created-range";
import type { LinkExportFilter } from "@shortn/core";

export type LinkListQuery = Record<string, string | string[] | undefined>;
export function linksViewQuery(query: LinkListQuery, now: Date) {
  const one = (value: string | string[] | undefined) =>
    typeof value === "string" ? value : undefined;
  const search = one(query.q)?.slice(0, 200),
    status = one(query.status),
    sort = one(query.sort),
    trash = one(query.trash) === "1";
  const tags = (
    Array.isArray(query.tag) ? query.tag : query.tag ? [query.tag] : []
  )
    .map((tag) => tag.slice(0, 64))
    .slice(0, 50);
  const dates = new URLSearchParams();
  for (const key of ["created", "from", "to"]) {
    const value = one(query[key]);
    if (value) dates.set(key, value);
  }
  const dateBounds = createdBounds(dates, now);
  const filter: LinkExportFilter = {
    trash,
    ...(one(query.archived) === "1" && !trash ? { archived: true } : {}),
    sort: isLinkSort(sort) ? sort : "newest",
    ...dateBounds,
    ...(search ? { search } : {}),
    ...(tags.length ? { tags } : {}),
    ...(isLinkStatus(status) ? { status } : {}),
  };
  const requested = Number(one(query.page)),
    page = Number.isSafeInteger(requested) && requested > 0 ? requested : 1;
  return { filter, tags, search, status, trash, dateBounds, page };
}
export function linksViewSearch(query: LinkListQuery) {
  const params = new URLSearchParams();
  for (const key of [
    "q",
    "tag",
    "status",
    "created",
    "from",
    "to",
    "sort",
    "trash",
    "archived",
    "group",
  ]) {
    const value = query[key];
    for (const item of Array.isArray(value) ? value : value ? [value] : [])
      params.append(key, item);
  }
  return params.toString();
}
