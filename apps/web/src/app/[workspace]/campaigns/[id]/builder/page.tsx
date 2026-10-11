import { getLink } from "@shortn/core";
import { can } from "@shortn/core/authz";
import { getTranslations } from "next-intl/server";
import { CampaignsGate } from "@/components/campaigns/campaigns-gate";
import { UtmBuilder } from "@/components/campaigns/utm-builder";
import { Page } from "@/components/page/page";
import { saveVariantPageAction } from "@/server/actions/campaign-pages";
import {
  campaignsAccess,
  campaignTabs,
  loadCampaign,
} from "@/server/campaign-page";
import { objectIds } from "@/server/form-data";

export async function generateMetadata() {
  const t = await getTranslations("campaigns.tabs");
  return { title: t("builder") };
}

export default async function CampaignBuilderPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/campaigns/[id]/builder">) {
  const { workspace, id } = await params;
  const { link: linkParam } = await searchParams;
  const access = await campaignsAccess(workspace);
  if (!access.allowed) return <CampaignsGate plan={access.plan} />;
  const t = await getTranslations("campaigns");
  const { ctx, campaign, links } = await loadCampaign(workspace, id);
  const [linkId] = objectIds([linkParam]);
  const initialLink = linkId
    ? (links.find((link) => link.id === linkId) ?? (await getLink(ctx, linkId)))
    : (links[0] ?? null);
  const base = `/${workspace}/campaigns/${id}`;
  const editable = can(ctx.actor, "resource.update");
  return (
    <Page
      crumbs={[
        { label: t("list.title"), href: `/${workspace}/campaigns` },
        { label: campaign.title, href: base },
        { label: t("tabs.builder") },
      ]}
      title={campaign.title}
      description={t("builder.description")}
      tabs={campaignTabs(workspace, id, editable, (key) => t(`tabs.${key}`))}
      tabsLabel={t("tabs.label")}
      width="form"
    >
      <UtmBuilder
        workspace={workspace}
        campaign={{ title: campaign.title, utmDefaults: campaign.utmDefaults }}
        links={links}
        initialLink={initialLink}
        canSave={editable}
        action={saveVariantPageAction.bind(null, workspace, id)}
        cancelHref={base}
      />
    </Page>
  );
}
