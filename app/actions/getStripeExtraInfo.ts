"use server";

import Stripe from "stripe";
import env from "@/utils/env";

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export async function getStripeExtraInfo(stripeId: string) {
    const customer = await stripe.customers.retrieve(stripeId);
    let phone_number = ""
    if (!customer.deleted) {
        phone_number = customer.phone ?? "";
    }
    const taxIds = await stripe.customers.listTaxIds(
        stripeId,
        {
            limit: 1,
        }
    );
    let tax_id = "";
    if (taxIds.data.length > 0) {
        tax_id = taxIds.data[0].value;
    }
    return { phone_number, tax_id };
}