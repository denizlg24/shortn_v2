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

export interface Actor {
  userId: string;
  role: Role;
}

// Members may edit any resource but delete only their own (05 §Roles).
export function can(
  actor: Actor,
  action: Action,
  resource?: { createdBy?: string | undefined },
): boolean {
  if (rank[actor.role] < rank[minimum[action]]) return false;
  if (action === "resource.delete" && actor.role === "member")
    return resource?.createdBy === actor.userId;
  return true;
}
