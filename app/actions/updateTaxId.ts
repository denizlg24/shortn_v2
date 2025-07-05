"use server";

import Stripe from "stripe";
import env from "@/utils/env";

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export async function updateTaxId(stripeId: string, tax_id: string) {
    try {
        const taxIds = await stripe.customers.listTaxIds(
            stripeId,
            {
                limit: 1,
            }
        );
        if (taxIds.data && taxIds.data.length > 0) {
            const deleted = await stripe.customers.deleteTaxId(
                stripeId,
                taxIds.data[0].id
            );
        }
        const taxId = await stripe.customers.createTaxId(
            stripeId,
            {
                type: 'eu_vat',
                value: tax_id,
            }
        );
        return { success: true, message: null }
    } catch (error) {
        if (error instanceof Stripe.errors.StripeInvalidRequestError) {
            return { success: false, message: "invalid-tax" }
        }
        return { success: false, message: "server-error" }
    }
}