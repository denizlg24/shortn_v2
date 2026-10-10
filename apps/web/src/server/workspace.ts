import "server-only";
import {
  ensurePersonalWorkspace,
  membershipsFor,
  workspaceContext,
} from "@shortn/core";
import { physicalNames } from "@shortn/db";
import { ObjectId } from "mongodb";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { getSession } from "./auth";
import { db } from "./db";

export type SessionData = NonNullable<Awaited<ReturnType<typeof getSession>>>;

export const requireSession = cache(async (): Promise<SessionData> => {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
});

export const requireWorkspace = cache(async (slug: string) => {
  const session = await requireSession();
  const context = await workspaceContext(await db(), session.user.id, slug);
  if (!context) notFound();
  if (session.user.lastWorkspaceId !== context.workspace._id.toHexString())
    await rememberWorkspace(session.user.id, context.workspace._id);
  return { session, ...context };
});

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
