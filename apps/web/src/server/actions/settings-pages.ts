"use server";

import { redirect } from "next/navigation";
import { requireSession, requireWorkspace } from "../workspace";
import {
  changePlanAction,
  checkoutAction,
  portalAction,
  invoiceAction,
  setCancelAction,
} from "./billing";
import {
  changeRoleAction,
  createWorkspaceAction,
  deleteWorkspaceAction,
  inviteMemberAction,
  removeMemberAction,
  revokeInviteAction,
  updateWorkspaceAction,
} from "./workspace";

// Form actions behind the settings pages (17): they read FormData, return
// errors to the form, and navigate on success with a one-line notice.

export interface SettingsFormState {
  error: string | null;
  field?: string | undefined;
  detail?: Record<string, string | number | null> | undefined;
}

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
};

const slugErrors = new Set(["invalid_slug", "slug_taken"]);
const fieldOfSlug = (error: string) =>
  slugErrors.has(error) ? "slug" : undefined;

type AssignableRole = "admin" | "member" | "viewer";
const isAssignableRole = (value: string): value is AssignableRole =>
  value === "admin" || value === "member" || value === "viewer";

type PaidPlan = "basic" | "plus" | "pro";
const isPaidPlan = (value: string): value is PaidPlan =>
  value === "basic" || value === "plus" || value === "pro";

// Polar hands back absolute URLs; anything else is not a place to send people.
const isExternalUrl = (value: string): value is `https://${string}` =>
  value.startsWith("https://");

export async function updateWorkspacePageAction(
  workspace: string,
  _state: SettingsFormState,
  form: FormData,
): Promise<SettingsFormState> {
  const name = text(form, "name");
  const slug = text(form, "slug").toLowerCase();
  if (!name) return { error: "name_required", field: "name" };
  if (!slug) return { error: "invalid_slug", field: "slug" };
  const result = await updateWorkspaceAction(workspace, {
    name: name.slice(0, 64),
    slug: slug.slice(0, 48),
  });
  if (!result.ok)
    return { error: result.error, field: fieldOfSlug(result.error) };
  redirect(`/${result.data.slug}/settings?saved=1`);
}

export async function createWorkspacePageAction(
  _state: SettingsFormState,
  form: FormData,
): Promise<SettingsFormState> {
  const name = text(form, "name");
  const slug = text(form, "slug").toLowerCase();
  if (!name) return { error: "name_required", field: "name" };
  if (!slug) return { error: "invalid_slug", field: "slug" };
  const result = await createWorkspaceAction({
    name: name.slice(0, 64),
    slug: slug.slice(0, 48),
  });
  if (!result.ok)
    return {
      error: result.error,
      field: fieldOfSlug(result.error),
      detail: result.detail,
    };
  redirect(`/${result.data.slug}/links`);
}

// Typing the name guards against deleting the wrong workspace from a stale tab.
export async function deleteWorkspacePageAction(
  workspace: string,
  _state: SettingsFormState,
  form: FormData,
): Promise<SettingsFormState> {
  const { workspace: current } = await requireWorkspace(workspace);
  if (text(form, "confirm") !== current.name.trim())
    return { error: "confirm_mismatch", field: "confirm" };
  const result = await deleteWorkspaceAction(workspace);
  if (!result.ok) return { error: result.error };
  redirect("/");
}

export async function inviteMemberPageAction(
  workspace: string,
  _state: SettingsFormState,
  form: FormData,
): Promise<SettingsFormState> {
  const email = text(form, "email");
  const role = text(form, "role");
  if (!email) return { error: "email_required", field: "email" };
  if (!isAssignableRole(role)) return { error: "invalid_input", field: "role" };
  const result = await inviteMemberAction(workspace, {
    email: email.slice(0, 254),
    role,
  });
  if (!result.ok)
    return {
      error: result.error,
      field:
        result.error === "invalid_email" ||
        result.error === "already_member" ||
        result.error === "invalid_input"
          ? "email"
          : undefined,
      detail: result.detail,
    };
  redirect(`/${workspace}/settings/members?invited=1`);
}

export async function changeRolePageAction(
  workspace: string,
  userId: string,
  _state: SettingsFormState,
  form: FormData,
): Promise<SettingsFormState> {
  const role = text(form, "role");
  if (!isAssignableRole(role)) return { error: "invalid_input" };
  const result = await changeRoleAction(workspace, userId, role);
  if (!result.ok) return { error: result.error };
  redirect(`/${workspace}/settings/members/${userId}?saved=1`);
}

export async function removeMemberPageAction(
  workspace: string,
  userId: string,
): Promise<{ error: string | null }> {
  const session = await requireSession();
  const result = await removeMemberAction(workspace, userId);
  if (!result.ok) return { error: result.error };
  if (userId === session.user.id) redirect("/");
  redirect(`/${workspace}/settings/members?removed=1`);
}

export async function revokeInvitePageAction(workspace: string, id: string) {
  const result = await revokeInviteAction(workspace, id);
  redirect(
    result.ok
      ? `/${workspace}/settings/members?revoked=1`
      : `/${workspace}/settings/members?failed=${result.error === "forbidden" ? "forbidden" : "revoke"}`,
  );
}

export async function checkoutPageAction(
  workspace: string,
  plan: string,
): Promise<SettingsFormState> {
  if (!isPaidPlan(plan)) return { error: "invalid_input" };
  const result = await checkoutAction(workspace, plan);
  if (!result.ok) return { error: result.error };
  if (!isExternalUrl(result.data.url)) return { error: "generic" };
  redirect(result.data.url);
}

export async function portalPageAction(workspace: string) {
  const result = await portalAction(workspace);
  if (result.ok && isExternalUrl(result.data.url)) redirect(result.data.url);
  redirect(`/${workspace}/settings/billing?failed=portal`);
}

export async function invoicePageAction(workspace: string, orderId: string) {
  const result = await invoiceAction(workspace, orderId);
  if (!result.ok && result.error === "invoice_pending")
    redirect(`/${workspace}/settings/billing?pending=invoice`);
  if (result.ok && isExternalUrl(result.data.url)) redirect(result.data.url);
  redirect(`/${workspace}/settings/billing?failed=invoice`);
}

export async function changePlanPageAction(
  workspace: string,
  plan: string,
): Promise<SettingsFormState> {
  if (!isPaidPlan(plan)) return { error: "invalid_input" };
  const result = await changePlanAction(workspace, plan);
  if (!result.ok) return { error: result.error };
  redirect(
    `/${workspace}/settings/billing?changed=${plan}&when=${result.data.when}`,
  );
}

export async function cancelPlanPageAction(
  workspace: string,
): Promise<SettingsFormState> {
  const result = await setCancelAction(workspace, true);
  if (!result.ok) return { error: result.error };
  redirect(`/${workspace}/settings/billing?cancelled=1`);
}

export async function resumePlanPageAction(workspace: string) {
  const result = await setCancelAction(workspace, false);
  redirect(
    result.ok
      ? `/${workspace}/settings/billing?resumed=1`
      : `/${workspace}/settings/billing?failed=resume`,
  );
}
