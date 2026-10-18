import { can } from "@shortn/core";
import { buttonVariants } from "@shortn/ui";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Notice } from "@/components/page/notice";
import { Page, Section } from "@/components/page/page";
import { WorkspaceForm } from "@/components/settings/general/workspace-form";
import { updateWorkspacePageAction } from "@/server/actions/settings-pages";
import { env } from "@/server/env";
import { linkExportStore } from "@/server/link-exports";
import { requireWorkspace } from "@/server/workspace";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: `${t("general.title")} · ${t("title")}` };
}

export default async function GeneralSettingsPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/settings">) {
  const slug = (await params).workspace;
  const [{ saved }, { workspace, actor }, t, tExport] = await Promise.all([
    searchParams,
    requireWorkspace(slug),
    getTranslations("settings"),
    getTranslations("workspaceExports"),
  ]);
  const base = `/${slug}/settings`;
  const canDelete = !workspace.personal && can(actor, "workspace.delete");

  return (
    <Page
      crumbs={[
        { label: t("title"), href: base },
        { label: t("general.title") },
      ]}
      title={t("general.title")}
      description={t("general.description", { workspace: workspace.name })}
      width="form"
    >
      {saved ? <Notice tone="success">{t("general.saved")}</Notice> : null}
      <WorkspaceForm
        name={workspace.name}
        slug={workspace.slug}
        host={new URL(env().BETTER_AUTH_URL).host}
        canUpdate={can(actor, "workspace.update")}
        action={updateWorkspacePageAction.bind(null, slug)}
      />
      <Section
        title={t("general.workspaces.title")}
        description={t("general.workspaces.description")}
      >
        <Link
          href="/workspaces/new"
          className={buttonVariants({ variant: "secondary", size: "md" })}
        >
          {t("general.workspaces.create")}
        </Link>
      </Section>
      {workspace.ownerUserId === actor.userId &&
      actor.role === "owner" &&
      linkExportStore() ? (
        <Section title={tExport("title")} description={tExport("entryHelp")}>
          <Link
            href={`${base}/workspace/export`}
            className={buttonVariants({ variant: "secondary", size: "md" })}
          >
            {tExport("entry")}
          </Link>
        </Section>
      ) : null}
      <Section
        title={t("general.danger.title")}
        description={
          workspace.personal
            ? t("general.danger.personal")
            : canDelete
              ? t("general.danger.description", { workspace: workspace.name })
              : t("general.danger.ownerOnly")
        }
      >
        {canDelete ? (
          <Link
            href={`${base}/delete`}
            className={buttonVariants({ variant: "dangerGhost", size: "md" })}
          >
            {t("general.danger.action")}
          </Link>
        ) : null}
      </Section>
    </Page>
  );
}
