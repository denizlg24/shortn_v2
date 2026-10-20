import type { Documents } from "@shortn/db";

export type Role = Documents["workspace_members"]["role"];

export type Action =
  | "workspace.view"
  | "resource.create"
  | "resource.update"
  | "resource.delete"
  | "domains.manage"
  | "apiKeys.manage"
  | "webhooks.manage"
  | "members.manage"
  | "workspace.update"
  | "billing.manage"
  | "workspace.delete";

const minimum: Record<Action, Role> = {
  "workspace.view": "viewer",
  "resource.create": "member",
  "resource.update": "member",
  "resource.delete": "member",
  "domains.manage": "admin",
  "apiKeys.manage": "admin",
  "webhooks.manage": "admin",
  "members.manage": "admin",
  "workspace.update": "admin",
  "billing.manage": "owner",
  "workspace.delete": "owner",
};

const rank: Record<Role, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };

/** Why an otherwise authorized actor may only read: a staff lock or
 * suspension of the workspace, or a read-only impersonation session. */
export type ReadOnlyReason = "locked" | "suspended" | "impersonation";

// A locked or suspended owner can still pay or cancel; staff impersonating in
// read-only mode can't touch billing at all.
const readOnlyAllows: Record<ReadOnlyReason, readonly Action[]> = {
  locked: ["workspace.view", "billing.manage"],
  suspended: ["workspace.view", "billing.manage"],
  impersonation: ["workspace.view"],
};

export interface Actor {
  userId: string;
  role: Role;
  readOnly?: ReadOnlyReason | undefined;
  /** Set when platform staff act through a service on the user's behalf. */
  via?: { kind: "platform"; adminId: string } | undefined;
}

// Members may edit any resource but delete only their own (05 §Roles).
export function can(
  actor: Actor,
  action: Action,
  resource?: { createdBy?: string | undefined },
): boolean {
  if (actor.readOnly && !readOnlyAllows[actor.readOnly].includes(action))
    return false;
  if (rank[actor.role] < rank[minimum[action]]) return false;
  if (action === "resource.delete" && actor.role === "member")
    return resource?.createdBy === actor.userId;
  return true;
}
