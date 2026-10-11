import type { Metadata } from "next";
import { getCampaign } from "@shortn/core";
import { serviceContext } from "@/server/context";
import { campaignsAccess } from "@/server/campaign-page";
import { CampaignsGate } from "@/components/campaigns/campaigns-gate";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { BreakdownView } from "@/components/analytics/breakdown-view";
import { isBreakdownSlug } from "@/components/analytics/breakdowns";
import { parseQuery, queryString } from "@/components/analytics/query";
import { Page } from "@/components/page/page";
import { gateOf } from "@/lib/plan-features";
import { linkOptions } from "@/server/analytics-page";
import { featureAccess, planFeatures } from "@/server/plan";

export async function generateMetadata({
  params,
}: PageProps<"/[workspace]/analytics/[dimension]">): Promise<Metadata> {
  const { dimension } = await params;
  const t = await getTranslations("analytics");
  return {
    title: isBreakdownSlug(dimension)
      ? `${t(`breakdowns.${dimension}.title`)} · ${t("title")}`
      : t("title"),
  };
}

export default async function BreakdownPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/analytics/[dimension]">) {
  const { workspace, dimension } = await params;
  if (!isBreakdownSlug(dimension)) notFound();
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(await searchParams))
    if (typeof value === "string") search.set(name, value);
  const campaignId = search.get("campaign");
  if (campaignId) {
    const access = await campaignsAccess(workspace);
    if (!access.allowed) return <CampaignsGate plan={access.plan} />;
  }
  const campaign = campaignId
    ? await getCampaign(await serviceContext(workspace), campaignId)
    : null;
  if (campaignId && !campaign) notFound();
  const overviewHref = campaign
    ? `/${workspace}/campaigns/${campaign.id}/analytics`
    : `/${workspace}/analytics`;
  const [t, features, csv, links] = await Promise.all([
    getTranslations("analytics"),
    planFeatures(workspace),
    featureAccess(workspace, campaign ? "campaignExport" : "csvExport"),
    linkOptions(workspace, search.get("link") ?? undefined),
  ]);
  const title = t(`breakdowns.${dimension}.title`);
  return (
    <Page
      crumbs={[
        ...(campaign
          ? [
              {
                label: campaign.title,
                href: `/${workspace}/campaigns/${campaign.id}`,
              },
            ]
          : []),
        {
          label: t("title"),
          href: `${overviewHref}${queryString(parseQuery(search))}`,
        },
        { label: title },
      ]}
      title={title}
      description={t(`breakdowns.${dimension}.description`)}
    >
      <BreakdownView
        workspace={workspace}
        scope={
          campaign
            ? { type: "campaign", id: campaign.id }
            : { type: "workspace" }
        }
        slug={dimension}
        links={links}
        breakdownGate={gateOf(features.analyticsBreakdowns)}
        csvGate={gateOf(csv)}
      />
    </Page>
  );
}
