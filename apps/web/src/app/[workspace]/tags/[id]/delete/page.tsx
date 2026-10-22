import { can } from "@shortn/core/authz";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Page } from "@/components/page/page";
import { DeleteTag } from "@/components/tags/tag-forms";
import { deleteTagPageAction } from "@/server/actions/tags";
import { loadTag } from "@/server/tag-page";

export async function generateMetadata() {
  return { title: (await getTranslations("tags.deletePage"))("title") };
}

export default async function DeleteTagPage({
  params,
}: PageProps<"/[workspace]/tags/[id]/delete">) {
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
        { label: t("deletePage.title") },
      ]}
      title={t("deletePage.title")}
      description={t("deletePage.description", { tag: tag.name })}
      width="form"
    >
      <DeleteTag
        tag={{ name: tag.name, color: tag.color }}
        usage={usage}
        action={deleteTagPageAction.bind(null, workspace, id)}
        cancelHref={`${base}/${id}`}
      />
    </Page>
  );
}
