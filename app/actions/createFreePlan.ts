"use server";

import Stripe from "stripe";
import env from "@/utils/env";

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export async function createFreePlan({ name, email }: { name: string, email?: string }) {
    const customer = await stripe.customers.create({
        name,
        email
    });

    const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [
            {
                price: env.FREE_PLAN_ID,
            },
        ],
    });

    return { customerId: customer.id, subscriptionId: subscription.id };
}