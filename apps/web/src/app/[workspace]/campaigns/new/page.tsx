import { can } from "@shortn/core/authz";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { CampaignForm } from "@/components/campaigns/campaign-form";
import { CampaignsGate } from "@/components/campaigns/campaigns-gate";
import { Page } from "@/components/page/page";
import { createCampaignPageAction } from "@/server/actions/campaign-pages";
import { campaignsAccess } from "@/server/campaign-page";
import { requireWorkspace } from "@/server/workspace";

export async function generateMetadata() {
  const t = await getTranslations("campaigns.form");
  return { title: t("newTitle") };
}

export default async function NewCampaignPage({
  params,
}: PageProps<"/[workspace]/campaigns/new">) {
  const { workspace } = await params;
  const [{ actor }, access] = await Promise.all([
    requireWorkspace(workspace),
    campaignsAccess(workspace),
  ]);
  if (!access.allowed) return <CampaignsGate plan={access.plan} />;
  if (!can(actor, "resource.create")) redirect(`/${workspace}/campaigns`);
  const t = await getTranslations("campaigns");
  return (
    <Page
      crumbs={[
        { label: t("list.title"), href: `/${workspace}/campaigns` },
        { label: t("form.newTitle") },
      ]}
      title={t("form.newTitle")}
      description={t("form.newDescription")}
      width="form"
    >
      <CampaignForm
        mode="create"
        initial={{
          title: "",
          description: "",
          utmDefaults: { sources: [], mediums: [], terms: [], contents: [] },
        }}
        action={createCampaignPageAction.bind(null, workspace)}
        cancelHref={`/${workspace}/campaigns`}
      />
    </Page>
  );
}
