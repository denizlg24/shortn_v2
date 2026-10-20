import { collection, type Documents } from "@shortn/db";
import { ObjectId, type Db } from "mongodb";
import type { ReadOnlyReason } from "./authz";

export type WorkspaceAccess = "active" | "locked" | "suspended";

type Suspendable = Pick<Documents["workspaces"], "suspension">;

/** Staff suspension (23 §3.2). Both levels make the workspace read-only;
 * "suspended" also stops public delivery. */
export function workspaceAccess(workspace: Suspendable): WorkspaceAccess {
  const level = workspace.suspension?.level;
  return level === "suspended"
    ? "suspended"
    : level === "locked"
      ? "locked"
      : "active";
}

export function workspaceReadOnly(
  workspace: Suspendable,
): ReadOnlyReason | undefined {
  const access = workspaceAccess(workspace);
  return access === "active" ? undefined : access;
}

export const isWorkspaceSuspended = (workspace: Suspendable) =>
  workspaceAccess(workspace) === "suspended";

/** One indexed read for public surfaces (bio, custom domains) that hold only
 * a workspace id. */
export async function workspaceIsSuspended(
  db: Db,
  workspaceId: unknown,
): Promise<boolean> {
  if (!(workspaceId instanceof ObjectId)) return false;
  return Boolean(
    await collection(db, "workspaces").findOne(
      { _id: workspaceId, "suspension.level": "suspended" },
      { projection: { _id: 1 } },
    ),
  );
}
