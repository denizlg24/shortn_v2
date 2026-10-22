"use server";

import {
  changeRole,
  createWorkspace,
  deleteWorkspace,
  inviteMember,
  listInvites,
  listMembers,
  removeMember,
  revokeInvite,
  updateWorkspace,
  type InviteView,
  type MemberView,
} from "@shortn/core";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { serviceContext } from "../context";
import { db } from "../db";
import { env } from "../env";
import { mail } from "../mail";
import { impersonationOf, requireSession } from "../workspace";
import { invalidInput, toAction, type ActionResult } from "./result";

const role = z.enum(["admin", "member", "viewer"]);

export async function membersAction(
  workspace: string,
): Promise<{ members: MemberView[]; invites: InviteView[] }> {
  const ctx = await serviceContext(workspace);
  const [members, invites] = await Promise.all([
    listMembers(ctx),
    listInvites(ctx),
  ]);
  return { members, invites };
}

export async function inviteMemberAction(
  workspace: string,
  input: { email: string; role: "admin" | "member" | "viewer" },
): Promise<ActionResult<InviteView>> {
  const parsed = z
    .object({ email: z.string().max(254), role })
    .safeParse(input);
  if (!parsed.success) return invalidInput;
  const ctx = await serviceContext(workspace);
  const result = await inviteMember(ctx, parsed.data);
  if (!result.ok) return toAction(result);
  const session = await requireSession();
  await mail().workspaceInvite({
    to: result.value.invite.email,
    locale: await getLocale(),
    inviter: session.user.name || session.user.email,
    workspace: ctx.workspace.name,
    role: parsed.data.role,
    url: `${env().BETTER_AUTH_URL}/invite/${result.value.token}`,
  });
  return { ok: true, data: result.value.invite };
}

export async function revokeInviteAction(
  workspace: string,
  id: string,
): Promise<ActionResult<null>> {
  return toAction(await revokeInvite(await serviceContext(workspace), id));
}

export async function changeRoleAction(
  workspace: string,
  userId: string,
  next: "admin" | "member" | "viewer",
): Promise<ActionResult<null>> {
  if (!role.safeParse(next).success) return invalidInput;
  return toAction(
    await changeRole(await serviceContext(workspace), userId, next),
  );
}

export async function removeMemberAction(
  workspace: string,
  userId: string,
): Promise<ActionResult<null>> {
  return toAction(await removeMember(await serviceContext(workspace), userId));
}

export async function createWorkspaceAction(input: {
  name: string;
  slug: string;
}): Promise<ActionResult<{ slug: string }>> {
  const parsed = z
    .object({
      name: z.string().min(1).max(64),
      slug: z.string().min(1).max(48),
    })
    .safeParse(input);
  if (!parsed.success) return invalidInput;
  const session = await requireSession();
  if (impersonationOf(session)) return { ok: false, error: "forbidden" };
  const result = await createWorkspace(await db(), session.user, parsed.data);
  return result.ok
    ? { ok: true, data: { slug: result.value.slug } }
    : toAction(result);
}

export async function updateWorkspaceAction(
  workspace: string,
  input: { name?: string; slug?: string },
): Promise<ActionResult<{ slug: string; name: string }>> {
  const parsed = z
    .object({
      name: z.string().max(64).optional(),
      slug: z.string().max(48).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return invalidInput;
  const result = await updateWorkspace(
    await serviceContext(workspace),
    parsed.data,
  );
  return result.ok
    ? { ok: true, data: { slug: result.value.slug, name: result.value.name } }
    : toAction(result);
}

export async function deleteWorkspaceAction(
  workspace: string,
): Promise<ActionResult<null>> {
  return toAction(await deleteWorkspace(await serviceContext(workspace)));
}
