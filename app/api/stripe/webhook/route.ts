import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/auth/User";
import env from "@/utils/env";
import { revalidateTag } from "next/cache";
import Stripe from "stripe";

const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
const stripe = new Stripe(env.STRIPE_SECRET_KEY);

const subscription_created_handler = async (
  subscriptionObject: Stripe.Subscription,
) => {
  const customerId = subscriptionObject.customer as string;
  if (customerId) {
    const subItems = subscriptionObject.items;
    const item =
      (subItems.data?.length ?? 0) == 1 ? subItems.data[0] : undefined;
    if (!item) {
      return false;
    }
    const priceId = item.price.id;
    let plan = "free";
    switch (priceId) {
      case env.FREE_PLAN_ID:
        plan = "free";
        break;
      case env.BASIC_PLAN_ID:
        plan = "basic";
        break;
      case env.PLUS_PLAN_ID:
        plan = "plus";
        break;
      case env.PRO_PLAN_ID:
        plan = "pro";
        break;
    }
    await User.updateOne(
      { stripeId: customerId },
      { plan: { subscription: plan, lastPaid: new Date() } },
    );
    revalidateTag(`user-plan-${customerId}`);
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
    });
    for (const subscription of subscriptions.data) {
      if (subscription.id != subscriptionObject.id) {
        await stripe.subscriptions.cancel(subscription.id);
      }
    }
    return true;
  }
  return false;
};

const subscription_deleted_handler = async (
  subscriptionObject: Stripe.Subscription,
) => {
  const customerId = subscriptionObject.customer as string;
  if (customerId) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
    });
    if (subscriptions.data.length >= 1) {
      return true;
    }
    await stripe.subscriptions.create({
      customer: customerId,
      items: [
        {
          price: env.FREE_PLAN_ID,
        },
      ],
    });
    await User.updateOne(
      { stripeId: customerId },
      { plan: { subscription: "free", lastPaid: new Date() } },
    );
    revalidateTag(`user-pan-${customerId}`);
    return true;
  }
  return false;
};

const subscription_updated_handler = async (
  subscriptionObject: Stripe.Subscription,
) => {
  const customerId = subscriptionObject.customer as string;
  if (customerId) {
    const subItems = subscriptionObject.items;
    const item =
      (subItems.data?.length ?? 0) == 1 ? subItems.data[0] : undefined;
    if (!item) {
      return false;
    }
    const priceId = item.price.id;
    let plan = "free";
    switch (priceId) {
      case env.FREE_PLAN_ID:
        plan = "free";
        break;
      case env.BASIC_PLAN_ID:
        plan = "basic";
        break;
      case env.PLUS_PLAN_ID:
        plan = "plus";
        break;
      case env.PRO_PLAN_ID:
        plan = "pro";
        break;
    }
    await User.updateOne(
      { stripeId: customerId },
      { plan: { subscription: plan, lastPaid: new Date() } },
    );
    revalidateTag(`user-pan-${customerId}`);
    return true;
  }
  return false;
};

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");

    let event: Stripe.Event;
    try {
      if (!sig || !webhookSecret)
        return new Response(`Webhook error.`, { status: 400 });
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch {
      return new Response(
        JSON.stringify({ success: false, message: "Webhook failed." }),
        { status: 500 },
      );
    }
    await connectDB();
    switch (event.type) {
      case "checkout.session.completed":
        return new Response(
          JSON.stringify({ success: "true", message: "Received" }),
          { status: 200 },
        );
      case "customer.subscription.created":
        const create_success = await subscription_created_handler(
          event.data.object,
        );
        if (create_success)
          return new Response(
            JSON.stringify({ success: "true", message: "Received" }),
            { status: 200 },
          );
        return new Response(
          JSON.stringify({ success: false, message: "Webhook failed." }),
          { status: 500 },
        );
      case "customer.subscription.deleted":
        const delete_success = await subscription_deleted_handler(
          event.data.object,
        );
        if (delete_success)
          return new Response(
            JSON.stringify({ success: "true", message: "Received" }),
            { status: 200 },
          );
        return new Response(
          JSON.stringify({ success: false, message: "Webhook failed." }),
          { status: 500 },
        );
      case "customer.subscription.updated":
        const update_success = await subscription_updated_handler(
          event.data.object,
        );
        if (update_success)
          return new Response(
            JSON.stringify({ success: "true", message: "Received" }),
            { status: 200 },
          );
        return new Response(
          JSON.stringify({ success: false, message: "Webhook failed." }),
          { status: 500 },
        );
      default:
        break;
    }
    return new Response(
      JSON.stringify({ success: "true", message: "Received" }),
      { status: 200 },
    );
  } catch (err) {
    console.log(err);
    return new Response(
      JSON.stringify({ success: false, message: "Webhook failed." }),
      { status: 500 },
    );
  }
}
