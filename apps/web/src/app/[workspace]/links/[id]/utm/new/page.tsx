import { redirect } from "next/navigation";
import { UtmGate } from "@/components/link-pages/utm-gate";
import { campaignsAccess } from "@/server/campaign-page";
import { can, listCampaigns } from "@shortn/core";
import { getTranslations } from "next-intl/server";
import { UtmForm } from "@/components/link-pages/utm-form";
import { Page } from "@/components/page/page";
import { saveUtmVariantAction } from "@/server/actions/link-pages";
import { linkTabs, loadLink } from "@/server/link-page";

export async function generateMetadata() {
  const t = await getTranslations("linkPages.utm");
  return { title: t("newTitle") };
}

export default async function NewUtmPage({
  params,
}: PageProps<"/[workspace]/links/[id]/utm/new">) {
  const { workspace, id } = await params;
  const t = await getTranslations("linkPages");
  const { ctx, link } = await loadLink(workspace, id);
  if (!can(ctx.actor, "resource.update"))
    redirect(`/${workspace}/links/${id}/utm`);
  const access = await campaignsAccess(workspace);
  if (!access.allowed)
    return <UtmGate workspace={workspace} link={link} plan={access.plan} />;
  const campaigns = await listCampaigns(ctx);
  const base = `/${workspace}/links/${id}`;
  return (
    <Page
      crumbs={[
        { label: t("crumb"), href: `/${workspace}/links` },
        { label: `${link.domain}/${link.key}`, href: base },
        { label: t("tabs.utm"), href: `${base}/utm` },
        { label: t("utm.newTitle") },
      ]}
      title={t("utm.newTitle")}
      tabs={linkTabs(workspace, id, (key) => t(`tabs.${key}`))}
      tabsLabel={t("tabs.label")}
      width="form"
    >
      <UtmForm
        initial={{
          source: "",
          medium: "",
          campaign: "",
          term: "",
          content: "",
        }}
        campaigns={campaigns.map(({ title, utmDefaults }) => ({
          title,
          utmDefaults,
        }))}
        action={saveUtmVariantAction.bind(null, workspace, id, null, null)}
        cancelHref={`${base}/utm`}
      />
    </Page>
  );
}
