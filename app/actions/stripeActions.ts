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

export async function getStripeExtraInfo(stripeId: string) {
    try {
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
    } catch (error) {
        return { phone_number: "", tax_id: "" }
    }

}

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