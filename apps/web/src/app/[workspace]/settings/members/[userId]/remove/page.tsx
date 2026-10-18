import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Page } from "@/components/page/page";
import { RemoveMember } from "@/components/settings/members/remove-member";
import { memberBlock } from "@/components/settings/members/roles";
import { loadMember } from "../load";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.remove");
  return { title: t("title") };
}

export default async function RemoveMemberPage({
  params,
}: PageProps<"/[workspace]/settings/members/[userId]/remove">) {
  const { workspace: slug, userId } = await params;
  const [{ workspace, member, actor, self }, t] = await Promise.all([
    loadMember(slug, userId),
    getTranslations("settings"),
  ]);
  const base = `/${slug}/settings/members`;
  const memberHref = `${base}/${userId}`;
  if (member.role === "owner" || (!self && memberBlock(actor, member)))
    redirect(memberHref);
  const name = member.name || member.email || t("members.list.noName");

  return (
    <Page
      crumbs={[
        { label: t("title"), href: `/${slug}/settings` },
        { label: t("members.title"), href: base },
        { label: name, href: memberHref },
        { label: self ? t("remove.leaveTitle") : t("remove.title") },
      ]}
      title={
        self
          ? t("remove.leaveHeading", { workspace: workspace.name })
          : t("remove.heading", { name })
      }
      width="form"
    >
      <RemoveMember
        workspace={slug}
        userId={userId}
        items={[
          member.name ? `${member.name} · ${member.email}` : member.email,
        ]}
        consequences={
          self
            ? [
                t("remove.leave.access", { workspace: workspace.name }),
                t("remove.leave.content"),
                t("remove.leave.again"),
              ]
            : [
                t("remove.member.access", { name, workspace: workspace.name }),
                t("remove.member.content"),
                t("remove.member.again"),
              ]
        }
        confirmLabel={self ? t("remove.leaveConfirm") : t("remove.confirm")}
        cancelHref={memberHref}
      />
    </Page>
  );
}
