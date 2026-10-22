import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { membersAction } from "@/server/actions/workspace";
import { requireWorkspace } from "@/server/workspace";

// One lookup per request for the member page and its confirmation page.
export const loadMember = cache(async (slug: string, userId: string) => {
  const [{ session, workspace, actor }, { members }] = await Promise.all([
    requireWorkspace(slug),
    membersAction(slug),
  ]);
  const member = members.find((item) => item.userId === userId);
  if (!member) notFound();
  return {
    workspace,
    member,
    actor: { ...actor, userId: session.user.id },
    self: member.userId === session.user.id,
  };
});
