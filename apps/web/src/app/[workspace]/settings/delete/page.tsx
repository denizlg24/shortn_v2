import { can } from "@shortn/core";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Notice } from "@/components/page/notice";
import { Page } from "@/components/page/page";
import { DeleteWorkspaceForm } from "@/components/settings/general/delete-workspace-form";
import { deleteWorkspacePageAction } from "@/server/actions/settings-pages";
import { requireWorkspace } from "@/server/workspace";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: `${t("delete.title")} · ${t("title")}` };
}

export default async function DeleteWorkspacePage({
  params,
}: PageProps<"/[workspace]/settings/delete">) {
  const slug = (await params).workspace;
  const [{ workspace, actor }, t] = await Promise.all([
    requireWorkspace(slug),
    getTranslations("settings"),
  ]);
  const base = `/${slug}/settings`;

  return (
    <Page
      crumbs={[
        { label: t("title"), href: base },
        { label: t("general.title"), href: base },
        { label: t("delete.title") },
      ]}
      title={t("delete.title")}
      description={t("delete.description", { workspace: workspace.name })}
      width="form"
    >
      {workspace.personal ? (
        <Notice>{t("general.danger.personal")}</Notice>
      ) : !can(actor, "workspace.delete") ? (
        <Notice>{t("general.danger.ownerOnly")}</Notice>
      ) : (
        <DeleteWorkspaceForm
          name={workspace.name}
          action={deleteWorkspacePageAction.bind(null, slug)}
          cancelHref={base}
        />
      )}
    </Page>
  );
}
