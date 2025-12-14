"use server";
import { headers } from "next/headers";
import Stripe from "stripe";
import env from "@/utils/env";
import { countries } from "jsvat";
import { mapJsvatToStripe } from "@/lib/utils";

import { getRelativeOrder, SubscriptionsType } from "@/utils/plan-utils";
import jwt from "jsonwebtoken";
import { auth } from "@/lib/auth";
import { getServerSession } from "@/lib/session";

const stripe = new Stripe(env.STRIPE_SECRET_KEY);
export const update_sub = async ({
  newPlan,
  customerId,
}: {
  newPlan: SubscriptionsType;
  customerId: string;
}) => {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
    });
    const subscription =
      (subscriptions.data?.length ?? 0) == 1
        ? subscriptions.data[0]
        : undefined;
    if (!subscription) {
      return true;
    }
    const getPlanFromSubscription = ({
      subscription,
    }: {
      subscription: Stripe.Subscription;
    }) => {
      const item =
        (subscription.items?.data?.length ?? 0) == 1
          ? subscription.items.data[0]
          : undefined;
      if (!item) {
        return undefined;
      }
      const itemId = item.id;
      return itemId;
    };
    const subItem = getPlanFromSubscription({ subscription });
    if (!subItem) {
      return false;
    }
    await stripe.subscriptions.update(subscription.id, {
      items: [
        { id: subItem, deleted: true },
        {
          price:
            newPlan === "free"
              ? env.FREE_PLAN_ID
              : newPlan === "basic"
                ? env.BASIC_PLAN_ID
                : newPlan === "plus"
                  ? env.PLUS_PLAN_ID
                  : env.PRO_PLAN_ID,
          quantity: 1,
        },
      ],
      proration_behavior: "none",
      billing_cycle_anchor: "unchanged",
    });
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
};
export async function getStripeTax({ tax_id }: { tax_id: string }) {
  try {
    const user = await getServerSession();
    if (!user) {
      return { success: false, tax: null };
    }
    if (!user.user) {
      return { success: false, tax: null };
    }
    const tax = await stripe.customers.retrieveTaxId(
      user.user.stripeCustomerId,
      tax_id,
    );
    if (!tax.deleted) {
      return { success: true, tax };
    }
    return { success: false, tax: null };
  } catch (error) {
    console.log(error);
    return { success: false, tax: null };
  }
}

export async function subscribeToFreePlan({
  customer_id,
  userId,
}: {
  customer_id: string;
  userId: string;
}) {
  try {
    const subscription = await stripe.subscriptions.create({
      customer: customer_id,
      items: [
        {
          price: env.FREE_PLAN_ID,
        },
      ],
      metadata: {
        userId: userId,
        first_free_plan: "true",
      },
    });
    return subscription;
  } catch (_error) {
    return false;
  }
}

export async function createFreePlan({
  name,
  email,
}: {
  name: string;
  email?: string;
}) {
  const customer = await stripe.customers.create({
    name,
    email,
  });
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [
      {
        price: env.FREE_PLAN_ID,
      },
    ],
    metadata: {
      first_free_plan: "true",
    },
  });

  return { customerId: customer.id, subscription: subscription };
}

export async function getStripeExtraInfo(stripeId: string) {
  try {
    const customer = await stripe.customers.retrieve(stripeId);
    let phone_number = "";
    let address = undefined;
    if (!customer.deleted) {
      phone_number = customer.phone ?? "";
      address = customer.address ?? undefined;
    }
    const taxIds = await stripe.customers.listTaxIds(stripeId, {
      limit: 1,
    });
    return { phone_number, tax_ids: taxIds, address };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return { phone_number: "", tax_ids: undefined, address: undefined };
  }
}

export async function updatePhone(stripeId: string, phone: string) {
  try {
    const session = await getServerSession();
    const user = session?.user;

    if (!user) {
      return {
        success: false,
        message: "no-user",
      };
    }
    await stripe.customers.update(stripeId, {
      phone,
    });
    return { success: true, message: null };
  } catch (error) {
    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      return { success: false, message: "invalid-phone" };
    }
    return { success: false, message: "server-error" };
  }
}

export async function getUserPlan() {
  try {
    const subscriptions = await auth.api.listActiveSubscriptions({
      headers: await headers(),
    });

    const sub = subscriptions.filter((sub) => sub.status === "active");

    return {
      success: true,
      plan: sub.length > 0 ? (sub[0].plan as SubscriptionsType) : null,
      lastPaid: sub.length > 0 ? sub[0].periodStart : null,
    };
  } catch {
    return {
      success: false,
      message: "server-error",
    };
  }
}

export async function downgradeSubscription({
  downgrade,
}: {
  downgrade: SubscriptionsType;
}) {
  try {
    const session = await getServerSession();
    const user = session?.user;
    if (!user) {
      return {
        success: false,
        message: "no-user",
      };
    }
    const planResponse = await getUserPlan();
    if (!planResponse.success) {
      return { success: false, message: "no-user" };
    }

    const token = jwt.sign({ plan: downgrade }, env.AUTH_SECRET, {
      expiresIn: "5m",
    });
    switch (planResponse.plan) {
      case "free":
        return { success: true };
      case "basic":
        switch (downgrade) {
          case "plus":
          case "pro":
          case "basic":
            return { success: false };
          case "free":
            return {
              success: await update_sub({
                newPlan: "free",
                customerId: user.stripeCustomerId,
              }),
              token,
            };
        }
        break;
      case "plus":
        switch (downgrade) {
          case "plus":
          case "pro":
            return { success: false };
          case "free":
          case "basic":
            return {
              success: await update_sub({
                newPlan: downgrade,
                customerId: user.stripeCustomerId,
              }),
              token,
            };
        }
        break;
      case "pro":
        switch (downgrade) {
          case "pro":
            return { success: false };
          case "free":
          case "basic":
          case "plus":
            return {
              success: await update_sub({
                newPlan: downgrade,
                customerId: user.stripeCustomerId,
              }),
              token,
            };
        }
    }
    return { success: false };
  } catch (error) {
    console.log(error);
    return { success: false, message: "server-error" };
  }
}

export async function updateTaxId(stripeId: string, tax_id: string) {
  try {
    const session = await getServerSession();
    const user = session?.user;

    if (!user) {
      return {
        success: false,
        message: "no-user",
      };
    }
    const taxIds = await stripe.customers.listTaxIds(stripeId, {
      limit: 1,
    });
    if (taxIds.data && taxIds.data.length > 0) {
      await stripe.customers.deleteTaxId(stripeId, taxIds.data[0].id);
    }
    const country = countries.find((c) => tax_id.startsWith(c.codes[0]));
    let stripe_type = "eu_vat";
    if (country) {
      stripe_type = mapJsvatToStripe(country.codes[0]);
      console.log(stripe_type);
    }
    await stripe.customers.createTaxId(stripeId, {
      type: stripe_type as Stripe.CustomerCreateTaxIdParams.Type,
      value: tax_id,
    });
    return { success: true, message: null };
  } catch (error) {
    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      return { success: false, message: "invalid-tax" };
    }
    return { success: false, message: "server-error" };
  }
}

export async function getTaxVerification(stripeId: string) {
  const taxIds = await stripe.customers.listTaxIds(stripeId, {
    limit: 1,
  });
  if (taxIds.data && taxIds.data.length > 0) {
    return taxIds.data[0].verification ?? undefined;
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

export async function updateUserAddress(
  stripeId: string,
  address: {
    line1: string | undefined;
    line2: string | undefined;
    city: string | undefined;
    country: string | undefined;
    postal_code: string | undefined;
  },
) {
  try {
    const customer = await stripe.customers.update(stripeId, {
      address: {
        line1: address.line1 ?? undefined,
        line2: address.line2 ?? undefined,
        city: address.city ?? undefined,
        country: address.country ?? undefined,
        postal_code: address.postal_code ?? undefined,
      },
    });
    if (customer) {
      return { success: true };
    } else {
      return { success: false, message: "not-found" };
    }
  } catch {
    return { success: false, message: "server-error" };
  }
}

export async function getPaymentMethods(stripeId: string) {
  const session = await getServerSession();
  const user = session?.user;

  if (!user) {
    return {
      success: false,
      methods: [],
    };
  }
  try {
    const paymentMethods = await stripe.customers.listPaymentMethods(stripeId);
    return { success: true, methods: paymentMethods.data };
  } catch (error) {
    console.log(error);
    return {
      success: false,
      methods: [],
    };
  }
}

export async function getCharges(stripeId: string, limit: number = 3) {
  const session = await getServerSession();
  const user = session?.user;

  if (!user) {
    return {
      success: false,
      charges: [],
      has_more: false,
    };
  }
  try {
    const charges = await stripe.charges.list({ customer: stripeId, limit });
    return { success: true, charges: charges.data, has_more: charges.has_more };
  } catch (error) {
    console.log(error);
    return {
      success: false,
      charges: [],
      has_more: false,
    };
  }
}

const _getPlanFromSubscription = ({
  subscription,
}: {
  subscription: Stripe.Subscription;
}) => {
  const item =
    (subscription.items?.data?.length ?? 0) == 1
      ? subscription.items.data[0]
      : undefined;
  if (!item) {
    return "free";
  }
  const price = item.price?.id ?? undefined;
  if (!price) {
    return "free";
  }
  switch (price) {
    case env.PRO_PLAN_ID:
      return "pro";
    case env.PLUS_PLAN_ID:
      return "plus";
    case env.BASIC_PLAN_ID:
      return "basic";
    default:
      return "free";
  }
};

export async function createSubscriptionSession({
  tier,
}: {
  tier: SubscriptionsType;
}): Promise<
  { success: true; clientSecret: string } | { success: false; message: string }
> {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return { success: false, message: "unauthenticated" };
    }
    let price: string = "";
    switch (tier) {
      case "basic":
        price = env.BASIC_PLAN_ID;
        break;
      case "plus":
        price = env.PLUS_PLAN_ID;
        break;
      case "pro":
        price = env.PRO_PLAN_ID;
        break;
      default:
        return { success: false, message: "wrong-tier" };
    }
    const checkout_session = await stripe.checkout.sessions.create({
      customer: session.user.stripeCustomerId,
      ui_mode: "custom",
      automatic_tax: { enabled: true },
      mode: "subscription",
      allow_promotion_codes: true,
      currency: "EUR",
      customer_update: {
        address: "auto",
        name: "auto",
        shipping: "auto",
      },
      saved_payment_method_options: {
        payment_method_save: "enabled",
      },
      tax_id_collection: {
        enabled: true,
      },
      phone_number_collection: {
        enabled: true,
      },
      line_items: [
        {
          price: price,
          quantity: 1,
        },
      ],
    });
    if (checkout_session.client_secret)
      return { success: true, clientSecret: checkout_session.client_secret };
    return { success: false, message: "stripe-error" };
  } catch (error) {
    console.log(error);
    return { success: false, message: "server-error" };
  }
}

export async function createUpgradeSession({
  tier,
}: {
  tier: SubscriptionsType;
}): Promise<
  { success: true; clientSecret: string } | { success: false; message: string }
> {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return { success: false, message: "unauthenticated" };
    }
    const userPlan = await getUserPlan();
    if (!userPlan.success) {
      return { success: false, message: "unauthenticated" };
    }
    switch (tier) {
      case "basic":
      case "plus":
      case "pro":
        break;
      default:
        return { success: false, message: "wrong-tier" };
    }
    const upgradeLevel = getRelativeOrder(
      userPlan.plan as SubscriptionsType,
      tier,
    );
    if (upgradeLevel == -1 || upgradeLevel == 0) {
      return { success: false, message: "unauthenticated" };
    }
    const price =
      upgradeLevel == 1
        ? env.LEVEL_ONE_UPGRADE_ID
        : upgradeLevel == 2
          ? env.LEVEL_TWO_UPGRADE_ID
          : undefined;
    if (!price) {
      return { success: false, message: "unauthenticated" };
    }

    const checkout_session = await stripe.checkout.sessions.create({
      customer: session.user.stripeCustomerId,
      ui_mode: "custom",
      automatic_tax: { enabled: true },
      mode: "payment",
      allow_promotion_codes: true,
      currency: "EUR",
      customer_update: {
        address: "auto",
        name: "auto",
        shipping: "auto",
      },
      saved_payment_method_options: {
        payment_method_save: "enabled",
      },
      tax_id_collection: {
        enabled: true,
      },
      phone_number_collection: {
        enabled: true,
      },
      line_items: [
        {
          price: price,
          quantity: 1,
        },
      ],
    });
    if (checkout_session.client_secret)
      return { success: true, clientSecret: checkout_session.client_secret };
    return { success: false, message: "stripe-error" };
  } catch (error) {
    console.log(error);
    return { success: false, message: "server-error" };
  }
}
