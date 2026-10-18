"use server";

import {
  changePlan,
  checkoutUrl,
  createPolar,
  loadEntitlements,
  paidStatuses,
  paymentHistory,
  plans,
  portalUrl,
  setCancelAtPeriodEnd,
  type PlanId,
} from "@shortn/billing";
import { can, countUsage } from "@shortn/core";
import { collection } from "@shortn/db";
import { z } from "zod";
import { serviceContext } from "../context";
import { env } from "../env";
import { requireSession } from "../workspace";
import { invalidInput, type ActionResult } from "./result";

export interface BillingOverview {
  plan: PlanId;
  limits: (typeof plans)[PlanId]["limits"];
  features: readonly string[];
  usage: { links: number; qrCodes: number; bioPages: number };
  period: { start: string; end: string };
  subscription: {
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string;
    scheduledChange: { plan: PlanId | null; at: string } | null;
  } | null;
  // Plan changes and cancellation stay in legacy until the billing switch (16 D8).
  writesEnabled: boolean;
  canManage: boolean;
  catalog: {
    plan: PlanId;
    priceUsdMonthly: number | null;
    limits: (typeof plans)[PlanId]["limits"];
    features: readonly string[];
  }[];
}

const polar = () => {
  const e = env();
  return createPolar({
    accessToken: e.POLAR_ACCESS_TOKEN,
    server: e.POLAR_ENVIRONMENT,
  });
};

export async function billingOverviewAction(
  workspace: string,
): Promise<BillingOverview> {
  const ctx = await serviceContext(workspace);
  const entitlements = await loadEntitlements(ctx.db, ctx.workspace._id);
  const usage = await countUsage(ctx.db, ctx.workspace, entitlements.period);
  const mirror = entitlements.subscription
    ? await collection(ctx.db, "subscriptions").findOne({
        polarSubscriptionId: entitlements.subscription.id,
      })
    : null;
  return {
    plan: entitlements.plan,
    limits: entitlements.limits,
    features: entitlements.features,
    usage,
    period: {
      start: entitlements.period.start.toISOString(),
      end: entitlements.period.end.toISOString(),
    },
    subscription: mirror
      ? {
          status: mirror.status,
          cancelAtPeriodEnd: mirror.cancelAtPeriodEnd,
          currentPeriodEnd: mirror.currentPeriodEnd.toISOString(),
          scheduledChange: mirror.scheduledChange
            ? {
                plan: mirror.scheduledChange.plan ?? null,
                at: mirror.scheduledChange.at.toISOString(),
              }
            : null,
        }
      : null,
    writesEnabled: env().BILLING_WRITES === "1",
    canManage: can(ctx.actor, "billing.manage"),
    catalog: (Object.keys(plans) as PlanId[]).map((plan) => ({
      plan,
      priceUsdMonthly: plans[plan].priceUsdMonthly,
      limits: plans[plan].limits,
      features: plans[plan].features,
    })),
  };
}

const paidPlan = z.enum(["basic", "plus", "pro"]);

export async function paymentHistoryAction(workspace: string, page = 1) {
  const ctx = await serviceContext(workspace);
  if (!can(ctx.actor, "billing.manage"))
    return { ok: false, error: "forbidden" } as const;
  const subscriptions = await collection(ctx.db, "subscriptions")
    .find({ workspaceId: ctx.workspace._id })
    .toArray();
  const safePage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  try {
    const data = await paymentHistory(
      polar(),
      ctx.workspace.ownerUserId,
      subscriptions.map((sub) => sub.polarSubscriptionId),
      safePage,
    );
    return { ok: true, data } as const;
  } catch {
    return { ok: false, error: "generic" } as const;
  }
}

export async function invoiceAction(
  workspace: string,
  orderId: string,
): Promise<ActionResult<{ url: string }>> {
  if (!z.uuid().safeParse(orderId).success) return invalidInput;
  const ctx = await serviceContext(workspace);
  if (!can(ctx.actor, "billing.manage"))
    return { ok: false, error: "forbidden" };
  try {
    const client = polar();
    const order = await client.orders.get({ id: orderId });
    const subscription =
      order.subscriptionId &&
      (await collection(ctx.db, "subscriptions").findOne({
        workspaceId: ctx.workspace._id,
        polarSubscriptionId: order.subscriptionId,
        polarCustomerId: order.customerId,
      }));
    if (!subscription) return { ok: false, error: "not_found" };
    if (!order.isInvoiceGenerated) {
      if (!["paid", "refunded", "partially_refunded"].includes(order.status))
        return { ok: false, error: "not_found" };
      await client.orders.generateInvoice({ id: orderId });
      return { ok: false, error: "invoice_pending" };
    }
    return { ok: true, data: await client.orders.invoice({ id: orderId }) };
  } catch {
    return { ok: false, error: "generic" };
  }
}

// The workspace owner is the Polar customer; metadata.workspaceId decides
// which workspace the subscription funds (06 §Data).
export async function checkoutAction(
  workspace: string,
  plan: "basic" | "plus" | "pro",
): Promise<ActionResult<{ url: string }>> {
  if (!paidPlan.safeParse(plan).success) return invalidInput;
  const ctx = await serviceContext(workspace);
  if (!can(ctx.actor, "billing.manage"))
    return { ok: false, error: "forbidden" };
  const paid = await collection(ctx.db, "subscriptions").countDocuments({
    workspaceId: ctx.workspace._id,
    status: { $in: [...paidStatuses] },
  });
  if (paid) return { ok: false, error: "already_subscribed" };
  const session = await requireSession();
  const base = `${env().BETTER_AUTH_URL}/${ctx.workspace.slug}/settings/billing`;
  try {
    const url = await checkoutUrl(polar(), env().POLAR_ENVIRONMENT, {
      plan,
      workspaceId: ctx.workspace._id,
      customerExternalId: ctx.workspace.ownerUserId,
      customerEmail: session.user.email,
      successUrl: `${base}?checkout={CHECKOUT_ID}`,
      returnUrl: base,
    });
    return { ok: true, data: { url } };
  } catch {
    return { ok: false, error: "generic" };
  }
}

export async function portalAction(
  workspace: string,
): Promise<ActionResult<{ url: string }>> {
  const ctx = await serviceContext(workspace);
  if (!can(ctx.actor, "billing.manage"))
    return { ok: false, error: "forbidden" };
  try {
    const url = await portalUrl(
      polar(),
      ctx.workspace.ownerUserId,
      `${env().BETTER_AUTH_URL}/${ctx.workspace.slug}/settings/billing`,
    );
    return { ok: true, data: { url } };
  } catch {
    return { ok: false, error: "generic" };
  }
}

async function currentMirror(workspace: string) {
  const ctx = await serviceContext(workspace);
  if (!can(ctx.actor, "billing.manage")) return { error: "forbidden" } as const;
  if (env().BILLING_WRITES !== "1")
    return { error: "billing_writes_disabled" } as const;
  const mirror = await collection(ctx.db, "subscriptions").findOne(
    {
      workspaceId: ctx.workspace._id,
      status: { $in: [...paidStatuses] },
      plan: { $ne: "enterprise" },
    },
    { sort: { currentPeriodEnd: -1 } },
  );
  return mirror
    ? ({ mirror } as const)
    : ({ error: "not_subscribed" } as const);
}

export async function changePlanAction(
  workspace: string,
  target: "basic" | "plus" | "pro",
): Promise<ActionResult<{ when: "now" | "next_period" }>> {
  if (!paidPlan.safeParse(target).success) return invalidInput;
  const found = await currentMirror(workspace);
  if ("error" in found) return { ok: false, error: found.error };
  try {
    const result = await changePlan(
      polar(),
      env().POLAR_ENVIRONMENT,
      found.mirror,
      target,
    );
    return result.ok
      ? { ok: true, data: { when: result.when } }
      : { ok: false, error: result.error };
  } catch {
    return { ok: false, error: "generic" };
  }
}

export async function setCancelAction(
  workspace: string,
  cancel: boolean,
): Promise<ActionResult<null>> {
  const found = await currentMirror(workspace);
  if ("error" in found) return { ok: false, error: found.error };
  try {
    await setCancelAtPeriodEnd(polar(), found.mirror, cancel);
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: "generic" };
  }
}
