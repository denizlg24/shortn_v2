import { can } from "@shortn/core/authz";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { CampaignForm } from "@/components/campaigns/campaign-form";
import { CampaignsGate } from "@/components/campaigns/campaigns-gate";
import { Page } from "@/components/page/page";
import { updateCampaignPageAction } from "@/server/actions/campaign-pages";
import {
  campaignsAccess,
  campaignTabs,
  loadCampaign,
} from "@/server/campaign-page";

export async function generateMetadata() {
  const t = await getTranslations("campaigns.tabs");
  return { title: t("edit") };
}

export default async function EditCampaignPage({
  params,
}: PageProps<"/[workspace]/campaigns/[id]/edit">) {
  const { workspace, id } = await params;
  const access = await campaignsAccess(workspace);
  if (!access.allowed) return <CampaignsGate plan={access.plan} />;
  const t = await getTranslations("campaigns");
  const { ctx, campaign } = await loadCampaign(workspace, id);
  const base = `/${workspace}/campaigns/${id}`;
  if (!can(ctx.actor, "resource.update")) redirect(base);
  return (
    <Page
      crumbs={[
        { label: t("list.title"), href: `/${workspace}/campaigns` },
        { label: campaign.title, href: base },
        { label: t("tabs.edit") },
      ]}
      title={campaign.title}
      description={t("form.editDescription")}
      tabs={campaignTabs(workspace, id, true, (key) => t(`tabs.${key}`))}
      tabsLabel={t("tabs.label")}
      width="form"
    >
      <CampaignForm
        mode="edit"
        initial={{
          title: campaign.title,
          description: campaign.description ?? "",
          utmDefaults: campaign.utmDefaults,
        }}
        action={updateCampaignPageAction.bind(null, workspace, id)}
        cancelHref={base}
      />
    </Page>
  );
}
