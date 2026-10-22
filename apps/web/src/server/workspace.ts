import "server-only";
import {
  ensurePersonalWorkspace,
  membershipsFor,
  recordImpersonatedAction,
  workspaceContext,
  type Actor,
} from "@shortn/core";
import { physicalNames } from "@shortn/db";
import { ObjectId } from "mongodb";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { workspaceExportReturnPath } from "@/lib/workspace-export";
import { cache } from "react";
import { getSession } from "./auth";
import { db } from "./db";

export type SessionData = NonNullable<Awaited<ReturnType<typeof getSession>>>;

export const requireSession = cache(async (): Promise<SessionData> => {
  const session = await getSession();
  if (!session) {
    const next = workspaceExportReturnPath(
      (await headers()).get("x-shortn-workspace-export-path"),
    );
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
  return session;
});

/** A staff impersonation session's mode; tokens without one are read-only. */
export const impersonationOf = (session: SessionData) =>
  session.session.impersonatedBy
    ? session.session.impersonationMode === "write"
      ? ("write" as const)
      : ("read" as const)
    : undefined;

export const requireWorkspace = cache(async (slug: string) => {
  const session = await requireSession();
  const context = await workspaceContext(await db(), session.user.id, slug);
  if (!context) notFound();
  const impersonation = impersonationOf(session);
  if (impersonation === "write")
    await auditImpersonatedAction(session, context.workspace._id);
  if (
    !impersonation &&
    session.user.lastWorkspaceId !== context.workspace._id.toHexString()
  )
    await rememberWorkspace(session.user.id, context.workspace._id);
  return {
    session,
    workspace: context.workspace,
    actor: impersonation ? { ...context.actor, impersonation } : context.actor,
  };
});

// Write-mode impersonation leaves a staff audit row for every server action
// it runs (23 §3.6). Fail closed: no row, no action. Page renders aren't
// mutations and carry no Next-Action header.
async function auditImpersonatedAction(
  session: SessionData,
  workspaceId: ObjectId,
) {
  const request = await headers();
  const actionId = request.get("next-action");
  const adminId = session.session.impersonatedBy;
  if (!actionId || !adminId) return;
  await recordImpersonatedAction(await db(), {
    adminId,
    userId: session.user.id,
    workspaceId,
    sessionId: session.session.id,
    actionId,
    path: request.get("referer"),
  });
}

/** Route handlers carry no Next-Action header, so write-mode impersonation
 * audits them by name here. Fails closed like the server-action path. */
export async function auditImpersonatedRequest(
  session: SessionData,
  workspaceId: ObjectId,
  label: string,
) {
  const adminId = session.session.impersonatedBy;
  if (impersonationOf(session) !== "write" || !adminId) return;
  await recordImpersonatedAction(await db(), {
    adminId,
    userId: session.user.id,
    workspaceId,
    sessionId: session.session.id,
    actionId: label,
    path: (await headers()).get("referer"),
  });
}

/** The actor for a route handler that resolved its workspace itself. */
export const withImpersonation = (session: SessionData, actor: Actor) => {
  const impersonation = impersonationOf(session);
  return impersonation ? { ...actor, impersonation } : actor;
};

export const memberships = cache(async (userId: string) =>
  membershipsFor(await db(), userId),
);

async function rememberWorkspace(userId: string, workspaceId: ObjectId) {
  if (!ObjectId.isValid(userId)) return;
  await (
    await db()
  )
    .collection(physicalNames.user)
    .updateOne(
      { _id: new ObjectId(userId) },
      { $set: { lastWorkspaceId: workspaceId.toHexString() } },
    );
}

// The last-used workspace, else the personal one; legacy-created users may
// not have reached the continuous M2 run yet, so it's created on demand.
export async function landingWorkspaceSlug(session: SessionData) {
  const list = await memberships(session.user.id);
  const last = list.find(
    (m) => m.workspace._id.toHexString() === session.user.lastWorkspaceId,
  );
  if (last) return last.workspace.slug;
  const personal = list.find(
    (m) => m.workspace.personal && m.workspace.ownerUserId === session.user.id,
  );
  if (personal) return personal.workspace.slug;
  if (list[0]) return list[0].workspace.slug;
  const created = await ensurePersonalWorkspace(await db(), {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    username: session.user.username,
    sub: session.user.sub,
  });
  return created.slug;
}
