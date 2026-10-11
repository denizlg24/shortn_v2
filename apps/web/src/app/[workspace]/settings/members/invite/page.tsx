import { loadEntitlements } from "@shortn/billing";
import { can } from "@shortn/core";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Notice } from "@/components/page/notice";
import { Page } from "@/components/page/page";
import { InviteForm } from "@/components/settings/members/invite-form";
import {
  assignableRoles,
  canManageMembers,
} from "@/components/settings/members/roles";
import { inviteMemberPageAction } from "@/server/actions/settings-pages";
import { membersAction } from "@/server/actions/workspace";
import { db } from "@/server/db";
import { requireWorkspace } from "@/server/workspace";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: `${t("invite.title")} · ${t("title")}` };
}

export default async function InviteMemberPage({
  params,
}: PageProps<"/[workspace]/settings/members/invite">) {
  const slug = (await params).workspace;
  const [{ session, workspace, actor }, t] = await Promise.all([
    requireWorkspace(slug),
    getTranslations("settings"),
  ]);
  const [{ members, invites }, entitlements] = await Promise.all([
    membersAction(slug),
    loadEntitlements(await db(), workspace._id),
  ]);
  const self = { userId: session.user.id, role: actor.role };
  const base = `/${slug}/settings/members`;
  const limit = entitlements.limits.seats;
  const used = members.length + invites.length;
  const plansHref = can(actor, "billing.manage")
    ? `/${slug}/settings/billing/plans`
    : null;

  return (
    <Page
      crumbs={[
        { label: t("title"), href: `/${slug}/settings` },
        { label: t("members.title"), href: base },
        { label: t("invite.title") },
      ]}
      title={t("invite.title")}
      description={t("invite.description", { workspace: workspace.name })}
      width="form"
    >
      {!canManageMembers(self) ? (
        <Notice>{t("members.readOnly")}</Notice>
      ) : (
        <>
          {limit !== null ? (
            <Notice tone={used >= limit ? "warning" : "info"}>
              {used >= limit
                ? t(
                    plansHref
                      ? "invite.errors.seatsExhausted"
                      : "invite.errors.seatsExhaustedAskOwner",
                    { seats: limit },
                  )
                : t("members.seats", { used, limit })}
            </Notice>
          ) : null}
          <InviteForm
            roles={assignableRoles(self)}
            action={inviteMemberPageAction.bind(null, slug)}
            cancelHref={base}
            plansHref={plansHref}
          />
        </>
      )}
    </Page>
  );
}
