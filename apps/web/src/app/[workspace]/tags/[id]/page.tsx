import { can } from "@shortn/core/authz";
import { buttonVariants, cn } from "@shortn/ui";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Page, Section } from "@/components/page/page";
import { EditTagForm } from "@/components/tags/tag-forms";
import { updateTagPageAction } from "@/server/actions/tags";
import { loadTag, tagLinksHref } from "@/server/tag-page";

export async function generateMetadata({
  params,
}: PageProps<"/[workspace]/tags/[id]">) {
  const { workspace, id } = await params;
  return { title: (await loadTag(workspace, id)).tag.name };
}

export default async function EditTagPage({
  params,
}: PageProps<"/[workspace]/tags/[id]">) {
  const { workspace, id } = await params;
  const t = await getTranslations("tags");
  const { ctx, tag, usage } = await loadTag(workspace, id);
  const base = `/${workspace}/tags`;
  if (!can(ctx.actor, "resource.update")) redirect(base);
  const deletable = can(ctx.actor, "resource.delete", {
    createdBy: tag.createdBy ?? undefined,
  });
  return (
    <Page
      crumbs={[{ label: t("title"), href: base }, { label: tag.name }]}
      title={t("editPage.title")}
      description={t("editPage.description")}
      width="form"
    >
      <Section
        title={tag.name}
        description={t("editPage.usage", usage)}
        aside={
          <Link
            href={tagLinksHref(workspace, tag.name)}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            {t("viewLinks")}
          </Link>
        }
      >
        <EditTagForm
          initial={{ name: tag.name, color: tag.color }}
          action={updateTagPageAction.bind(null, workspace, id)}
          cancelHref={base}
        />
      </Section>
      {deletable ? (
        <Section title={t("editPage.more")}>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`${base}/${id}/merge`}
              className={buttonVariants({ variant: "secondary", size: "md" })}
            >
              {t("merge")}
            </Link>
            <Link
              href={`${base}/${id}/delete`}
              className={cn(
                buttonVariants({ variant: "dangerGhost", size: "md" }),
              )}
            >
              {t("delete")}
            </Link>
          </div>
        </Section>
      ) : null}
    </Page>
  );
}
