import { can } from "@shortn/core/authz";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { CampaignsGate } from "@/components/campaigns/campaigns-gate";
import { DeleteCampaign } from "@/components/campaigns/delete-campaign";
import { Page } from "@/components/page/page";
import { campaignsAccess, loadCampaign } from "@/server/campaign-page";

export async function generateMetadata() {
  const t = await getTranslations("campaigns.deletePage");
  return { title: t("title") };
}

export default async function DeleteCampaignPage({
  params,
}: PageProps<"/[workspace]/campaigns/[id]/delete">) {
  const { workspace, id } = await params;
  const access = await campaignsAccess(workspace);
  if (!access.allowed) return <CampaignsGate plan={access.plan} />;
  const t = await getTranslations("campaigns");
  const { ctx, campaign, links } = await loadCampaign(workspace, id);
  const base = `/${workspace}/campaigns/${id}`;
  if (
    !can(ctx.actor, "resource.delete", {
      createdBy: campaign.createdBy ?? undefined,
    })
  )
    redirect(base);
  return (
    <Page
      crumbs={[
        { label: t("list.title"), href: `/${workspace}/campaigns` },
        { label: campaign.title, href: base },
        { label: t("deletePage.title") },
      ]}
      title={t("deletePage.title")}
      description={t("deletePage.description")}
      width="form"
    >
      <DeleteCampaign
        workspace={workspace}
        id={id}
        title={campaign.title}
        linkCount={links.length}
        cancelHref={base}
      />
    </Page>
  );
}
