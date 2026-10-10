import { can } from "@shortn/core";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CreateWorkspace } from "@/components/settings/general/create-workspace";
import { DeleteWorkspace } from "@/components/settings/general/delete-workspace";
import { WorkspaceIdentityForm } from "@/components/settings/general/identity-form";
import { SettingsPage } from "@/components/settings/section";
import { env } from "@/server/env";
import { memberships, requireWorkspace } from "@/server/workspace";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: `${t("nav.general")} · ${t("title")}` };
}

export default async function GeneralSettingsPage({
  params,
}: PageProps<"/[workspace]/settings">) {
  const { session, workspace, actor } = await requireWorkspace(
    (await params).workspace,
  );
  const [t, list] = await Promise.all([
    getTranslations("settings.general"),
    memberships(session.user.id),
  ]);
  const personal = list.find(
    (membership) =>
      membership.workspace.personal &&
      membership.workspace.ownerUserId === session.user.id,
  );
  const host = new URL(env().BETTER_AUTH_URL).host;

  return (
    <SettingsPage
      title={t("title")}
      description={t("description", { workspace: workspace.name })}
    >
      <WorkspaceIdentityForm
        name={workspace.name}
        slug={workspace.slug}
        host={host}
        canUpdate={can(actor, "workspace.update")}
      />
      <CreateWorkspace
        host={host}
        personalSlug={personal?.workspace.slug ?? null}
      />
      <DeleteWorkspace
        name={workspace.name}
        slug={workspace.slug}
        personal={workspace.personal}
        canDelete={can(actor, "workspace.delete")}
      />
    </SettingsPage>
  );
}
