import type { LinkExportFilter, ServiceContext } from "@shortn/core";
import { linkFacetContext } from "@/server/link-facets";
import { facets as allFacets } from "./state";
import { UrlLinkToolbar } from "./url-toolbar";

/** Server-prepared URL toolbar: facets this workspace can use and the active campaign's title. */
export async function LinkFiltersBar({
  ctx,
  workspace,
  filter,
  total,
  grouping = false,
  counts = true,
  sorts = true,
}: {
  ctx: ServiceContext;
  workspace: string;
  /** The parsed view; an active filter always keeps its facet visible. */
  filter: LinkExportFilter;
  total?: number | null | undefined;
  grouping?: boolean;
  counts?: boolean;
  sorts?: boolean;
}) {
  const context = await linkFacetContext(ctx, filter.campaign);
  const facets = allFacets.filter(
    (facet) =>
      (facet !== "campaign" || context.campaigns || filter.campaign) &&
      (facet !== "domain" || context.domains.length > 1 || filter.domain),
  );
  return (
    <UrlLinkToolbar
      workspace={workspace}
      facets={facets}
      domains={context.domains}
      campaignLabel={context.campaignLabel}
      manageTagsHref={`/${workspace}/tags`}
      total={total}
      grouping={grouping}
      counts={counts}
      sorts={sorts}
    />
  );
}
