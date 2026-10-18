import { env } from "@/server/env";
import { can } from "@shortn/core/authz";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { BioSocialsForm } from "@/components/bio/bio-socials-form";
import { Page } from "@/components/page/page";
import { saveBioSocialsAction } from "@/server/actions/bio-pages";
import { bioTabs, loadBio } from "@/server/bio-page";

export async function generateMetadata() {
  const t = await getTranslations("bio.tabs");
  return { title: t("socials") };
}

export default async function BioSocialsPage({
  params,
}: PageProps<"/[workspace]/bio/[id]/socials">) {
  const { workspace, id } = await params;
  const t = await getTranslations("bio");
  const { ctx, bio } = await loadBio(workspace, id);
  const base = `/${workspace}/bio/${id}`;
  if (!can(ctx.actor, "resource.update")) redirect(base);
  if (env().BIO_DELIVERY_ENABLED === "1") redirect(`${base}/editor`);
  return (
    <Page
      crumbs={[
        { label: t("list.title"), href: `/${workspace}/bio` },
        { label: bio.title || bio.slug, href: base },
        { label: t("tabs.socials") },
      ]}
      title={bio.title || bio.slug}
      description={t("socials.description")}
      tabs={bioTabs(workspace, id, true, (key) => t(`tabs.${key}`))}
      tabsLabel={t("tabs.label")}
    >
      <BioSocialsForm
        bio={bio}
        action={saveBioSocialsAction.bind(null, workspace, id)}
        cancelHref={base}
      />
    </Page>
  );
}
