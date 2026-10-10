import { listCampaigns } from "@shortn/core";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
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
        suggestions={campaigns.map((c) => c.title)}
        action={saveUtmVariantAction.bind(null, workspace, id, position)}
        cancelHref={`${base}/utm`}
      />
    </Page>
  );
}
