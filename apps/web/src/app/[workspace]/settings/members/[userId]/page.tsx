import { buttonVariants } from "@shortn/ui";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Notice } from "@/components/page/notice";
import { Page, Section } from "@/components/page/page";
import { RoleForm } from "@/components/settings/members/role-form";
import {
  assignableRoles,
  isAssignableRole,
  memberBlock,
} from "@/components/settings/members/roles";
import { changeRolePageAction } from "@/server/actions/settings-pages";
import { loadMember } from "./load";

export async function generateMetadata({
  params,
}: PageProps<"/[workspace]/settings/members/[userId]">): Promise<Metadata> {
  const { workspace, userId } = await params;
  const { member } = await loadMember(workspace, userId);
  return { title: member.name || member.email };
}

export default async function MemberPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/settings/members/[userId]">) {
  const { workspace: slug, userId } = await params;
  const [{ saved }, { workspace, member, actor, self }, t, format] =
    await Promise.all([
      searchParams,
      loadMember(slug, userId),
      getTranslations("settings"),
      getFormatter(),
    ]);
  const base = `/${slug}/settings/members`;
  const name = member.name || member.email || t("members.list.noName");
  const owner = member.role === "owner";
  const block = memberBlock(actor, member);
  const canRemove = !owner && (self || block === null);

  const roleSection = () => {
    if (owner)
      return (
        <p className="text-small text-fg-muted">{t("member.ownerRole")}</p>
      );
    if (self)
      return <p className="text-small text-fg-muted">{t("member.selfRole")}</p>;
    if (block)
      return (
        <p className="text-small text-fg-muted">
          {block === "readOnly"
            ? t("members.readOnly")
            : t("member.adminOwnerOnly")}
        </p>
      );
    return isAssignableRole(member.role) ? (
      <RoleForm
        current={member.role}
        roles={assignableRoles(actor)}
        action={changeRolePageAction.bind(null, slug, userId)}
        cancelHref={base}
      />
    ) : null;
  };

  const detail = (label: string, value: string) => (
    <div className="grid grid-cols-[10rem_1fr] gap-4 py-2.5 max-sm:grid-cols-1 max-sm:gap-1">
      <dt className="text-small text-fg-muted">{label}</dt>
      <dd className="min-w-0 text-small break-words">{value}</dd>
    </div>
  );

  return (
    <Page
      crumbs={[
        { label: t("title"), href: `/${slug}/settings` },
        { label: t("members.title"), href: base },
        { label: name },
      ]}
      title={name}
      description={self ? t("member.you") : undefined}
      width="form"
    >
      {saved ? <Notice tone="success">{t("member.saved")}</Notice> : null}
      <Section title={t("member.details")}>
        <dl className="divide-y divide-line border-y border-line">
          {detail(t("member.email"), member.email)}
          {detail(t("members.list.role"), t(`roles.${member.role}`))}
          {detail(
            t("members.list.joined"),
            format.dateTime(new Date(member.joinedAt), { dateStyle: "long" }),
          )}
        </dl>
      </Section>
      <Section title={t("member.roleTitle")}>{roleSection()}</Section>
      {canRemove ? (
        <Section
          title={self ? t("member.leave.title") : t("member.remove.title")}
          description={
            self
              ? t("member.leave.description", { workspace: workspace.name })
              : t("member.remove.description", {
                  name,
                  workspace: workspace.name,
                })
          }
        >
          <Link
            href={`${base}/${userId}/remove`}
            className={buttonVariants({ variant: "dangerGhost", size: "md" })}
          >
            {self ? t("member.leave.action") : t("member.remove.action")}
          </Link>
        </Section>
      ) : null}
    </Page>
  );
}
