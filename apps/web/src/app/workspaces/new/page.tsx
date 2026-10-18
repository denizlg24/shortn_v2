import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthFrame } from "@/components/auth/auth-frame";
import { AuthHeading } from "@/components/auth/auth-parts";
import { CreateWorkspaceForm } from "@/components/settings/general/create-workspace-form";
import { env } from "@/server/env";
import { memberships, requireSession } from "@/server/workspace";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.create");
  return { title: t("title") };
}

// Outside any workspace (17): the new one doesn't exist yet, and the
// creator may be in several. Cancel returns to the last-used workspace.
export default async function NewWorkspacePage() {
  const session = await requireSession();
  const [t, list] = await Promise.all([
    getTranslations("settings.create"),
    memberships(session.user.id),
  ]);
  const personal = list.find(
    (membership) =>
      membership.workspace.personal &&
      membership.workspace.ownerUserId === session.user.id,
  );
  return (
    <AuthFrame>
      <AuthHeading title={t("title")} description={t("description")} />
      <CreateWorkspaceForm
        host={new URL(env().BETTER_AUTH_URL).host}
        plansHref={
          personal ? `/${personal.workspace.slug}/settings/billing/plans` : null
        }
        cancelHref="/"
      />
    </AuthFrame>
  );
}
