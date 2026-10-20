import {
  isCreatedWindow,
  isLinkSort,
  isLinkStatus,
  isObjectIdHex,
  linkDomainFilter,
  type CreatedWindow,
  type LinkSort,
  type LinkStatusFilter,
  type TagMatchMode,
} from "@shortn/core/links-filters";
import { utcDay } from "../page/created-range";

export type CreatedFilter =
  | { kind: "window"; window: CreatedWindow }
  | { kind: "custom"; from: string | null; to: string | null };

/** Everything the link toolbar controls; the URL (or local state) is the source of truth. */
export interface LinkFilterState {
  search: string;
  tags: string[];
  tagMode: TagMatchMode;
  untagged: boolean;
  status: LinkStatusFilter | null;
  domain: string | null;
  campaign: string | null;
  created: CreatedFilter | null;
  sort: LinkSort;
  group: "tag" | null;
}

export const facets = [
  "tags",
  "status",
  "domain",
  "campaign",
  "created",
] as const;
export type Facet = (typeof facets)[number];

export const emptyLinkFilters: LinkFilterState = {
  search: "",
  tags: [],
  tagMode: "any",
  untagged: false,
  status: null,
  domain: null,
  campaign: null,
  created: null,
  sort: "newest",
  group: null,
};

interface Params {
  get(name: string): string | null;
  getAll(name: string): string[];
}

export function linkFiltersFrom(params: Params): LinkFilterState {
  const tags = [
    ...new Set(
      params
        .getAll("tag")
        .map((tag) => tag.slice(0, 64))
        .filter(Boolean),
    ),
  ].slice(0, 50);
  const tagMode: TagMatchMode =
    params.get("tagMode") === "all" && tags.length ? "all" : "any";
  const status = params.get("status");
  const sort = params.get("sort");
  const campaign = params.get("campaign");
  const created = params.get("created");
  return {
    search: (params.get("q") ?? "").slice(0, 200),
    tags,
    tagMode,
    untagged: tagMode === "any" && params.get("untagged") === "1",
    status: isLinkStatus(status) ? status : null,
    domain: linkDomainFilter(params.get("domain")),
    campaign: isObjectIdHex(campaign) ? campaign.toLowerCase() : null,
    created: isCreatedWindow(created)
      ? { kind: "window", window: created }
      : created === "custom"
        ? {
            kind: "custom",
            from: utcDay(params.get("from")) ? params.get("from") : null,
            to: utcDay(params.get("to")) ? params.get("to") : null,
          }
        : null,
    sort: isLinkSort(sort) ? sort : "newest",
    group: params.get("group") === "tag" ? "tag" : null,
  };
}

const ownedKeys = [
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
  "group",
  "page",
] as const;

/** Writes the state over `base`, keeping page-owned params (trash, selectionRef…). */
export function linkFiltersSearch(
  state: LinkFilterState,
  base: URLSearchParams = new URLSearchParams(),
) {
  const next = new URLSearchParams(base);
  for (const key of ownedKeys) next.delete(key);
  const search = state.search.trim();
  if (search) next.set("q", search);
  for (const tag of state.tags) next.append("tag", tag);
  if (state.tagMode === "all" && state.tags.length) next.set("tagMode", "all");
  else if (state.untagged) next.set("untagged", "1");
  if (state.status) next.set("status", state.status);
  if (state.domain) next.set("domain", state.domain);
  if (state.campaign) next.set("campaign", state.campaign);
  if (state.created?.kind === "window")
    next.set("created", state.created.window);
  else if (state.created) {
    next.set("created", "custom");
    if (state.created.from) next.set("from", state.created.from);
    if (state.created.to) next.set("to", state.created.to);
  }
  if (state.sort !== "newest") next.set("sort", state.sort);
  if (state.group) next.set("group", state.group);
  return next;
}

export function isFacetActive(state: LinkFilterState, facet: Facet) {
  switch (facet) {
    case "tags":
      return state.tags.length > 0 || state.untagged;
    case "status":
      return state.status !== null;
    case "domain":
      return state.domain !== null;
    case "campaign":
      return state.campaign !== null;
    case "created":
      return state.created !== null;
  }
}

export function clearFacet(
  state: LinkFilterState,
  facet: Facet,
): LinkFilterState {
  switch (facet) {
    case "tags":
      return { ...state, tags: [], tagMode: "any", untagged: false };
    case "status":
      return { ...state, status: null };
    case "domain":
      return { ...state, domain: null };
    case "campaign":
      return { ...state, campaign: null };
    case "created":
      return { ...state, created: null };
  }
}

/** Drops filters but keeps how the list is displayed (sort, grouping). */
export const clearLinkFilters = (state: LinkFilterState): LinkFilterState => ({
  ...emptyLinkFilters,
  sort: state.sort,
  group: state.group,
});

export const hasLinkFilters = (state: LinkFilterState) =>
  Boolean(state.search.trim()) ||
  facets.some((facet) => isFacetActive(state, facet));
