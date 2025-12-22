import { getUserPlan } from "@/app/actions/polarActions";
import { auth } from "@/lib/auth";
import { polarClient } from "@/lib/polar";
import { signSubscriptionId } from "@/lib/url-signature";
import { getBaseUrl } from "@/lib/utils";
import { connectDB } from "@/lib/mongodb";
import ScheduledChange from "@/models/subscription/ScheduledChange";
import env from "@/utils/env";
import { NextResponse } from "next/server";
import { z } from "zod";
import { SubscriptionsType } from "@/utils/plan-utils";

const createCheckoutSessionDTO = z.object({
  slug: z.enum(["pro", "plus", "basic"]),
  downgrade: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = await createCheckoutSessionDTO.safeParseAsync(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Malformed input." },
        { status: 400 },
      );
    }
    const data = await auth.api.getSession({
      headers: req.headers,
    });
    if (!data?.user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 },
      );
    }
    const { id } = await getUserPlan();
    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No active subscription found. Please use the create session endpoint.",
        },
        { status: 400 },
      );
    }

    try {
      const newProductId =
        parsed.data.slug === "pro"
          ? env.PRO_PLAN_ID
          : parsed.data.slug === "plus"
            ? env.PLUS_PLAN_ID
            : env.BASIC_PLAN_ID;

      await connectDB();

      if (parsed.data.downgrade) {
        const existingChange = await ScheduledChange.findOne({
          subscriptionId: id,
          status: "pending",
        });

        if (existingChange) {
          return NextResponse.json(
            {
              success: false,
              message:
                "There is already a pending change for this subscription. Please revert the existing change first.",
            },
            { status: 400 },
          );
        }

        const subscription = await polarClient.subscriptions.get({ id });

        if (!subscription.currentPeriodEnd) {
          return NextResponse.json(
            {
              success: false,
              message: "Subscription has no current period end date",
            },
            { status: 400 },
          );
        }

        let currentPlan: SubscriptionsType = "free";
        if (subscription.product?.name) {
          switch (subscription.product.id) {
            case env.PRO_PLAN_ID:
              currentPlan = "pro";
              break;
            case env.PLUS_PLAN_ID:
              currentPlan = "plus";
              break;
            case env.BASIC_PLAN_ID:
              currentPlan = "basic";
              break;
          }
        }

        const executeAt = new Date(subscription.currentPeriodEnd);
        const delayInSeconds = Math.floor(
          (executeAt.getTime() - Date.now()) / 1000,
        );

        const QSTASH_MAX_DELAY = 604800;
        let qstashMessageId: string | undefined;

        if (delayInSeconds <= QSTASH_MAX_DELAY && delayInSeconds > 0) {
          const { qstashClient } = await import("@/lib/qstash");

          const result = await qstashClient.publishJSON({
            retries: 1,
            body: {
              subscriptionId: id,
              newProductId,
              customerId: subscription.customerId,
              targetPlan: parsed.data.slug,
            },
            url: `${getBaseUrl()}/api/polar/execute-downgrade`,
            delay: delayInSeconds,
          });

          qstashMessageId = result.messageId;
          console.log(`Scheduled downgrade with QStash: ${result.messageId}`);
        } else {
          console.log(
            `Delay exceeds QStash limit (${delayInSeconds}s > ${QSTASH_MAX_DELAY}s). Will rely on period end webhook.`,
          );
        }

        const scheduledChange = await ScheduledChange.create({
          userId: data.user.id,
          subscriptionId: id,
          changeType: "downgrade",
          currentPlan,
          targetPlan: parsed.data.slug as SubscriptionsType,
          scheduledFor: executeAt,
          qstashMessageId,
          status: "pending",
        });

        console.log(`Scheduled downgrade for subscription ${id}`);
        console.log(`Will execute at: ${executeAt.toISOString()}`);
        console.log(`Saved to database with ID: ${scheduledChange._id}`);

        return NextResponse.json({
          success: true,
          subscription: {
            slug: parsed.data.slug,
            ...subscription,
          },
          signature: signSubscriptionId(subscription.id),
          isDowngrade: true,
          scheduledFor: executeAt.toISOString(),
          qstashMessageId,
          changeId: scheduledChange._id,
        });
      }

      const pendingChange = await ScheduledChange.findOne({
        subscriptionId: id,
        status: "pending",
      });

      if (pendingChange) {
        const currentSubscription = await polarClient.subscriptions.get({ id });
        if (currentSubscription.cancelAtPeriodEnd) {
          await polarClient.subscriptions.update({
            id,
            subscriptionUpdate: {
              cancelAtPeriodEnd: false,
            },
          });

          pendingChange.status = "reverted";
          await pendingChange.save();

          console.log(`Reactivated subscription ${id} before upgrade`);
        }
      }

      const subscription = await polarClient.subscriptions.update({
        id,
        subscriptionUpdate: {
          productId: newProductId,

          prorationBehavior: "invoice",
          cancelAtPeriodEnd: false,
        },
      });

      return NextResponse.json({
        success: true,
        subscription: {
          slug: parsed.data.slug,
          ...subscription,
        },
        signature: signSubscriptionId(subscription.id),
        isDowngrade: false,
      });
    } catch (polarError: unknown) {
      console.error("Polar API error:", polarError);

      const errorMessage =
        polarError instanceof Error ? polarError.message : String(polarError);
      const isPaymentError =
        errorMessage.toLowerCase().includes("payment") ||
        errorMessage.toLowerCase().includes("card") ||
        errorMessage.toLowerCase().includes("invoice");

      return NextResponse.json(
        {
          success: false,
          message: isPaymentError
            ? "Payment failed. Please check your payment method and try again."
            : "Failed to update subscription. Please try again or contact support.",
          paymentFailed: isPaymentError,
        },
        { status: 402 },
      );
    }
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "An unexpected error occurred. Please try again.",
      },
      { status: 500 },
    );
  }
}
