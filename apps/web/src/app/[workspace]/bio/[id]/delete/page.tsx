import { can } from "@shortn/core/authz";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { DeleteBio } from "@/components/bio/delete-bio";
import { Page } from "@/components/page/page";
import { bioPublicUrl, loadBio } from "@/server/bio-page";

export async function generateMetadata() {
  const t = await getTranslations("bio.deletePage");
  return { title: t("title") };
}

export default async function DeleteBioPage({
  params,
}: PageProps<"/[workspace]/bio/[id]/delete">) {
  const { workspace, id } = await params;
  const t = await getTranslations("bio");
  const { ctx, bio } = await loadBio(workspace, id);
  const base = `/${workspace}/bio/${id}`;
  if (
    !can(ctx.actor, "resource.delete", {
      createdBy: bio.createdBy ?? undefined,
    })
  )
    redirect(base);
  return (
    <Page
      crumbs={[
        { label: t("list.title"), href: `/${workspace}/bio` },
        { label: bio.title || bio.slug, href: base },
        { label: t("deletePage.title") },
      ]}
      title={t("deletePage.title")}
      description={t("deletePage.description")}
      width="form"
    >
      <DeleteBio
        workspace={workspace}
        id={id}
        url={bioPublicUrl(bio.slug).replace(/^https?:\/\//, "")}
        cancelHref={base}
      />
    </Page>
  );
}
