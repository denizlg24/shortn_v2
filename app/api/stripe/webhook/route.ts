import { update_sub } from "@/app/actions/stripeActions";
import { connectDB } from "@/lib/mongodb";
import { Subscription } from "@/models/auth/Subscription";
import { User } from "@/models/auth/User";
import env from "@/utils/env";
import Stripe from "stripe";
import { sendEmail } from "@/app/actions/sendEmail";
import {
  subscriptionCreatedTemplate,
  subscriptionUpgradedTemplate,
  subscriptionCancelledTemplate,
} from "@/lib/email-templates";
import { BASEURL } from "@/lib/utils";

const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
const stripe = new Stripe(env.STRIPE_SECRET_KEY);

const getPlanFeatures = (plan: string): string[] => {
  const features: Record<string, string[]> = {
    free: ["Up to 3 short links", "Up to 3 QR codes", "No tracking"],
    basic: [
      "Up to 25 short links",
      "Up to 25 QR codes",
      "Basic click tracking",
      "Basic scan tracking",
    ],
    plus: [
      "Up to 50 short links",
      "Up to 50 QR codes",
      "10 link redirects",
      "10 QR code redirects",
      "Click & scan tracking",
      "Time & date analytics",
      "City-level analytics",
      "Device, OS & browser analytics",
    ],
    pro: [
      "Unlimited short links",
      "Unlimited QR codes",
      "Unlimited link redirects",
      "Unlimited QR code redirects",
      "Custom back-half URLs",
      "Custom QR code logos",
      "Advanced analytics (time, date, city, device, OS, browser)",
      "Referrer tracking",
      "Export click data",
      "Bio pages",
    ],
  };
  return features[plan] || [];
};

const getPlanDisplayName = (plan: string): string => {
  const names: Record<string, string> = {
    free: "Free Plan",
    basic: "Basic Plan",
    plus: "Plus Plan",
    pro: "Pro Plan",
  };
  return names[plan] || plan;
};

const getBillingDetails = async (customerId: string) => {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      return {};
    }

    const address = customer.address;
    const billingAddress = address
      ? [
          address.line1,
          address.line2,
          address.city,
          address.state,
          address.postal_code,
          address.country,
        ]
          .filter(Boolean)
          .join(", ")
      : undefined;

    const taxId = customer.tax_ids?.data?.[0]?.value;

    return {
      companyName: customer.name || undefined,
      taxId,
      billingAddress,
      phoneNumber: customer.phone || undefined,
    };
  } catch (error) {
    console.error("Failed to fetch billing details:", error);
    return {};
  }
};

const getPlanPriceFromPriceId = (priceId: string): number => {
  const prices: Record<string, number> = {
    [env.FREE_PLAN_ID]: 0,
    [env.BASIC_PLAN_ID]: 500,
    [env.PLUS_PLAN_ID]: 1500,
    [env.PRO_PLAN_ID]: 2500,
  };
  return prices[priceId] || 0;
};

export const subscription_created_handler = async (
  subscriptionObject: Stripe.Subscription,
) => {
  const customerId = subscriptionObject.customer as string;
  const isFirstFreePlan =
    subscriptionObject.metadata?.first_free_plan === "true";
  if (isFirstFreePlan) {
    return true;
  }
  await connectDB();
  const user = await User.findOne({ stripeCustomerId: customerId });
  if (!user) {
    console.log("No user found for customer ID:", customerId);
    return false;
  }
  const userId = user._id;
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
    await Subscription.findOneAndUpdate(
      { referenceId: userId },
      {
        referenceId: userId,
        plan,
        status: "active",
        stripeSubscriptionId: subscriptionObject.id,
        periodStart: new Date(),
        periodEnd: subscriptionObject.cancel_at,
        updatedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
    });
    for (const subscription of subscriptions.data) {
      if (subscription.id != subscriptionObject.id) {
        await stripe.subscriptions.cancel(subscription.id);
      }
    }

    if (plan !== "free" && user.email) {
      try {
        const dashboardLink = `${BASEURL}/en/dashboard/settings/plan`;
        const planFeatures = getPlanFeatures(plan);
        const planDisplayName = getPlanDisplayName(plan);

        const unitAmount = getPlanPriceFromPriceId(item.price.id);
        const subtotal = `$${(unitAmount / 100).toFixed(2)}`;

        const taxAmount = 0;
        const tax =
          taxAmount > 0 ? `$${(taxAmount / 100).toFixed(2)}` : undefined;

        const total = `$${((unitAmount + taxAmount) / 100).toFixed(2)}`;

        const billingInterval = item.price.recurring?.interval || "month";
        const billingPeriod =
          billingInterval === "month" ? "Monthly" : "Yearly";
        const recurringAmount = `$${(unitAmount / 100).toFixed(2)}/${billingInterval}`;

        const nextBillingDate = subscriptionObject.cancel_at
          ? new Date(subscriptionObject.cancel_at * 1000).toLocaleDateString(
              "en-US",
              {
                month: "long",
                day: "numeric",
                year: "numeric",
              },
            )
          : undefined;

        let cardBrand: string | undefined;
        let cardLast4: string | undefined;

        try {
          const paymentMethods = await stripe.paymentMethods.list({
            customer: customerId,
            type: "card",
            limit: 1,
          });

          if (paymentMethods.data.length > 0) {
            const card = paymentMethods.data[0].card;
            cardBrand = card?.brand
              ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1)
              : undefined;
            cardLast4 = card?.last4;
          }
        } catch (pmError) {
          console.error("Failed to fetch payment method:", pmError);
        }

        const billingDetails = await getBillingDetails(customerId);

        const emailHtml = subscriptionCreatedTemplate({
          userName: user.name || "there",
          planName: planDisplayName,
          dashboardLink,
          features: planFeatures,
          amount: recurringAmount,
          subtotal,
          tax,
          total,
          nextBillingDate,
          billingPeriod,
          cardLast4,
          cardBrand,
          billingEmail: user.email,
          transactionDate: new Date().toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          }),
          ...billingDetails,
        });

        await sendEmail({
          from: "no-reply@shortn.at",
          to: user.email,
          subject: `Payment Receipt - ${planDisplayName}`,
          html: emailHtml,
        });
      } catch (emailError) {
        console.error("Failed to send subscription created email:", emailError);
      }
    }

    return true;
  }
  return false;
};

export const subscription_deleted_handler = async (
  subscriptionObject: Stripe.Subscription,
) => {
  const customerId = subscriptionObject.customer as string;
  await connectDB();
  const user = await User.findOne({ stripeCustomerId: customerId });
  if (!user) {
    return false;
  }
  const userId = user._id;

  const currentSubscription = await Subscription.findOne({
    referenceId: userId,
  });
  const oldPlan = currentSubscription?.plan || "unknown";

  if (customerId) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
    });
    if (subscriptions.data.length >= 1) {
      return true;
    }
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        {
          price: env.FREE_PLAN_ID,
        },
      ],
    });
    await Subscription.findOneAndUpdate(
      { referenceId: userId },
      {
        referenceId: userId,
        plan: "free",
        status: "active",
        stripeSubscriptionId: subscription.id,
        periodStart: new Date(),
        periodEnd: subscription.cancel_at,
        updatedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    if (oldPlan !== "free" && user.email) {
      try {
        const dashboardLink = `${BASEURL}/en/dashboard/settings/plan`;
        const planDisplayName = getPlanDisplayName(oldPlan);
        const endDate = subscriptionObject.cancel_at
          ? new Date(subscriptionObject.cancel_at * 1000).toLocaleDateString(
              "en-US",
              {
                month: "long",
                day: "numeric",
                year: "numeric",
              },
            )
          : "the end of your billing period";

        let cardBrand: string | undefined;
        let cardLast4: string | undefined;

        try {
          const paymentMethods = await stripe.paymentMethods.list({
            customer: customerId,
            type: "card",
            limit: 1,
          });

          if (paymentMethods.data.length > 0) {
            const card = paymentMethods.data[0].card;
            cardBrand = card?.brand
              ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1)
              : undefined;
            cardLast4 = card?.last4;
          }
        } catch (pmError) {
          console.error("Failed to fetch payment method:", pmError);
        }

        const billingDetails = await getBillingDetails(customerId);

        const emailHtml = subscriptionCancelledTemplate({
          userName: user.name || "there",
          planName: planDisplayName,
          endDate,
          dashboardLink,
          billingEmail: user.email,
          cardBrand,
          cardLast4,
          ...billingDetails,
        });

        await sendEmail({
          from: "no-reply@shortn.at",
          to: user.email,
          subject: `Subscription Cancelled - ${planDisplayName}`,
          html: emailHtml,
        });
      } catch (emailError) {
        console.error(
          "Failed to send subscription cancelled email:",
          emailError,
        );
      }
    }

    return true;
  }
  return false;
};

export const subscription_updated_handler = async (
  subscriptionObject: Stripe.Subscription,
) => {
  const customerId = subscriptionObject.customer as string;
  await connectDB();
  const user = await User.findOne({ stripeCustomerId: customerId });
  if (!user) {
    return false;
  }
  const userId = user._id;

  const currentSubscription = await Subscription.findOne({
    referenceId: userId,
  });
  const oldPlan = currentSubscription?.plan || "free";

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
    await Subscription.findOneAndUpdate(
      { referenceId: userId },
      {
        referenceId: userId,
        plan,
        status: "active",
        stripeSubscriptionId: subscriptionObject.id,
        periodStart: new Date(),
        periodEnd: subscriptionObject.cancel_at,
        updatedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const planHierarchy: Record<string, number> = {
      free: 0,
      basic: 1,
      plus: 2,
      pro: 3,
    };
    const isDowngrade =
      (planHierarchy[plan] || 0) < (planHierarchy[oldPlan] || 0);

    if (oldPlan !== plan && isDowngrade && user.email) {
      try {
        const dashboardLink = `${BASEURL}/en/dashboard/settings/plan`;
        const oldPlanDisplayName = getPlanDisplayName(oldPlan);
        const newPlanDisplayName = getPlanDisplayName(plan);
        const newFeatures = getPlanFeatures(plan);

        const unitAmount = getPlanPriceFromPriceId(item.price.id);
        const billingInterval = item.price.recurring?.interval || "month";
        const billingPeriod =
          billingInterval === "month" ? "Monthly" : "Yearly";
        const recurringAmount = `$${(unitAmount / 100).toFixed(2)}/${billingInterval}`;

        const effectiveDate = new Date().toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });

        let cardBrand: string | undefined;
        let cardLast4: string | undefined;

        try {
          const paymentMethods = await stripe.paymentMethods.list({
            customer: customerId,
            type: "card",
            limit: 1,
          });

          if (paymentMethods.data.length > 0) {
            const card = paymentMethods.data[0].card;
            cardBrand = card?.brand
              ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1)
              : undefined;
            cardLast4 = card?.last4;
          }
        } catch (pmError) {
          console.error("Failed to fetch payment method:", pmError);
        }

        const billingDetails = await getBillingDetails(customerId);

        const emailHtml = subscriptionUpgradedTemplate({
          userName: user.name || "there",
          oldPlan: oldPlanDisplayName,
          newPlan: newPlanDisplayName,
          dashboardLink,
          newFeatures,
          amount: recurringAmount,
          total: "$0.00",
          effectiveDate,
          billingPeriod,
          cardLast4,
          cardBrand,
          billingEmail: user.email,
          ...billingDetails,
        });

        await sendEmail({
          from: "no-reply@shortn.at",
          to: user.email,
          subject: `Subscription Updated - ${newPlanDisplayName}`,
          html: emailHtml,
        });
      } catch (emailError) {
        console.error(
          "Failed to send subscription downgrade email:",
          emailError,
        );
      }
    }

    return true;
  }
  return false;
};

export const checkout_session_successful_handler = async ({
  session,
}: {
  session: Stripe.Checkout.Session;
}) => {
  try {
    const customerId = session.customer as string;
    if (customerId) {
      let item =
        (session.line_items?.data?.length ?? 0) == 1
          ? session.line_items?.data[0]
          : undefined;
      if (!item) {
        const items = await stripe.checkout.sessions.listLineItems(session.id);
        item = (items.data?.length ?? 0) == 1 ? items.data[0] : undefined;
      }
      if (!item) {
        return false;
      }
      const price = item.price;
      if (!price) {
        return false;
      }
      await connectDB();
      const user = await User.findOne({ stripeCustomerId: customerId });
      if (!user) {
        return false;
      }
      const subscription = await Subscription.findOne({
        referenceId: user._id,
      }).lean();
      const oldPlan = subscription?.plan || "free";

      let newPlan: string | null = null;
      let shouldUpdate = false;

      switch (price.id) {
        case env.LEVEL_ONE_UPGRADE_ID:
          switch (oldPlan) {
            case "free":
            case "pro":
              return true;
            case "basic":
              newPlan = "plus";
              shouldUpdate = true;
              break;
            case "plus":
              newPlan = "pro";
              shouldUpdate = true;
              break;
          }
          break;
        case env.LEVEL_TWO_UPGRADE_ID:
          switch (oldPlan) {
            case "free":
            case "plus":
            case "pro":
              return true;
            case "basic":
              newPlan = "pro";
              shouldUpdate = true;
              break;
          }
          break;
        default:
          return true;
      }

      if (shouldUpdate && newPlan) {
        const updateSuccess = await update_sub({
          newPlan: newPlan as "basic" | "plus" | "pro",
          customerId,
        });

        if (updateSuccess && user.email) {
          try {
            const dashboardLink = `${BASEURL}/en/dashboard/settings/plan`;
            const oldPlanDisplayName = getPlanDisplayName(oldPlan);
            const newPlanDisplayName = getPlanDisplayName(newPlan);
            const newFeatures = getPlanFeatures(newPlan);

            const amountTotal = session.amount_total || 0;
            const amountSubtotal = session.amount_subtotal || amountTotal;
            const taxAmount = amountTotal - amountSubtotal;

            const subtotal = `$${(amountSubtotal / 100).toFixed(2)}`;
            const tax =
              taxAmount > 0 ? `$${(taxAmount / 100).toFixed(2)}` : undefined;
            const total = `$${(amountTotal / 100).toFixed(2)}`;

            const billingInterval = price.recurring?.interval || "month";
            const billingPeriod =
              billingInterval === "month" ? "Monthly" : "Yearly";

            let newPlanPriceId = "";
            switch (newPlan) {
              case "basic":
                newPlanPriceId = env.BASIC_PLAN_ID;
                break;
              case "plus":
                newPlanPriceId = env.PLUS_PLAN_ID;
                break;
              case "pro":
                newPlanPriceId = env.PRO_PLAN_ID;
                break;
            }
            const recurringUnitAmount = getPlanPriceFromPriceId(newPlanPriceId);
            const recurringAmount = `$${(recurringUnitAmount / 100).toFixed(2)}/${billingInterval}`;

            const effectiveDate = new Date().toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            });

            let cardBrand: string | undefined;
            let cardLast4: string | undefined;

            try {
              const paymentMethods = await stripe.paymentMethods.list({
                customer: customerId,
                type: "card",
                limit: 1,
              });

              if (paymentMethods.data.length > 0) {
                const card = paymentMethods.data[0].card;
                cardBrand = card?.brand
                  ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1)
                  : undefined;
                cardLast4 = card?.last4;
              }
            } catch (pmError) {
              console.error("Failed to fetch payment method:", pmError);
            }

            const billingDetails = await getBillingDetails(customerId);

            const emailHtml = subscriptionUpgradedTemplate({
              userName: user.name || "there",
              oldPlan: oldPlanDisplayName,
              newPlan: newPlanDisplayName,
              dashboardLink,
              newFeatures,
              amount: recurringAmount,
              subtotal,
              tax,
              total,
              effectiveDate,
              billingPeriod,
              cardLast4,
              cardBrand,
              billingEmail: user.email,
              ...billingDetails,
            });

            await sendEmail({
              from: "no-reply@shortn.at",
              to: user.email,
              subject: `Subscription Upgraded - Payment Receipt`,
              html: emailHtml,
            });
          } catch (emailError) {
            console.error("Failed to send upgrade email:", emailError);
          }
        }

        return updateSuccess;
      }
    }
    return false;
  } catch (error) {
    console.log(error);
    return false;
  }
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
      case "checkout.session.completed": {
        const complete_success = await checkout_session_successful_handler({
          session: event.data.object,
        });
        if (complete_success) {
          return new Response(
            JSON.stringify({ success: "true", message: "Received" }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({ success: false, message: "Webhook failed." }),
          { status: 500 },
        );
      }

      case "customer.subscription.created": {
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
      }
      case "customer.subscription.deleted": {
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
      }
      case "customer.subscription.updated": {
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
      }
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
