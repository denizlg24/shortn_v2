"use server";

import { auth } from "@/lib/auth";
import { polarClient } from "@/lib/polar";
import { verifySubscriptionId } from "@/lib/url-signature";
import { connectDB } from "@/lib/mongodb";
import ScheduledChange from "@/models/subscription/ScheduledChange";
import { headers } from "next/headers";

export async function getUserPlan() {
  const {
    result: { items: subscriptions },
  } = await auth.api.subscriptions({
    headers: await headers(),
  });
  if ((subscriptions?.length ?? 0) === 0) {
    return { plan: "free", id: null };
  }
  const subscription = subscriptions?.filter(
    (sub) => sub.status === "active" || sub.status === "trialing",
  )[0];
  if (!subscription) {
    return { plan: "free", id: null };
  }
  const names = subscription.product.name.toLowerCase().split(" ");
  if (names.includes("basic")) return { plan: "basic", id: subscription.id };
  if (names.includes("plus")) return { plan: "plus", id: subscription.id };
  if (names.includes("pro")) return { plan: "pro", id: subscription.id };
  return { plan: "free", id: null };
}

/**
 * Get subscription details by ID with signature verification
 */
export async function getSubscriptionDetails(
  subscriptionId: string,
  signature: string,
) {
  // Verify the signature
  if (!verifySubscriptionId(subscriptionId, signature)) {
    return {
      success: false,
      error: "Invalid signature",
    };
  }

  try {
    const subscription = await polarClient.subscriptions.get({
      id: subscriptionId,
    });

    if (!subscription) {
      return {
        success: false,
        error: "Subscription not found",
      };
    }

    return {
      success: true,
      subscription,
    };
  } catch (error) {
    console.error("Failed to fetch subscription:", error);
    return {
      success: false,
      error: "Failed to fetch subscription details",
    };
  }
}

/**
 * Get pending scheduled change for current user's subscription
 */
export async function getPendingScheduledChange() {
  try {
    await connectDB();

    const { id } = await getUserPlan();
    if (!id) {
      return null;
    }

    const scheduledChange = await ScheduledChange.findOne({
      subscriptionId: id,
      status: "pending",
    }).lean();

    if (!scheduledChange) {
      return null;
    }

    const change = scheduledChange;

    return {
      id: change._id.toString(),
      changeType: change.changeType as "cancellation" | "downgrade",
      currentPlan: change.currentPlan as string,
      targetPlan: change.targetPlan as string,
      scheduledFor: new Date(change.scheduledFor).toISOString(),
      reason: change.reason as string | undefined,
      comment: change.comment as string | undefined,
    };
  } catch (error) {
    console.error("Failed to fetch pending scheduled change:", error);
    return null;
  }
}

/**
 * Get checkout session details from Polar
 */
export async function getCheckoutSessionDetails(checkoutId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return {
      success: false,
      error: "Unauthorized",
    };
  }

  try {
    const checkout = await polarClient.checkouts.get({
      id: checkoutId,
    });

    if (!checkout) {
      return {
        success: false,
        error: "Checkout not found",
      };
    }

    const {
      result: { items: subscriptions },
    } = await auth.api.subscriptions({
      headers: await headers(),
    });

    const userCustomerId = subscriptions?.[0]?.customerId;

    if (!userCustomerId || checkout.customerId !== userCustomerId) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    return {
      success: true,
      checkout,
    };
  } catch (error) {
    console.error("Failed to fetch checkout:", error);
    return {
      success: false,
      error: "Failed to fetch checkout details",
    };
  }
}

/**
 * Get Polar customer portal URL
 */
export async function getPolarPortalUrl() {
  try {
    // Get the current user's session
    const {
      result: { items: subscriptions },
    } = await auth.api.subscriptions({
      headers: await headers(),
    });

    if (!subscriptions || subscriptions.length === 0) {
      return {
        success: false,
        error:
          "No active subscription found. You need an active subscription to access the billing portal.",
      };
    }

    // Get the customer ID from the first subscription
    const subscription = subscriptions[0];
    const customerId = subscription.customerId;

    if (!customerId) {
      return {
        success: false,
        error: "No customer ID found",
      };
    }

    // Create a customer portal session
    const portalSession = await polarClient.customerSessions.create({
      customerId,
    });

    if (!portalSession.customerPortalUrl) {
      return {
        success: false,
        error: "Failed to generate portal URL",
      };
    }

    return {
      success: true,
      url: portalSession.customerPortalUrl,
    };
  } catch (error) {
    console.error("Failed to get portal URL:", error);
    return {
      success: false,
      error: "Failed to generate portal URL",
    };
  }
}
