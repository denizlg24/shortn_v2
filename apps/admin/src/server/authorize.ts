import "server-only";
import {
  adminDenial,
  adminPermissions,
  fail,
  ok,
  type AdminAction,
  type AdminContext,
  type AdminDenial,
  type Result,
} from "@shortn/core";
import { consumeAdminRate, type RateClass } from "./rate-limit";
import { contextFor, currentAdmin } from "./session";

export type AuthorizeError = AdminDenial | "unauthenticated" | "rate_limited";

/** The gate in front of every staff mutation: a live session, the role
 * matrix, step-up and reason (23 §1.3), then the rate class (§1.5). */
export async function authorize(
  action: AdminAction,
  options: { reason?: string | undefined; rate?: RateClass } = {},
): Promise<Result<AdminContext, AuthorizeError>> {
  const current = await currentAdmin();
  if (!current) return fail("unauthenticated");
  const denial = adminDenial(
    { role: current.admin.role, elevatedAt: current.session.elevatedAt },
    action,
    "reason" in options ? { reason: options.reason } : {},
  );
  if (denial) return fail(denial);
  const rate =
    options.rate ?? (adminPermissions[action].stepUp ? "sensitive" : "mutate");
  if (!(await consumeAdminRate(current.admin.id, rate)))
    return fail("rate_limited");
  return ok(await contextFor(current));
}

export const authorizeMessages: Record<AuthorizeError, string> = {
  unauthenticated: "Your admin session ended. Sign in again.",
  forbidden: "Your role can't do this.",
  step_up_required: "Confirm with your authenticator first.",
  reason_required: "Give a reason.",
  rate_limited: "Too many actions in a short time. Wait a minute.",
};
