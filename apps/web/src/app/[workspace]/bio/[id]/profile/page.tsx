import { can } from "@shortn/core/authz";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { BioProfileForm } from "@/components/bio/bio-profile-form";
import { Page } from "@/components/page/page";
import { saveBioProfileAction } from "@/server/actions/bio-pages";
import { bioTabs, loadBio } from "@/server/bio-page";

export async function generateMetadata() {
  const t = await getTranslations("bio.tabs");
  return { title: t("profile") };
}

export default async function BioProfilePage({
  params,
}: PageProps<"/[workspace]/bio/[id]/profile">) {
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
        { label: t("tabs.profile") },
      ]}
      title={bio.title || bio.slug}
      description={t("profile.description")}
      tabs={bioTabs(workspace, id, true, (key) => t(`tabs.${key}`))}
      tabsLabel={t("tabs.label")}
    >
      <BioProfileForm
        bio={bio}
        action={saveBioProfileAction.bind(null, workspace, id)}
        cancelHref={base}
      />
    </Page>
  );
}
