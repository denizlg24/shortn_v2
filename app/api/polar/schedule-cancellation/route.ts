import { getUserPlan } from "@/app/actions/polarActions";
import { auth } from "@/lib/auth";
import { polarClient } from "@/lib/polar";
import { connectDB } from "@/lib/mongodb";
import ScheduledChange from "@/models/subscription/ScheduledChange";
import { NextResponse } from "next/server";
import { z } from "zod";
import { SubscriptionsType } from "@/utils/plan-utils";

const scheduleCancellationDTO = z.object({
  reason: z.string().optional(),
  comment: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = await scheduleCancellationDTO.safeParseAsync(body);
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
          message: "No active subscription found.",
        },
        { status: 400 },
      );
    }

    await connectDB();

    try {
      const existingChange = await ScheduledChange.findOne({
        subscriptionId: id,
        status: "pending",
      });

      if (existingChange) {
        return NextResponse.json(
          {
            success: false,
            message: "There is already a pending change for this subscription.",
          },
          { status: 400 },
        );
      }

      const currentSubscription = await polarClient.subscriptions.get({ id });

      let currentPlan: SubscriptionsType = "free";
      if (currentSubscription.product.id) {
        switch (currentSubscription.product.id) {
          case process.env.PRO_PLAN_ID:
            currentPlan = "pro";
            break;
          case process.env.PLUS_PLAN_ID:
            currentPlan = "plus";
            break;
          case process.env.BASIC_PLAN_ID:
            currentPlan = "basic";
            break;
        }
      }

      // Set the subscription to cancel at period end
      const subscription = await polarClient.subscriptions.update({
        id,
        subscriptionUpdate: {
          cancelAtPeriodEnd: true,
          // Store reason and comment in metadata if provided
          ...(parsed.data.reason || parsed.data.comment
            ? {
                metadata: {
                  ...(parsed.data.reason && {
                    cancelReason: parsed.data.reason,
                  }),
                  ...(parsed.data.comment && {
                    cancelComment: parsed.data.comment,
                  }),
                },
              }
            : {}),
        },
      });

      // Save the scheduled change to database
      const scheduledChange = await ScheduledChange.create({
        userId: data.user.id,
        subscriptionId: id,
        changeType: "cancellation",
        currentPlan,
        targetPlan: "free",
        scheduledFor: new Date(subscription.currentPeriodEnd!),
        reason: parsed.data.reason,
        comment: parsed.data.comment,
        status: "pending",
      });

      console.log(`Scheduled cancellation for subscription ${id}`);
      console.log(
        `Will cancel at period end: ${subscription.currentPeriodEnd}`,
      );
      console.log(`Reason: ${parsed.data.reason || "Not provided"}`);
      console.log(`Saved to database with ID: ${scheduledChange._id}`);

      return NextResponse.json({
        success: true,
        subscription,
        scheduledFor: subscription.currentPeriodEnd,
        changeId: scheduledChange._id,
      });
    } catch (polarError: unknown) {
      console.error("Polar API error:", polarError);

      const errorMessage =
        polarError instanceof Error ? polarError.message : String(polarError);

      return NextResponse.json(
        {
          success: false,
          message:
            "Failed to schedule cancellation. Please try again or contact support.",
          error: errorMessage,
        },
        { status: 500 },
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
