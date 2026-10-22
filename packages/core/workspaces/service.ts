import { collection, personalWorkspaceSlug, type Documents } from "@shortn/db";
import { ObjectId, type Db, type Filter } from "mongodb";
import type { Actor, Role } from "./authz";
import { workspaceReadOnly } from "./status";

export type Workspace = Documents["workspaces"];

export interface UserIdentity {
  id: string;
  name?: string | null | undefined;
  username?: string | null | undefined;
  email?: string | null | undefined;
  sub?: string | null | undefined;
}

export interface WorkspaceContext {
  workspace: Workspace;
  actor: Actor;
}

export const defaultLinkDomain = "shortn.at";

// Same upsert as M2, so whichever runs first wins and the other is a no-op.
export async function ensurePersonalWorkspace(
  db: Db,
  user: UserIdentity,
): Promise<Workspace> {
  const now = new Date();
  const workspaces = collection(db, "workspaces");
  const workspace = await workspaces.findOneAndUpdate(
    { ownerUserId: user.id, personal: true },
    {
      $setOnInsert: {
        slug: personalWorkspaceSlug({
          _id: user.id,
          username: user.username ?? undefined,
          name: user.name ?? undefined,
          email: user.email ?? undefined,
        }),
        name: user.name || user.username || "Personal",
        ownerUserId: user.id,
        personal: true,
        plan: "free",
        addOns: [],
        defaultDomain: defaultLinkDomain,
        ...(user.sub ? { legacySub: user.sub } : {}),
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true, returnDocument: "after" },
  );
  if (!workspace) throw new Error("Personal workspace upsert returned nothing");
  await collection(db, "workspace_members").updateOne(
    { workspaceId: workspace._id, userId: user.id },
    {
      $setOnInsert: {
        workspaceId: workspace._id,
        userId: user.id,
        role: "owner",
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true },
  );
  return workspace;
}

export interface Membership {
  workspace: Workspace;
  role: Role;
}

export async function membershipsFor(
  db: Db,
  userId: string,
): Promise<Membership[]> {
  const members = await collection(db, "workspace_members")
    .find({ userId })
    .toArray();
  if (!members.length) return [];
  const workspaces = await collection(db, "workspaces")
    .find({ _id: { $in: members.map((member) => member.workspaceId) } })
    .toArray();
  const byId = new Map(workspaces.map((ws) => [ws._id.toHexString(), ws]));
  return members
    .flatMap((member) => {
      const workspace = byId.get(member.workspaceId.toHexString());
      return workspace ? [{ workspace, role: member.role }] : [];
    })
    .sort(
      (a, b) =>
        Number(b.workspace.personal) - Number(a.workspace.personal) ||
        a.workspace.name.localeCompare(b.workspace.name),
    );
}

export async function workspaceContext(
  db: Db,
  userId: string,
  slug: string,
): Promise<WorkspaceContext | null> {
  const workspace = await collection(db, "workspaces").findOne({ slug });
  if (!workspace) return null;
  const member = await collection(db, "workspace_members").findOne({
    workspaceId: workspace._id,
    userId,
  });
  if (!member) return null;
  const readOnly = workspaceReadOnly(workspace);
  return {
    workspace,
    actor: { userId, role: member.role, ...(readOnly ? { readOnly } : {}) },
  };
}

// Legacy creates documents with `sub` only; continuous M2 assigns the
// workspace within a minute. Until then a personal workspace also owns its
// owner's unassigned documents (05 §Migration of ownership).
export function ownedBy<T extends { workspaceId?: ObjectId | undefined }>(
  workspace: Workspace,
  legacyOwnerField: "sub" | "userId" = "sub",
): Filter<T> {
  const assigned = { workspaceId: workspace._id } as Filter<T>;
  if (!workspace.personal || !workspace.legacySub) return assigned;
  return {
    $or: [
      assigned,
      {
        workspaceId: { $exists: false },
        [legacyOwnerField]: workspace.legacySub,
      },
    ],
  } as Filter<T>;
}

export function parseObjectId(value: string): ObjectId | null {
  return ObjectId.isValid(value) && /^[a-f0-9]{24}$/i.test(value)
    ? new ObjectId(value)
    : null;
}
