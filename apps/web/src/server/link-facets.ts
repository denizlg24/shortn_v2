import "server-only";
import { getCampaign, listDomains, type ServiceContext } from "@shortn/core";
import { hasFeature, loadEntitlements } from "@shortn/billing";

/** Hostnames links can live on: the platform domain, then workspace link domains. */
export async function linkDomainOptions(ctx: ServiceContext) {
  const domains = await listDomains(ctx);
  return [
    ...new Set([
      ctx.linkDomain,
      ...domains
        .filter((domain) => domain.kind !== "bio" && !domain.removing)
        .map((domain) => domain.hostname.toLowerCase()),
    ]),
  ];
}

export async function campaignFacetEnabled(ctx: ServiceContext) {
  return hasFeature(
    await loadEntitlements(ctx.db, ctx.workspace._id),
    "campaigns",
  );
}

/** What the server knows up front so the toolbar renders without a round trip. */
export async function linkFacetContext(
  ctx: ServiceContext,
  campaign: string | undefined,
) {
  const [domains, campaigns, title] = await Promise.all([
    linkDomainOptions(ctx),
    campaignFacetEnabled(ctx),
    campaign ? getCampaign(ctx, campaign) : null,
  ]);
  return {
    domains,
    campaigns,
    campaignLabel: title?.title ?? null,
  };
}
