"use server";

import Stripe from "stripe";
import env from "@/utils/env";

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export async function updatePhone(stripeId: string, phone: string) {
    try {
        const customer = await stripe.customers.update(
            stripeId,
            {
                phone
            }
        );
        return { success: true, message: null }
    } catch (error) {
        if (error instanceof Stripe.errors.StripeInvalidRequestError) {
            return { success: false, message: "invalid-phone" }
        }
        return { success: false, message: "server-error" }
    }
}