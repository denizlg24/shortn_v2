import {
  isLinkSort,
  isLinkStatus,
  isObjectIdHex,
  linkDomainFilter,
} from "@shortn/core/links-filters";
import { createdBounds } from "@/components/page/created-range";
import type { LinkExportFilter } from "@shortn/core";

export type LinkListQuery = Record<string, string | string[] | undefined>;

/**
 * URL parameters of a filtered Links view. `untagged=1` adds links without
 * tags to the selected tags; `tagMode=all` requires every selected tag
 * instead (and ignores `untagged`).
 */
export const linkViewParams = [
  "q",
  "tag",
  "tagMode",
  "untagged",
  "status",
  "domain",
  "campaign",
  "created",
  "from",
  "to",
  "sort",
  "trash",
  "archived",
  "group",
] as const;

export function linksViewQuery(query: LinkListQuery, now: Date) {
  const one = (value: string | string[] | undefined) =>
    typeof value === "string" ? value : undefined;
  const search = one(query.q)?.slice(0, 200),
    status = one(query.status),
    sort = one(query.sort),
    trash = one(query.trash) === "1",
    domain = linkDomainFilter(one(query.domain)?.slice(0, 253)),
    campaign = one(query.campaign);
  const tags = [
    ...new Set(
      (Array.isArray(query.tag) ? query.tag : query.tag ? [query.tag] : [])
        .map((tag) => tag.slice(0, 64))
        .filter(Boolean),
    ),
  ].slice(0, 50);
  const tagMode =
    one(query.tagMode) === "all" && tags.length ? ("all" as const) : undefined;
  const untagged = !tagMode && one(query.untagged) === "1";
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
    ...(tagMode ? { tagMode } : {}),
    ...(untagged ? { untagged } : {}),
    ...(isLinkStatus(status) ? { status } : {}),
    ...(domain ? { domain } : {}),
    ...(isObjectIdHex(campaign) ? { campaign: campaign.toLowerCase() } : {}),
  };
  const requested = Number(one(query.page)),
    page = Number.isSafeInteger(requested) && requested > 0 ? requested : 1;
  const filtered = Boolean(
    search ||
    tags.length ||
    untagged ||
    filter.status ||
    filter.domain ||
    filter.campaign ||
    Object.keys(dateBounds).length,
  );
  return {
    filter,
    tags,
    search,
    status,
    trash,
    dateBounds,
    page,
    filtered,
  };
}
export function linksViewSearch(query: LinkListQuery) {
  const params = new URLSearchParams();
  for (const key of linkViewParams) {
    const value = query[key];
    for (const item of Array.isArray(value) ? value : value ? [value] : [])
      params.append(key, item);
  }
  return params.toString();
}

/** Repeated keys become arrays, matching Next's parsed `searchParams`. */
export function linkListQueryOf(search: string): LinkListQuery {
  const query: LinkListQuery = {};
  for (const [key, value] of new URLSearchParams(search)) {
    const current = query[key];
    query[key] =
      current === undefined
        ? value
        : Array.isArray(current)
          ? [...current, value]
          : [current, value];
  }
  return query;
}
