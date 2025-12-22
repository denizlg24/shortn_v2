import { polarClient } from "@/lib/polar";
import { connectDB } from "@/lib/mongodb";
import ScheduledChange from "@/models/subscription/ScheduledChange";
import { NextRequest, NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";

async function handler(req: NextRequest) {
  try {
    const { subscriptionId, newProductId, targetPlan } = await req.json();

    console.log(`Executing downgrade for subscription ${subscriptionId}`);

    await connectDB();

    const subscription = await polarClient.subscriptions.get({
      id: subscriptionId,
    });

    if (
      subscription.status !== "active" &&
      subscription.status !== "trialing"
    ) {
      console.log(
        `Subscription ${subscriptionId} is not active, skipping downgrade`,
      );

      await ScheduledChange.findOneAndUpdate(
        { subscriptionId, status: "pending" },
        { status: "reverted" },
      );

      return NextResponse.json({
        success: false,
        reason: "Subscription is not active",
      });
    }

    if (subscription.productId === newProductId) {
      console.log(`Subscription already on product ${newProductId}`);

      await ScheduledChange.findOneAndUpdate(
        { subscriptionId, status: "pending" },
        { status: "executed" },
      );

      return NextResponse.json({
        success: true,
        reason: "Already on target product",
      });
    }

    const updatedSubscription = await polarClient.subscriptions.update({
      id: subscriptionId,
      subscriptionUpdate: {
        productId: newProductId,
        prorationBehavior: "invoice",
        cancelAtPeriodEnd: false,
      },
    });

    await ScheduledChange.findOneAndUpdate(
      { subscriptionId, status: "pending" },
      { status: "executed" },
    );

    console.log(`Successfully downgraded subscription ${subscriptionId}`);
    console.log(`New product: ${updatedSubscription.product?.name}`);
    console.log(`Target plan: ${targetPlan}`);

    return NextResponse.json({
      success: true,
      subscription: updatedSubscription,
    });
  } catch (error) {
    console.error("Failed to execute downgrade:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        { success: false, error: "Subscription not found" },
        { status: 200 },
      );
    }

    return NextResponse.json(
      { error: "Failed to execute downgrade" },
      { status: 500 },
    );
  }
}

export const POST = verifySignatureAppRouter(handler);
