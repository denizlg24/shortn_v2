import type { adminRoles } from "@shortn/db";

export type AdminRole = (typeof adminRoles)[number];

/** Every staff action the console can take (23 §1.3). */
export type AdminAction =
  | "read"
  | "user.sessions.revoke"
  | "user.ban"
  | "user.ban.staff"
  | "workspace.suspend"
  | "link.takedown"
  | "link.takedown.bulk"
  | "report.resolve"
  | "workspace.override"
  | "workspace.override.extended"
  | "subscription.cancel"
  | "subscription.revoke"
  | "user.impersonate"
  | "user.impersonate.write"
  | "user.role.update"
  | "domain.reverify"
  | "domain.suspend"
  | "webhook.manage"
  | "job.manage"
  | "contact.triage"
  | "feedback.triage"
  | "user.delete";

export interface AdminRule {
  roles: readonly AdminRole[];
  /** Needs `elevatedAt` within `stepUpWindowMs`. */
  stepUp: boolean;
  reason: boolean;
}

const both = ["admin", "superadmin"] as const;
const superOnly = ["superadmin"] as const;
const rule = (
  roles: readonly AdminRole[],
  stepUp: boolean,
  reason: boolean,
): AdminRule => ({ roles, stepUp, reason });

export const adminPermissions: Record<AdminAction, AdminRule> = {
  read: rule(both, false, false),
  "user.sessions.revoke": rule(both, false, true),
  "user.ban": rule(both, true, true),
  "user.ban.staff": rule(superOnly, true, true),
  "workspace.suspend": rule(both, true, true),
  "link.takedown": rule(both, false, true),
  "link.takedown.bulk": rule(superOnly, true, true),
  "report.resolve": rule(both, false, false),
  "workspace.override": rule(both, true, true),
  "workspace.override.extended": rule(superOnly, true, true),
  "subscription.cancel": rule(both, true, true),
  "subscription.revoke": rule(superOnly, true, true),
  "user.impersonate": rule(both, true, true),
  "user.impersonate.write": rule(superOnly, true, true),
  "user.role.update": rule(superOnly, true, true),
  "domain.reverify": rule(both, false, false),
  "domain.suspend": rule(both, true, true),
  "webhook.manage": rule(both, false, true),
  "job.manage": rule(both, false, false),
  "contact.triage": rule(both, false, false),
  "feedback.triage": rule(both, false, false),
  "user.delete": rule(superOnly, true, true),
};

export const stepUpWindowMs = 10 * 60_000;

/** Item caps for selection-wide operations (23 §3.3). */
export const bulkLimits = { admin: 100, superadmin: 1000 } as const;

export type AdminDenial = "forbidden" | "step_up_required" | "reason_required";

export interface AdminPrincipal {
  role: AdminRole;
  elevatedAt?: Date | undefined;
}

/** The one permission check the UI and every action share. `reason` is the
 * submitted reason, if any; pass `undefined` when only asking whether to
 * render a control. */
export function adminDenial(
  principal: AdminPrincipal,
  action: AdminAction,
  options: { reason?: string | undefined; now?: Date } = {},
): AdminDenial | null {
  const required = adminPermissions[action];
  if (!required.roles.includes(principal.role)) return "forbidden";
  const now = options.now ?? new Date();
  if (
    required.stepUp &&
    (!principal.elevatedAt ||
      now.getTime() - principal.elevatedAt.getTime() > stepUpWindowMs)
  )
    return "step_up_required";
  if (required.reason && "reason" in options && !options.reason?.trim())
    return "reason_required";
  return null;
}

export const adminCan = (principal: AdminPrincipal, action: AdminAction) =>
  adminPermissions[action].roles.includes(principal.role);
