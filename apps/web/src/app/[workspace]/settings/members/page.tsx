import { loadEntitlements } from "@shortn/billing";
import { buttonVariants } from "@shortn/ui";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Notice } from "@/components/page/notice";
import { Page, Section } from "@/components/page/page";
import { canManageMembers } from "@/components/settings/members/roles";
import { UserAvatar } from "@/components/shell/avatars";
import { revokeInvitePageAction } from "@/server/actions/settings-pages";
import { membersAction } from "@/server/actions/workspace";
import { db } from "@/server/db";
import { requireWorkspace } from "@/server/workspace";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: `${t("members.title")} · ${t("title")}` };
}

const date = { day: "numeric", month: "short", year: "numeric" } as const;

export default async function MembersSettingsPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/settings/members">) {
  const slug = (await params).workspace;
  const [query, { session, workspace, actor }, t, format] = await Promise.all([
    searchParams,
    requireWorkspace(slug),
    getTranslations("settings"),
    getFormatter(),
  ]);
  const [{ members, invites }, entitlements] = await Promise.all([
    membersAction(slug),
    loadEntitlements(await db(), workspace._id),
  ]);
  const manage = canManageMembers({
    userId: session.user.id,
    role: actor.role,
  });
  const base = `/${slug}/settings/members`;
  const seats = {
    used: members.length + invites.length,
    limit: entitlements.limits.seats,
  };
  const inviter = (userId: string) => {
    const member = members.find((item) => item.userId === userId);
    return member ? member.name || member.email : "—";
  };
  const th = "py-2 pr-4 font-medium";

  return (
    <Page
      crumbs={[
        { label: t("title"), href: `/${slug}/settings` },
        { label: t("members.title") },
      ]}
      title={t("members.title")}
      description={t("members.description", { workspace: workspace.name })}
      actions={
        manage ? (
          <Link
            href={`${base}/invite`}
            className={buttonVariants({ variant: "primary", size: "lg" })}
          >
            {t("members.inviteAction")}
          </Link>
        ) : null
      }
    >
      {query.invited ? (
        <Notice tone="success">{t("members.notices.invited")}</Notice>
      ) : null}
      {query.removed ? (
        <Notice tone="success">{t("members.notices.removed")}</Notice>
      ) : null}
      {query.revoked ? (
        <Notice tone="success">{t("members.notices.revoked")}</Notice>
      ) : null}
      {query.failed ? (
        <Notice tone="warning">
          {query.failed === "forbidden"
            ? t("members.readOnly")
            : t("common.errors.generic")}
        </Notice>
      ) : null}
      {manage ? null : <Notice>{t("members.readOnly")}</Notice>}

      <Section
        title={t("members.list.title", { count: members.length })}
        description={
          seats.limit === null
            ? undefined
            : t("members.seats", { used: seats.used, limit: seats.limit })
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <thead className="border-b border-line text-left text-meta text-fg-muted">
              <tr>
                <th scope="col" className={th}>
                  {t("members.list.member")}
                </th>
                <th scope="col" className={th}>
                  {t("members.list.role")}
                </th>
                <th scope="col" className={`${th} max-sm:hidden`}>
                  {t("members.list.joined")}
                </th>
                <th
                  scope="col"
                  className="relative py-2 text-right font-medium"
                >
                  <span className="sr-only">{t("members.list.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {members.map((member) => {
                const name =
                  member.name || member.email || t("members.list.noName");
                const self = member.userId === session.user.id;
                return (
                  <tr key={member.userId} className="hover:bg-bg-subtle">
                    <td className="w-full max-w-0 py-2.5 pr-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <UserAvatar name={name} image={member.image} />
                        <div className="flex min-w-0 flex-col">
                          <span className="flex min-w-0 items-baseline gap-2">
                            <Link
                              href={`${base}/${member.userId}`}
                              className="truncate font-medium hover:underline"
                            >
                              {name}
                            </Link>
                            {self ? (
                              <span className="shrink-0 rounded-chip bg-bg-muted px-1.5 text-meta text-fg-muted">
                                {t("common.you")}
                              </span>
                            ) : null}
                          </span>
                          {member.name && member.email ? (
                            <span className="truncate text-meta text-fg-muted">
                              {member.email}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap">
                      {t(`roles.${member.role}`)}
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap text-fg-muted max-sm:hidden">
                      {format.dateTime(new Date(member.joinedAt), date)}
                    </td>
                    <td className="py-2.5 text-right">
                      <Link
                        href={`${base}/${member.userId}`}
                        className="text-signal hover:underline"
                        aria-label={t("members.list.manageLabel", { name })}
                      >
                        {manage || self
                          ? t("members.list.manage")
                          : t("members.list.view")}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title={t("members.invites.title", { count: invites.length })}
        description={
          invites.length === 0 ? t("members.invites.empty") : undefined
        }
      >
        {invites.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-small">
              <thead className="border-b border-line text-left text-meta text-fg-muted">
                <tr>
                  <th scope="col" className={th}>
                    {t("members.invites.email")}
                  </th>
                  <th scope="col" className={th}>
                    {t("members.list.role")}
                  </th>
                  <th scope="col" className={`${th} max-sm:hidden`}>
                    {t("members.invites.expires")}
                  </th>
                  <th scope="col" className={`${th} max-md:hidden`}>
                    {t("members.invites.invitedBy")}
                  </th>
                  <th
                    scope="col"
                    className="relative py-2 text-right font-medium"
                  >
                    <span className="sr-only">{t("members.list.actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {invites.map((invite) => (
                  <tr key={invite.id}>
                    <td className="w-full max-w-0 truncate py-2.5 pr-4 font-medium">
                      {invite.email}
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap">
                      {t(`roles.${invite.role}`)}
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap text-fg-muted max-sm:hidden">
                      {format.dateTime(new Date(invite.expiresAt), date)}
                    </td>
                    <td className="max-w-48 truncate py-2.5 pr-4 text-fg-muted max-md:hidden">
                      {inviter(invite.invitedBy)}
                    </td>
                    <td className="py-2.5 text-right">
                      {manage ? (
                        <form
                          action={revokeInvitePageAction.bind(
                            null,
                            slug,
                            invite.id,
                          )}
                        >
                          <button
                            type="submit"
                            className={buttonVariants({
                              variant: "ghost",
                              size: "sm",
                            })}
                            aria-label={t("members.invites.revokeLabel", {
                              email: invite.email,
                            })}
                          >
                            {t("members.invites.revoke")}
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Section>
    </Page>
  );
}
