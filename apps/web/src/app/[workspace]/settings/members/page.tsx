import { loadEntitlements } from "@shortn/billing";
import { can } from "@shortn/core";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MembersPanel } from "@/components/settings/members/members-panel";
import { SettingsPage } from "@/components/settings/section";
import { membersAction } from "@/server/actions/workspace";
import { db } from "@/server/db";
import { requireWorkspace } from "@/server/workspace";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: `${t("nav.members")} · ${t("title")}` };
}

export default async function MembersSettingsPage({
  params,
}: PageProps<"/[workspace]/settings/members">) {
  const slug = (await params).workspace;
  const { session, workspace, actor } = await requireWorkspace(slug);
  const [{ members, invites }, entitlements, t] = await Promise.all([
    membersAction(slug),
    loadEntitlements(await db(), workspace._id),
    getTranslations("settings.members"),
  ]);

  return (
    <SettingsPage
      title={t("title")}
      description={t("description", { workspace: workspace.name })}
    >
      <MembersPanel
        workspace={{ slug: workspace.slug, name: workspace.name }}
        members={members}
        invites={invites}
        actor={{ userId: session.user.id, role: actor.role }}
        seats={{
          used: members.length + invites.length,
          limit: entitlements.limits.seats,
        }}
        canUpgrade={can(actor, "billing.manage")}
        now={new Date().toISOString()}
      />
    </SettingsPage>
  );
}
