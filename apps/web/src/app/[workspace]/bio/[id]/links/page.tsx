import { can } from "@shortn/core/authz";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { BioLinksForm } from "@/components/bio/bio-links-form";
import { Page } from "@/components/page/page";
import { saveBioLinksAction } from "@/server/actions/bio-pages";
import { bioTabs, loadBio } from "@/server/bio-page";
import { env } from "@/server/env";

export async function generateMetadata() {
  const t = await getTranslations("bio.tabs");
  return { title: t("links") };
}

export default async function BioLinksPage({
  params,
}: PageProps<"/[workspace]/bio/[id]/links">) {
  const { workspace, id } = await params;
  const t = await getTranslations("bio");
  const { ctx, bio } = await loadBio(workspace, id);
  const base = `/${workspace}/bio/${id}`;
  if (!can(ctx.actor, "resource.update")) redirect(base);
  return (
    <Page
      crumbs={[
        { label: t("list.title"), href: `/${workspace}/bio` },
        { label: bio.title || bio.slug, href: base },
        { label: t("tabs.links") },
      ]}
      title={bio.title || bio.slug}
      description={t("links.description")}
      tabs={bioTabs(workspace, id, true, (key) => t(`tabs.${key}`))}
      tabsLabel={t("tabs.label")}
    >
      <BioLinksForm
        workspace={workspace}
        linkDomain={env().LINK_DOMAIN}
        bio={bio}
        action={saveBioLinksAction.bind(null, workspace, id)}
        cancelHref={base}
      />
    </Page>
  );
}
