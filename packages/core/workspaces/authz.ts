import type { Documents } from "@shortn/db";

export type Role = Documents["workspace_members"]["role"];

export type Action =
  | "workspace.view"
  | "resource.create"
  | "resource.update"
  | "resource.delete"
  | "domains.manage"
  | "apiKeys.manage"
  | "apiKeys.revoke"
  | "webhooks.manage"
  | "members.manage"
  | "members.remove"
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
  "apiKeys.revoke": "admin",
  "webhooks.manage": "admin",
  "members.manage": "admin",
  "members.remove": "admin",
  "workspace.update": "admin",
  "billing.manage": "owner",
  "workspace.delete": "owner",
};

const rank: Record<Role, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };

/** Why an otherwise authorized actor may only read: a staff lock or
 * suspension of the workspace. */
export type ReadOnlyReason = "locked" | "suspended";

// A locked or suspended owner can still pay or cancel, and take safety
// actions that only reduce access: revoke API keys, remove members and
// revoke invites (23 §7 A3).
const readOnlyAllows: readonly Action[] = [
  "workspace.view",
  "billing.manage",
  "apiKeys.revoke",
  "members.remove",
];

// Staff impersonating a user never act on the account's money, credentials
// or existence, in either mode (23 §3.6).
const impersonationDenies: readonly Action[] = [
  "billing.manage",
  "apiKeys.manage",
  "apiKeys.revoke",
  "workspace.delete",
];

export interface Actor {
  userId: string;
  role: Role;
  readOnly?: ReadOnlyReason | undefined;
  /** Set for a staff impersonation session; "read" allows viewing only. */
  impersonation?: "read" | "write" | undefined;
  /** Set when platform staff act through a service on the user's behalf. */
  via?: { kind: "platform"; adminId: string } | undefined;
}

// Members may edit any resource but delete only their own (05 §Roles).
export function can(
  actor: Actor,
  action: Action,
  resource?: { createdBy?: string | undefined },
): boolean {
  if (actor.readOnly && !readOnlyAllows.includes(action)) return false;
  if (actor.impersonation === "read" && action !== "workspace.view")
    return false;
  if (actor.impersonation && impersonationDenies.includes(action)) return false;
  if (rank[actor.role] < rank[minimum[action]]) return false;
  if (action === "resource.delete" && actor.role === "member")
    return resource?.createdBy === actor.userId;
  return true;
}
