"use server";


import Stripe from "stripe";
import env from "@/utils/env";
import { auth } from "@/auth";
import { countries } from "jsvat";
import { mapJsvatToStripe } from "@/lib/utils";

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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
        return { phone_number: "", tax_id: "" }
    }

}

export async function updatePhone(stripeId: string, phone: string) {
    try {
        const session = await auth();
        const user = session?.user;

        if (!user) {
            return {
                success: false,
                message: 'no-user',
            };
        }
        await stripe.customers.update(
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
        const session = await auth();
        const user = session?.user;

        if (!user) {
            return {
                success: false,
                message: 'no-user',
            };
        }
        const taxIds = await stripe.customers.listTaxIds(
            stripeId,
            {
                limit: 1,
            }
        );
        if (taxIds.data && taxIds.data.length > 0) {
            await stripe.customers.deleteTaxId(
                stripeId,
                taxIds.data[0].id
            );
        }
        const country = countries.find(c => tax_id.startsWith(c.codes[0]));
        let stripe_type = 'eu_vat';
        if (country) {
            stripe_type = mapJsvatToStripe(country.codes[0]);
            console.log(stripe_type);
        }
        await stripe.customers.createTaxId(
            stripeId,
            {
                type: stripe_type as Stripe.CustomerCreateTaxIdParams.Type,
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

export async function getTaxVerification(stripeId: string) {
    const taxIds = await stripe.customers.listTaxIds(
        stripeId,
        {
            limit: 1,
        }
    );
    if (taxIds.data && taxIds.data.length > 0) {
        return taxIds.data[0].verification ?? undefined
    }
    return undefined;
}

export async function getUserAddress(stripeId: string) {
    const customer = await stripe.customers.retrieve(stripeId);
    if (!customer.deleted) {
        const address = customer.address ?? undefined;
        return address;
    }
    return undefined;
}

export async function updateUserAddress(stripeId: string, address: {
    line1: string | undefined,
    line2: string | undefined,
    city: string | undefined,
    country: string | undefined,
    postal_code: string | undefined
}) {
    try {
        const customer = await stripe.customers.update(
            stripeId,
            {
                address: {
                    line1: address.line1 ?? undefined,
                    line2: address.line2 ?? undefined,
                    city: address.city ?? undefined,
                    country: address.country ?? undefined,
                    postal_code: address.postal_code ?? undefined
                }
            }
        );
        if (customer) {
            return { success: true }
        } else {
            return { success: false, message: 'not-found' }
        }
    } catch {
        return { success: false, message: "server-error" };
    }

}

export async function getPaymentMethods(stripeId: string) {
    const session = await auth();
    const user = session?.user;

    if (!user) {
        return {
            success: false,
            methods: [],
        };
    }
    try {
        const paymentMethods = await stripe.customers.listPaymentMethods(stripeId);
        return { success: true, methods: paymentMethods.data }
    } catch (error) {
        console.log(error);
        return {
            success: false,
            methods: [],
        };
    }
}

export async function getCharges(stripeId: string, limit: number = 3) {
    const session = await auth();
    const user = session?.user;

    if (!user) {
        return {
            success: false,
            charges: [],
            has_more: false
        };
    }
    try {
        const charges = await stripe.charges.list({ customer: stripeId, limit });
        return { success: true, charges: charges.data, has_more: charges.has_more }
    } catch (error) {
        console.log(error);
        return {
            success: false,
            charges: [],
            has_more: false,
        };
    }
}