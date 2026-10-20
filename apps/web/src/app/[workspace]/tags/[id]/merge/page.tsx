import { can } from "@shortn/core/authz";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Page } from "@/components/page/page";
import { MergeTagForm } from "@/components/tags/tag-forms";
import { mergeTagPageAction } from "@/server/actions/tags";
import { loadTag } from "@/server/tag-page";

export async function generateMetadata() {
  return { title: (await getTranslations("tags.mergePage"))("title") };
}

export default async function MergeTagPage({
  params,
}: PageProps<"/[workspace]/tags/[id]/merge">) {
  const { workspace, id } = await params;
  const t = await getTranslations("tags");
  const { ctx, tag, usage } = await loadTag(workspace, id);
  const base = `/${workspace}/tags`;
  if (
    !can(ctx.actor, "resource.update") ||
    !can(ctx.actor, "resource.delete", {
      createdBy: tag.createdBy ?? undefined,
    })
  )
    redirect(base);
  return (
    <Page
      crumbs={[
        { label: t("title"), href: base },
        { label: tag.name, href: `${base}/${id}` },
        { label: t("mergePage.title") },
      ]}
      title={t("mergePage.title")}
      description={t("mergePage.description", { tag: tag.name })}
      width="form"
    >
      <MergeTagForm
        workspace={workspace}
        tag={{ id: tag.id, name: tag.name, color: tag.color }}
        usage={usage}
        action={mergeTagPageAction.bind(null, workspace, id)}
        cancelHref={`${base}/${id}`}
      />
    </Page>
  );
}
