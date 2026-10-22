"use server";

import {
  pageCampaigns,
  pageTags,
  pageTagUsage,
  untaggedLinkCount,
  type TagColor,
} from "@shortn/core";
import { z } from "zod";
import { serviceContext } from "../context";
import { campaignFacetEnabled, linkDomainOptions } from "../link-facets";
import { linkListQueryOf, linksViewQuery } from "../link-list-query";
import { requestTime } from "../time";

const slug = z.string().min(1).max(64);
const tagFacetInput = z.object({
  search: z.string().max(200),
  page: z.number().int().min(1).max(10_000),
  // The current view's query string; counts describe that view.
  view: z.string().max(4000).nullable(),
});

export interface TagFacetPage {
  items: { name: string; color: TagColor; links: number | null }[];
  page: number;
  more: boolean;
  /** Links in the view without tags; only on the first unsearched page. */
  untagged: number | null;
}

/**
 * One page of the Tag facet. Without a search, tags rank by use in the view
 * so the common ones come first; a search reaches every tag by name.
 */
export async function tagFacetAction(
  workspace: string,
  input: z.input<typeof tagFacetInput>,
): Promise<TagFacetPage | null> {
  const parsed = tagFacetInput.safeParse(input);
  if (!slug.safeParse(workspace).success || !parsed.success) return null;
  const ctx = await serviceContext(workspace);
  const { search, page, view } = parsed.data;
  // Review pages pass no view: rank by the active library but hide numbers.
  const scope = linksViewQuery(
    linkListQueryOf(view ?? ""),
    requestTime(),
  ).filter;
  const counted = view !== null;
  if (search.trim()) {
    const result = await pageTags(ctx, {
      search,
      page,
      limit: 40,
      counts: counted ? scope : false,
    });
    return {
      items: result.items.map(({ name, color, links }) => ({
        name,
        color,
        links,
      })),
      page: result.page,
      more: result.page < result.pages,
      untagged: null,
    };
  }
  const [result, untagged] = await Promise.all([
    pageTagUsage(ctx, scope, { page, limit: 40 }),
    counted && page === 1 ? untaggedLinkCount(ctx, scope) : null,
  ]);
  return {
    items: result.items.map((item) => ({
      ...item,
      links: counted ? item.links : null,
    })),
    page: result.page,
    more: result.more,
    untagged,
  };
}

const campaignFacetInput = z.object({
  search: z.string().max(200),
  cursor: z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .nullable(),
});

export interface CampaignFacetPage {
  items: { id: string; title: string; links: number }[];
  nextCursor: string | null;
}

export async function campaignFacetAction(
  workspace: string,
  input: z.input<typeof campaignFacetInput>,
): Promise<CampaignFacetPage | null> {
  const parsed = campaignFacetInput.safeParse(input);
  if (!slug.safeParse(workspace).success || !parsed.success) return null;
  const ctx = await serviceContext(workspace);
  if (!(await campaignFacetEnabled(ctx)))
    return { items: [], nextCursor: null };
  const result = await pageCampaigns(ctx, {
    search: parsed.data.search,
    cursor: parsed.data.cursor ?? undefined,
    limit: 40,
  });
  return {
    items: result.items.map((campaign) => ({
      id: campaign.id,
      title: campaign.title,
      links: campaign.linkCount,
    })),
    nextCursor: result.nextCursor,
  };
}

/** Facet setup for in-page selectors that have no server-rendered page around them. */
export async function linkFacetOptionsAction(workspace: string) {
  if (!slug.safeParse(workspace).success)
    return { domains: [], campaigns: false };
  const ctx = await serviceContext(workspace);
  const [domains, campaigns] = await Promise.all([
    linkDomainOptions(ctx),
    campaignFacetEnabled(ctx),
  ]);
  return { domains, campaigns };
}
