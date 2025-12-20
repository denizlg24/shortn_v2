import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
export async function GET(request: Request) {
  try {
    const plan = await getPlan(request.headers);
    return NextResponse.json({ success: true, plan });
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
    return "free";
  }
  const subscription = subscriptions?.filter(
    (sub) => sub.status === "active" || sub.status === "trialing",
  )[0];
  if (!subscription) {
    return "free";
  }
  const names = subscription.product.name.toLowerCase().split(" ");
  if (names.includes("basic")) return "basic";
  if (names.includes("plus")) return "plus";
  if (names.includes("pro")) return "pro";
  return "free";
}
