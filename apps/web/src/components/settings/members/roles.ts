import type { MemberView, Role } from "@shortn/core";

export type AssignableRole = Exclude<Role, "owner">;

export interface Actor {
  userId: string;
  role: Role;
}

// Mirrors packages/core members.ts so the UI disables what the server would
// refuse; the server stays the authority.
const rank: Record<Role, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };

export const canManageMembers = (actor: Actor) => rank[actor.role] >= 2;

export const assignableRoles = (actor: Actor): AssignableRole[] =>
  actor.role === "owner" ? ["admin", "member", "viewer"] : ["member", "viewer"];

export const isAssignableRole = (value: string): value is AssignableRole =>
  value === "admin" || value === "member" || value === "viewer";

/** Why `actor` can't change or remove `target`, or null when they can. */
export function memberBlock(
  actor: Actor,
  target: Pick<MemberView, "userId" | "role">,
): "readOnly" | "adminOwnerOnly" | null {
  if (!canManageMembers(actor)) return "readOnly";
  if (target.role === "admin" && actor.role !== "owner")
    return "adminOwnerOnly";
  return null;
}
