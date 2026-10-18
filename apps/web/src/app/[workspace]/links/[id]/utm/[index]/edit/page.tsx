import { UtmGate } from "@/components/link-pages/utm-gate";
import { campaignsAccess } from "@/server/campaign-page";
import { can, listCampaigns } from "@shortn/core";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { UtmForm } from "@/components/link-pages/utm-form";
import { Page } from "@/components/page/page";
import { saveUtmVariantAction } from "@/server/actions/link-pages";
import { linkTabs, loadLink } from "@/server/link-page";

export async function generateMetadata() {
  const t = await getTranslations("linkPages.utm");
  return { title: t("editTitle") };
}

export default async function EditUtmPage({
  params,
}: PageProps<"/[workspace]/links/[id]/utm/[index]/edit">) {
  const { workspace, id, index } = await params;
  const t = await getTranslations("linkPages");
  const { ctx, link } = await loadLink(workspace, id);
  if (!can(ctx.actor, "resource.update"))
    redirect(`/${workspace}/links/${id}/utm`);
  const access = await campaignsAccess(workspace);
  if (!access.allowed)
    return <UtmGate workspace={workspace} link={link} plan={access.plan} />;
  const position = Number(index);
  const variant = Number.isInteger(position) ? link.utm[position] : undefined;
  if (!variant) notFound();
  const campaigns = await listCampaigns(ctx);
  const base = `/${workspace}/links/${id}`;
  return (
    <Page
      crumbs={[
        { label: t("crumb"), href: `/${workspace}/links` },
        { label: `${link.domain}/${link.key}`, href: base },
        { label: t("tabs.utm"), href: `${base}/utm` },
        { label: t("utm.editTitle") },
      ]}
      title={t("utm.editTitle")}
      tabs={linkTabs(workspace, id, (key) => t(`tabs.${key}`))}
      tabsLabel={t("tabs.label")}
      width="form"
    >
      <UtmForm
        initial={{
          source: variant.source ?? "",
          medium: variant.medium ?? "",
          campaign: variant.campaign ?? "",
          term: variant.term ?? "",
          content: variant.content ?? "",
        }}
        campaigns={campaigns.map(({ title, utmDefaults }) => ({
          title,
          utmDefaults,
        }))}
        action={saveUtmVariantAction.bind(
          null,
          workspace,
          id,
          position,
          link.utm.map((item) => ({
            source: item.source ?? undefined,
            medium: item.medium ?? undefined,
            campaign: item.campaign ?? undefined,
            term: item.term ?? undefined,
            content: item.content ?? undefined,
          })),
        )}
        cancelHref={`${base}/utm`}
      />
    </Page>
  );
}
