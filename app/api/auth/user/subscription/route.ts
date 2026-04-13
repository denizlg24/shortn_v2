import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { protectRoute, createRateLimitIdentifier } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const { error, auth: authResult } = await protectRoute(request, {
      requireAuth: true,
    });

    if (error) return error;

    const rateLimitId = createRateLimitIdentifier(
      "auth_subscription",
      request,
      {
        includeUserId: authResult.user!.id,
      },
    );

    const { error: rateLimitError } = await protectRoute(request, {
      rateLimit: {
        identifier: rateLimitId,
        preset: "api",
      },
    });

    if (rateLimitError) return rateLimitError;

    const { plan, status } = await getPlan(request.headers);
    return NextResponse.json({ success: true, plan, status });
  } catch (err) {
    console.log(err);
    return NextResponse.json(
      { error: "Failed to get plan", success: true, plan: "free" },
      { status: 200 },
    );
  }
}

async function getPlan(headers: Headers) {
  const {
    result: { items: subscriptions },
  } = await auth.api.subscriptions({
    headers: headers,
  });
  if ((subscriptions?.length ?? 0) === 0) {
    return { plan: "free" as const, status: "free" as const };
  }

  const activeSubscription = subscriptions?.filter(
    (sub) => sub.status === "active" || sub.status === "trialing",
  )[0];

  const pastDueSubscription = subscriptions?.filter(
    (sub) => sub.status === "past_due",
  )[0];

  const subscription = activeSubscription ?? pastDueSubscription;

  if (!subscription) {
    return { plan: "free" as const, status: "free" as const };
  }

  const status = subscription.status as "active" | "trialing" | "past_due";
  const names = subscription.product.name.toLowerCase().split(" ");

  if (names.includes("basic")) return { plan: "basic" as const, status };
  if (names.includes("plus")) return { plan: "plus" as const, status };
  if (names.includes("pro")) return { plan: "pro" as const, status };
  return { plan: "free" as const, status: "free" as const };
}
