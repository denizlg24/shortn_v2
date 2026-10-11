import { can } from "@shortn/core/authz";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { BioAppearanceForm } from "@/components/bio/bio-appearance-form";
import { Page } from "@/components/page/page";
import { saveBioAppearanceAction } from "@/server/actions/bio-pages";
import { bioTabs, loadBio } from "@/server/bio-page";

export async function generateMetadata() {
  const t = await getTranslations("bio.tabs");
  return { title: t("appearance") };
}

export default async function BioAppearancePage({
  params,
}: PageProps<"/[workspace]/bio/[id]/appearance">) {
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
        { label: t("tabs.appearance") },
      ]}
      title={bio.title || bio.slug}
      description={t("appearance.description")}
      tabs={bioTabs(workspace, id, true, (key) => t(`tabs.${key}`))}
      tabsLabel={t("tabs.label")}
    >
      <BioAppearanceForm
        bio={bio}
        action={saveBioAppearanceAction.bind(null, workspace, id)}
        cancelHref={base}
      />
    </Page>
  );
}
