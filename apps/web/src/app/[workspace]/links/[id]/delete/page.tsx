import { can } from "@shortn/core";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { DeleteLinks } from "@/components/link-pages/delete-links";
import { Page } from "@/components/page/page";
import { loadLink } from "@/server/link-page";

export async function generateMetadata() {
  const t = await getTranslations("linkPages.delete");
  return { title: t("title") };
}

export default async function DeleteLinkPage({
  params,
}: PageProps<"/[workspace]/links/[id]/delete">) {
  const { workspace, id } = await params;
  const t = await getTranslations("linkPages");
  const { ctx, link } = await loadLink(workspace, id);
  const base = `/${workspace}/links/${id}`;
  if (
    !can(ctx.actor, "resource.delete", {
      createdBy: link.createdBy ?? undefined,
    })
  )
    redirect(base);
  return (
    <Page
      crumbs={[
        { label: t("crumb"), href: `/${workspace}/links` },
        { label: `${link.domain}/${link.key}`, href: base },
        { label: t("delete.title") },
      ]}
      title={t("delete.title")}
      description={t("delete.description")}
      width="form"
    >
      <DeleteLinks
        workspace={workspace}
        ids={[link.id]}
        items={[`${link.domain}/${link.key} → ${link.url}`]}
        cancelHref={base}
      />
    </Page>
  );
}
