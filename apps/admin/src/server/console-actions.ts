"use server";
import { createPolar, features as catalogFeatures } from "@shortn/billing";
import { consoleActions, consoleMutation, type Result } from "@shortn/core";
import { redirect } from "next/navigation";
import { runAdminAction, textOf, type ActionState } from "./action";
import { areas, jobCollections } from "./areas";
import { db } from "./db";
import { env } from "./env";
import { ObjectId } from "mongodb";

export async function submitConsoleAction(
  area: string,
  id: string,
  operation: string,
  kind: string,
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const action = consoleActions[`${area}/${operation}`];
  const config = areas[area];
  if (
    !action ||
    !config ||
    (!ObjectId.isValid(id) &&
      !(area === "jobs" && kind === "billing" && /^[\w.:-]{1,200}$/.test(id)))
  )
    return { error: "This action is unavailable." };
  const collectionName =
    area === "jobs" ? jobCollections[kind] : config.collection;
  if (!collectionName) return { error: "Unknown job queue." };
  const row = await (
    await db()
  )
    .collection<{
      _id: ObjectId | string;
      email?: string;
      slug?: string;
      key?: string;
      hostname?: string;
    }>(collectionName)
    .findOne(
      { _id: area === "jobs" && kind === "billing" ? id : new ObjectId(id) },
      { projection: { email: 1, slug: 1, key: 1, hostname: 1 } },
    );
  if (!row) return { error: "This record no longer exists." };
  const destructive = [
    "ban",
    "suspend",
    "remove",
    "takedown",
    "role",
    "delete",
    "revoke",
    "refund",
  ].includes(operation);
  const confirm = destructive
    ? String(row.email ?? row.slug ?? row.key ?? row.hostname ?? id)
    : undefined;
  const data: Record<string, string> = {};
  for (const name of [
    "category",
    "publicNote",
    "expiresAt",
    "plan",
    "limits",
    "flags",
    "clear",
    "role",
    "mode",
    "status",
    "assignee",
    "note",
    "orderId",
    "amount",
    "refundReason",
    "requestKey",
    "workspace",
    "confirm",
  ])
    data[name] = textOf(form, name, 4000);
  const kinds: Record<string, string> = {
    imports: "import",
    exports: "export",
    qr: "qr_export",
    zips: "qr_zip",
    bio: "bio_delivery",
    webhooks: "webhook_delivery",
    billing: "billing_event",
  };
  data.kind = kinds[kind] ?? "";
  if (operation === "override") {
    const limits: Record<string, number | null> = {};
    for (const key of [
      "links",
      "qrCodes",
      "bioPages",
      "seats",
      "workspaces",
      "analyticsDays",
      "apiPerMinute",
    ]) {
      const mode = textOf(form, `mode_${key}`);
      if (mode === "unlimited") limits[key] = null;
      if (mode === "custom") {
        const raw = textOf(form, `limit_${key}`);
        const value = Number(raw);
        if (!raw || !Number.isSafeInteger(value) || value < 0)
          return { error: `Enter a nonnegative whole number for ${key}.` };
        limits[key] = value;
      }
    }
    data.limits = JSON.stringify(limits);
    const add: string[] = [],
      remove: string[] = [];
    for (const feature of catalogFeatures) {
      const mode = textOf(form, `plan_feature_${feature}`);
      if (mode === "add") add.push(feature);
      if (mode === "remove") remove.push(feature);
    }
    data.planFeatures = JSON.stringify({ add, remove });
  }
  if (operation === "features") {
    const flags: Record<string, boolean> = {};
    for (const key of [
      "api",
      "mcp",
      "webhooks",
      "bulk",
      "linkRules",
      "advancedAuth",
    ]) {
      const value = textOf(form, `feature_${key}`);
      if (value === "on") flags[key] = true;
      else if (value === "off") flags[key] = false;
    }
    data.flags = JSON.stringify(flags);
  }
  let handoffToken: string | undefined;
  let handoffNext = "/";
  const result = await runAdminAction(
    action,
    form,
    async (ctx, reason): Promise<Result<unknown, string>> => {
      const result = await consoleMutation(
        ctx,
        area,
        id,
        operation,
        data,
        reason,
        area === "billing" && env().POLAR_ACCESS_TOKEN
          ? {
              polar: createPolar({
                accessToken: env().POLAR_ACCESS_TOKEN!,
                server: env().POLAR_ENVIRONMENT,
              }),
              server: env().POLAR_ENVIRONMENT,
            }
          : undefined,
      );
      if (
        result.ok &&
        result.value &&
        typeof result.value === "object" &&
        "handoffToken" in result.value
      ) {
        handoffToken = String(result.value.handoffToken);
        if ("next" in result.value) handoffNext = String(result.value.next);
      }
      return result;
    },
    {
      messages: {
        not_found:
          "This record no longer exists. Return to the list and select it again.",
        self_action: "You cannot apply this action to your own staff account.",
        superadmin_protected:
          "Change this account's role before banning it. Keep another superadmin available.",
        last_superadmin:
          "Keep another verified superadmin with two-factor authentication enrolled before demoting this account.",
        mfa_enrollment_required:
          "The target must verify their email and enroll two-factor authentication before becoming a superadmin.",
        transfer_shared_workspaces_first:
          "Transfer team workspaces with other members before scheduling account erasure.",
        invalid_expiry: "Choose an expiry date in the future.",
        invalid_override:
          "Check the plan, limits and expiry date, then try again.",
        workspace_not_available:
          "Enter the slug of a workspace this user belongs to.",
        target_unavailable:
          "Staff, suspended and deletion-pending accounts cannot be impersonated.",
        deleted_account: "This account has already been erased.",
        billing_unavailable: "Billing is not configured for this console.",
        invalid_refund:
          "Check the order ID and refundable amount. The order must belong to this subscription.",
        refund_already_submitted:
          "This refund request was already submitted. Check the Polar order before creating another request.",
        deletion_not_cancellable:
          "This deletion is no longer pending. Check the account's deletion status.",
        forbidden: "Your role cannot perform this action.",
        step_up_required: "Confirm with your authenticator, then submit again.",
      },
      done:
        operation === "impersonate"
          ? () =>
              handoffToken
                ? `${env().APP_URL}/api/auth/handoff?t=${encodeURIComponent(handoffToken)}&next=${encodeURIComponent(handoffNext)}`
                : `/users/${id}`
          : `/${area}/${id}${area === "jobs" ? `?kind=${kind}` : ""}`,
      ...(confirm ? { confirm } : {}),
    },
  );
  if (handoffToken)
    redirect(
      `${env().APP_URL}/api/auth/handoff?t=${encodeURIComponent(handoffToken)}&next=${encodeURIComponent(handoffNext)}`,
    );
  return result;
}
