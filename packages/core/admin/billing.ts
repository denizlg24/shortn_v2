import { collection, physicalNames } from "@shortn/db";
import {
  applySubscription,
  setCancelAtPeriodEnd,
  type createPolar,
  type PolarServer,
} from "@shortn/billing";
import type { ObjectId } from "mongodb";
import { z } from "zod";
import type { AdminContext } from "./context";
import { ok, fail } from "../result";
export type AdminPolar = ReturnType<typeof createPolar>;
export async function mutateAdminBilling(
  ctx: AdminContext,
  id: ObjectId,
  operation: string,
  data: Record<string, string>,
  reason: string,
  polar: AdminPolar,
  server: PolarServer,
) {
  const mirror = await collection(ctx.db, "subscriptions").findOne({ _id: id });
  if (!mirror) return fail("not_found");
  if (operation === "cancel" || operation === "uncancel")
    await setCancelAtPeriodEnd(polar, mirror, operation === "cancel");
  else if (operation === "revoke")
    await polar.subscriptions.revoke({ id: mirror.polarSubscriptionId });
  else if (operation === "refund") {
    const parsed = z
      .object({
        orderId: z.uuid(),
        amount: z.coerce.number().int().positive(),
        refundReason: z.enum([
          "duplicate",
          "fraudulent",
          "customer_request",
          "service_disruption",
          "satisfaction_guarantee",
          "other",
        ]),
        requestKey: z.uuid(),
      })
      .safeParse(data);
    if (!parsed.success) return fail("invalid_refund");
    const input = parsed.data;
    const order = await polar.orders.get({ id: input.orderId });
    if (
      order.subscriptionId !== mirror.polarSubscriptionId ||
      input.amount > order.refundableAmount
    )
      return fail("invalid_refund");
    // A repeated form cannot issue a second refund, including after an uncertain network result.
    const intents = ctx.db.collection<{
      _id: string;
      at: Date;
      orderId: string;
      amount: number;
      refundId?: string;
    }>(physicalNames.admin_refund_intents);
    try {
      await intents.insertOne({
        _id: input.requestKey,
        at: ctx.now(),
        orderId: input.orderId,
        amount: input.amount,
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === 11000
      )
        return fail("refund_already_submitted");
      throw error;
    }
    const refund = await polar.refunds.create({
      orderId: input.orderId,
      amount: input.amount,
      reason: input.refundReason,
      comment: reason,
      revokeBenefits: false,
      metadata: { adminId: ctx.admin.id, requestKey: input.requestKey },
    });
    await intents.updateOne(
      { _id: input.requestKey },
      { $set: { refundId: refund.id } },
    );
  } else return fail("invalid_action");
  const applied = await applySubscription(
    ctx.db,
    polar,
    server,
    mirror.polarSubscriptionId,
  );
  return ok({
    polarSubscriptionId: mirror.polarSubscriptionId,
    mirror: applied.status,
  });
}
