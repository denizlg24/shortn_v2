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
  subscriptionRenewalTemplate,
  paymentFailedTemplate,
  trialEndingTemplate,
  refundProcessedTemplate,
  subscriptionDowngradedTemplate,
} from "@/lib/email-templates";
import { BASEURL } from "@/lib/utils";
import {
  getPlanFromPriceId,
  getBasePlanPrice,
  formatCurrency,
  formatDate,
  getBillingPeriodDisplay,
  getPaymentMethodInfo,
  getBillingDetails,
  getInvoiceDiscounts,
  getLatestInvoice,
  getInvoiceById,
  getUpcomingInvoice,
  getPaymentFailureData,
  getRefundData,
  PLAN_FEATURES,
  PLAN_DISPLAY_NAMES,
  PLAN_HIERARCHY,
} from "@/lib/stripe-email-helpers";

const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
const stripe = new Stripe(env.STRIPE_SECRET_KEY);

// ============================================================================
// Subscription Created Handler
// ============================================================================
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
  if (!customerId) {
    return false;
  }

  const subItems = subscriptionObject.items;
  const item = subItems.data?.length === 1 ? subItems.data[0] : undefined;
  if (!item) {
    return false;
  }

  const priceId = item.price.id;
  const plan = getPlanFromPriceId(priceId);

  await Subscription.findOneAndUpdate(
    { referenceId: userId },
    {
      referenceId: userId,
      plan,
      status: "active",
      stripeSubscriptionId: subscriptionObject.id,
      periodStart: new Date(),
      periodEnd: subscriptionObject.cancel_at
        ? new Date(subscriptionObject.cancel_at)
        : null,
      updatedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
  });
  for (const subscription of subscriptions.data) {
    if (subscription.id !== subscriptionObject.id) {
      await stripe.subscriptions.cancel(subscription.id);
    }
  }

  if (plan !== "free" && user.email) {
    try {
      const dashboardLink = `${BASEURL}/en/dashboard/settings/plan`;
      const planFeatures = PLAN_FEATURES[plan] || [];
      const planDisplayName = PLAN_DISPLAY_NAMES[plan] || plan;

      const latestInvoice = await getLatestInvoice(subscriptionObject.id);
      const currency = item.price.currency || "eur";
      const unitAmount = item.price.unit_amount || 0;

      let subtotal = formatCurrency(unitAmount, currency);
      let tax: string | undefined;
      let total = subtotal;
      let invoiceNumber: string | undefined;
      let discount:
        | {
            name: string;
            code?: string;
            amount: string;
            percentOff?: number;
          }
        | undefined;

      if (latestInvoice) {
        invoiceNumber = latestInvoice.number || undefined;
        subtotal = formatCurrency(
          latestInvoice.subtotal,
          latestInvoice.currency,
        );
        const taxAmount = latestInvoice.total_taxes?.[0]?.amount || 0;
        tax =
          taxAmount > 0
            ? formatCurrency(taxAmount, latestInvoice.currency)
            : undefined;
        total = formatCurrency(latestInvoice.total, latestInvoice.currency);

        const discountInfo = await getInvoiceDiscounts(latestInvoice);
        if (discountInfo) {
          discount = {
            name: discountInfo.name,
            code: discountInfo.code,
            amount:
              discountInfo.formattedAmountOff ||
              formatCurrency(discountInfo.amountOff || 0, currency),
            percentOff: discountInfo.percentOff,
          };
        }
      }

      const billingInterval = item.price.recurring?.interval || "month";
      const billingPeriod = getBillingPeriodDisplay(billingInterval);
      const recurringAmount = `${formatCurrency(unitAmount, currency)}/${billingInterval}`;

      const upcomingInvoice = await getUpcomingInvoice(
        customerId,
        subscriptionObject.id,
      );
      const nextBillingDate =
        upcomingInvoice?.nextBillingDate ||
        (subscriptionObject.cancel_at
          ? formatDate(subscriptionObject.cancel_at)
          : undefined);

      const paymentMethod = await getPaymentMethodInfo(customerId);

      const billingDetails = await getBillingDetails(customerId);

      const emailHtml = subscriptionCreatedTemplate({
        userName: user.name || "there",
        planName: planDisplayName,
        dashboardLink,
        features: planFeatures,
        amount: recurringAmount,
        subtotal,
        discount,
        tax,
        total,
        nextBillingDate,
        billingPeriod,
        cardLast4: paymentMethod?.last4,
        cardBrand: paymentMethod?.brand,
        billingEmail: user.email,
        invoiceNumber,
        transactionDate: formatDate(new Date()),
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
};

// ============================================================================
// Subscription Deleted Handler
// ============================================================================
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

  if (!customerId) {
    return false;
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
  });

  if (subscriptions.data.length >= 1) {
    return true;
  }

  const newSubscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: env.FREE_PLAN_ID }],
  });

  await Subscription.findOneAndUpdate(
    { referenceId: userId },
    {
      referenceId: userId,
      plan: "free",
      status: "active",
      stripeSubscriptionId: newSubscription.id,
      periodStart: new Date(),
      periodEnd: newSubscription.cancel_at
        ? new Date(newSubscription.cancel_at)
        : null,
      updatedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  // Send cancellation email
  if (oldPlan !== "free" && user.email) {
    try {
      const dashboardLink = `${BASEURL}/en/dashboard/settings/plan`;
      const planDisplayName = PLAN_DISPLAY_NAMES[oldPlan] || oldPlan;

      const endDate = subscriptionObject.cancel_at
        ? formatDate(subscriptionObject.cancel_at)
        : formatDate(new Date());

      const paymentMethod = await getPaymentMethodInfo(customerId);
      const billingDetails = await getBillingDetails(customerId);

      const emailHtml = subscriptionCancelledTemplate({
        userName: user.name || "there",
        planName: planDisplayName,
        endDate,
        dashboardLink,
        billingEmail: user.email,
        cardBrand: paymentMethod?.brand,
        cardLast4: paymentMethod?.last4,
        ...billingDetails,
      });

      await sendEmail({
        from: "no-reply@shortn.at",
        to: user.email,
        subject: `Subscription Cancelled - ${planDisplayName}`,
        html: emailHtml,
      });
    } catch (emailError) {
      console.error("Failed to send subscription cancelled email:", emailError);
    }
  }

  return true;
};

// ============================================================================
// Subscription Updated Handler
// ============================================================================
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

  if (!customerId) {
    return false;
  }

  const subItems = subscriptionObject.items;
  const item = subItems.data?.length === 1 ? subItems.data[0] : undefined;
  if (!item) {
    return false;
  }

  const priceId = item.price.id;
  const plan = getPlanFromPriceId(priceId);

  await Subscription.findOneAndUpdate(
    { referenceId: userId },
    {
      referenceId: userId,
      plan,
      status: "active",
      stripeSubscriptionId: subscriptionObject.id,
      periodStart: new Date(),
      periodEnd: subscriptionObject.cancel_at
        ? new Date(subscriptionObject.cancel_at)
        : null,
      updatedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  if (oldPlan === plan) {
    return true;
  }

  const isDowngrade =
    (PLAN_HIERARCHY[plan] || 0) < (PLAN_HIERARCHY[oldPlan] || 0);

  if (!user.email) {
    return true;
  }

  try {
    const dashboardLink = `${BASEURL}/en/dashboard/settings/plan`;
    const oldPlanDisplayName = PLAN_DISPLAY_NAMES[oldPlan] || oldPlan;
    const newPlanDisplayName = PLAN_DISPLAY_NAMES[plan] || plan;
    const newFeatures = PLAN_FEATURES[plan] || [];

    const currency = item.price.currency || "eur";
    const unitAmount = item.price.unit_amount || 0;
    const billingInterval = item.price.recurring?.interval || "month";
    const billingPeriod = getBillingPeriodDisplay(billingInterval);
    const recurringAmount = `${formatCurrency(unitAmount, currency)}/${billingInterval}`;

    const effectiveDate = formatDate(new Date());

    const paymentMethod = await getPaymentMethodInfo(customerId);

    if (isDowngrade) {
      const oldFeatures = PLAN_FEATURES[oldPlan] || [];
      const lostFeatures = oldFeatures.filter((f) => !newFeatures.includes(f));

      const emailHtml = subscriptionDowngradedTemplate({
        userName: user.name || "there",
        oldPlan: oldPlanDisplayName,
        newPlan: newPlanDisplayName,
        dashboardLink,
        effectiveDate,
        newFeatures,
        lostFeatures: lostFeatures.length > 0 ? lostFeatures : undefined,
        newAmount: recurringAmount,
        billingPeriod,
        cardLast4: paymentMethod?.last4,
        cardBrand: paymentMethod?.brand,
        billingEmail: user.email,
      });

      await sendEmail({
        from: "no-reply@shortn.at",
        to: user.email,
        subject: `Subscription Downgraded - ${newPlanDisplayName}`,
        html: emailHtml,
      });
    }
  } catch (emailError) {
    console.error("Failed to send subscription update email:", emailError);
  }

  return true;
};

// Extended types for Stripe SDK v19 runtime properties
interface ExtendedInvoice extends Stripe.Invoice {
  subscription?: string | Stripe.Subscription | null;
}

interface ExtendedInvoiceLineItem extends Stripe.InvoiceLineItem {
  price?: Stripe.Price | null;
}

// ============================================================================
// Invoice Paid Handler
// ============================================================================
export const invoice_paid_handler = async (invoice: Stripe.Invoice) => {
  const billingReason = invoice.billing_reason;
  if (billingReason === "subscription_create") {
    return true;
  }

  const customerId = invoice.customer as string;
  if (!customerId) {
    return false;
  }

  await connectDB();
  const user = await User.findOne({ stripeCustomerId: customerId });
  if (!user || !user.email) {
    return true;
  }

  const fullInvoice = await getInvoiceById(invoice.id);
  if (!fullInvoice) {
    console.error("Could not fetch full invoice:", invoice.id);
    return true;
  }

  const extendedInvoice = invoice as unknown as ExtendedInvoice;
  const subscriptionId = extendedInvoice.subscription;
  if (!subscriptionId) {
    return true;
  }

  const subscriptionIdStr =
    typeof subscriptionId === "string" ? subscriptionId : subscriptionId.id;
  const subscription = await Subscription.findOne({
    stripeSubscriptionId: subscriptionIdStr,
  });
  const plan = subscription?.plan || "free";

  if (plan === "free") {
    return true;
  }

  try {
    const dashboardLink = `${BASEURL}/en/dashboard/settings/plan`;
    const planDisplayName = PLAN_DISPLAY_NAMES[plan] || plan;
    const currency = fullInvoice.currency || "eur";

    const discountInfo = await getInvoiceDiscounts(fullInvoice);
    const discount = discountInfo
      ? {
          name: discountInfo.name,
          code: discountInfo.code,
          amount:
            discountInfo.formattedAmountOff ||
            formatCurrency(discountInfo.amountOff || 0, currency),
          percentOff: discountInfo.percentOff,
        }
      : undefined;

    const subtotal = formatCurrency(fullInvoice.subtotal, currency);
    const taxAmount = fullInvoice.total_taxes?.[0]?.amount || 0;
    const tax = taxAmount > 0 ? formatCurrency(taxAmount, currency) : undefined;
    const total = formatCurrency(fullInvoice.total, currency);

    const upcomingInvoice = await getUpcomingInvoice(
      customerId,
      subscriptionIdStr,
    );
    const nextBillingDate = upcomingInvoice?.nextBillingDate;

    const lineItem = fullInvoice.lines.data[0] as unknown as
      | ExtendedInvoiceLineItem
      | undefined;
    const billingInterval = lineItem?.price?.recurring?.interval || "month";
    const billingPeriod = getBillingPeriodDisplay(billingInterval);
    const unitAmount = lineItem?.price?.unit_amount || 0;
    const recurringAmount = `${formatCurrency(unitAmount, currency)}/${billingInterval}`;

    const paymentMethod = await getPaymentMethodInfo(customerId);
    const billingDetails = await getBillingDetails(customerId);

    const emailHtml = subscriptionRenewalTemplate({
      userName: user.name || "there",
      planName: planDisplayName,
      dashboardLink,
      amount: recurringAmount,
      subtotal,
      discount,
      tax,
      total,
      nextBillingDate,
      billingPeriod,
      cardLast4: paymentMethod?.last4,
      cardBrand: paymentMethod?.brand,
      billingEmail: user.email,
      invoiceNumber: fullInvoice.number || undefined,
      invoicePdfUrl: fullInvoice.invoice_pdf || undefined,
      transactionDate: formatDate(fullInvoice.created),
      ...billingDetails,
    });

    await sendEmail({
      from: "no-reply@shortn.at",
      to: user.email,
      subject: `Payment Receipt - ${planDisplayName}`,
      html: emailHtml,
    });
  } catch (emailError) {
    console.error("Failed to send renewal receipt email:", emailError);
  }

  return true;
};

// ============================================================================
// Invoice Payment Failed Handler
// ============================================================================
export const invoice_payment_failed_handler = async (
  invoice: Stripe.Invoice,
) => {
  const customerId = invoice.customer as string;
  if (!customerId) {
    return false;
  }

  await connectDB();
  const user = await User.findOne({ stripeCustomerId: customerId });
  if (!user || !user.email) {
    return true;
  }

  const extendedInvoice = invoice as unknown as ExtendedInvoice;
  const subscriptionId = extendedInvoice.subscription;
  if (!subscriptionId) {
    return true;
  }

  const subscriptionIdStr =
    typeof subscriptionId === "string" ? subscriptionId : subscriptionId.id;
  const subscription = await Subscription.findOne({
    stripeSubscriptionId: subscriptionIdStr,
  });
  const plan = subscription?.plan || "free";

  if (plan === "free") {
    return true;
  }

  try {
    const dashboardLink = `${BASEURL}/en/dashboard/settings/plan`;
    const planDisplayName = PLAN_DISPLAY_NAMES[plan] || plan;
    const currency = invoice.currency || "eur";

    const failureData = await getPaymentFailureData(invoice);

    const amount = formatCurrency(invoice.amount_due, currency);

    const emailHtml = paymentFailedTemplate({
      userName: user.name || "there",
      planName: planDisplayName,
      retryDate:
        failureData.nextRetryDate ||
        formatDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)),
      updatePaymentLink: dashboardLink,
      amount,
      failureReason: failureData.failureMessage,
    });

    await sendEmail({
      from: "no-reply@shortn.at",
      to: user.email,
      subject: `Payment Failed - Action Required`,
      html: emailHtml,
    });
  } catch (emailError) {
    console.error("Failed to send payment failed email:", emailError);
  }

  return true;
};

// ============================================================================
// Trial Will End Handler
// ============================================================================
export const subscription_trial_will_end_handler = async (
  subscription: Stripe.Subscription,
) => {
  const customerId = subscription.customer as string;
  if (!customerId) {
    return false;
  }

  await connectDB();
  const user = await User.findOne({ stripeCustomerId: customerId });
  if (!user || !user.email) {
    return true;
  }

  const item = subscription.items.data[0];
  if (!item) {
    return true;
  }

  const plan = getPlanFromPriceId(item.price.id);
  if (plan === "free") {
    return true;
  }

  try {
    const dashboardLink = `${BASEURL}/en/dashboard/settings/plan`;
    const planDisplayName = PLAN_DISPLAY_NAMES[plan] || plan;
    const planFeatures = PLAN_FEATURES[plan] || [];

    const trialEnd = subscription.trial_end;
    const trialEndDate = trialEnd
      ? formatDate(trialEnd)
      : formatDate(new Date());
    const daysRemaining = trialEnd
      ? Math.max(0, Math.ceil((trialEnd - Date.now()) / (60 * 60 * 24 * 1000)))
      : 0;

    const currency = item.price.currency || "eur";
    const unitAmount = item.price.unit_amount || 0;
    const billingInterval = item.price.recurring?.interval || "month";
    const amount = `${formatCurrency(unitAmount, currency)}/${billingInterval}`;

    const emailHtml = trialEndingTemplate({
      userName: user.name || "there",
      planName: planDisplayName,
      trialEndDate,
      daysRemaining,
      dashboardLink,
      features: planFeatures,
      amount,
    });

    await sendEmail({
      from: "no-reply@shortn.at",
      to: user.email,
      subject: `Your Trial Ends ${daysRemaining <= 1 ? "Tomorrow" : `in ${daysRemaining} Days`}`,
      html: emailHtml,
    });
  } catch (emailError) {
    console.error("Failed to send trial ending email:", emailError);
  }

  return true;
};

// ============================================================================
// Charge Refunded Handler
// ============================================================================
export const charge_refunded_handler = async (charge: Stripe.Charge) => {
  const customerId = charge.customer as string;
  if (!customerId) {
    return false;
  }

  await connectDB();
  const user = await User.findOne({ stripeCustomerId: customerId });
  if (!user || !user.email) {
    return true;
  }

  try {
    const dashboardLink = `${BASEURL}/en/dashboard/settings/plan`;

    const refundData = await getRefundData(charge.id);
    if (!refundData) {
      console.error("Could not fetch refund data for charge:", charge.id);
      return true;
    }

    const paymentMethod = await getPaymentMethodInfo(customerId);

    let planName: string | undefined;
    const subscription = await Subscription.findOne({
      referenceId: user._id,
    });
    if (subscription) {
      planName = PLAN_DISPLAY_NAMES[subscription.plan] || subscription.plan;
    }

    let refundReason: string | undefined;
    if (refundData.reason) {
      const reasonMap: Record<string, string> = {
        duplicate: "Duplicate charge",
        fraudulent: "Fraudulent transaction",
        requested_by_customer: "Requested by customer",
      };
      refundReason = reasonMap[refundData.reason] || refundData.reason;
    }

    const emailHtml = refundProcessedTemplate({
      userName: user.name || "there",
      refundAmount: refundData.amount,
      refundReason,
      originalAmount: formatCurrency(charge.amount, charge.currency),
      planName,
      refundDate: refundData.createdDate,
      cardLast4: paymentMethod?.last4,
      cardBrand: paymentMethod?.brand,
      dashboardLink,
    });

    await sendEmail({
      from: "no-reply@shortn.at",
      to: user.email,
      subject: `Refund Processed - ${refundData.amount}`,
      html: emailHtml,
    });
  } catch (emailError) {
    console.error("Failed to send refund email:", emailError);
  }

  return true;
};

// ============================================================================
// Checkout Session Successful Handler
// ============================================================================
export const checkout_session_successful_handler = async ({
  session,
}: {
  session: Stripe.Checkout.Session;
}) => {
  try {
    const customerId = session.customer as string;
    if (!customerId) {
      return false;
    }

    let item =
      session.line_items?.data?.length === 1
        ? session.line_items.data[0]
        : undefined;

    if (!item) {
      const items = await stripe.checkout.sessions.listLineItems(session.id);
      item = items.data?.length === 1 ? items.data[0] : undefined;
    }

    if (!item || !item.price) {
      return false;
    }

    const price = item.price;

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

    if (!shouldUpdate || !newPlan) {
      return true;
    }

    const updateSuccess = await update_sub({
      newPlan: newPlan as "basic" | "plus" | "pro",
      customerId,
    });

    if (updateSuccess && user.email) {
      try {
        const dashboardLink = `${BASEURL}/en/dashboard/settings/plan`;
        const oldPlanDisplayName = PLAN_DISPLAY_NAMES[oldPlan] || oldPlan;
        const newPlanDisplayName = PLAN_DISPLAY_NAMES[newPlan] || newPlan;
        const newFeatures = PLAN_FEATURES[newPlan] || [];

        const amountTotal = session.amount_total || 0;
        const amountSubtotal = session.amount_subtotal || amountTotal;
        const taxAmount = amountTotal - amountSubtotal;
        const currency = session.currency || "eur";

        const subtotal = formatCurrency(amountSubtotal, currency);
        const tax =
          taxAmount > 0 ? formatCurrency(taxAmount, currency) : undefined;
        const total = formatCurrency(amountTotal, currency);

        let discount:
          | {
              name: string;
              code?: string;
              amount: string;
              percentOff?: number;
            }
          | undefined;

        if (
          session.total_details?.amount_discount &&
          session.total_details.amount_discount > 0
        ) {
          discount = {
            name: "Discount",
            amount: formatCurrency(
              session.total_details.amount_discount,
              currency,
            ),
          };
        }

        const billingInterval = price.recurring?.interval || "month";
        const billingPeriod = getBillingPeriodDisplay(billingInterval);

        const newPlanPriceId =
          newPlan === "basic"
            ? env.BASIC_PLAN_ID
            : newPlan === "plus"
              ? env.PLUS_PLAN_ID
              : env.PRO_PLAN_ID;
        const recurringUnitAmount = getBasePlanPrice(newPlanPriceId);
        const recurringAmount = `${formatCurrency(recurringUnitAmount, currency)}/${billingInterval}`;

        const effectiveDate = formatDate(new Date());

        const paymentMethod = await getPaymentMethodInfo(customerId);
        const billingDetails = await getBillingDetails(customerId);

        const emailHtml = subscriptionUpgradedTemplate({
          userName: user.name || "there",
          oldPlan: oldPlanDisplayName,
          newPlan: newPlanDisplayName,
          dashboardLink,
          newFeatures,
          amount: recurringAmount,
          subtotal,
          discount,
          tax,
          total,
          effectiveDate,
          billingPeriod,
          cardLast4: paymentMethod?.last4,
          cardBrand: paymentMethod?.brand,
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
  } catch (error) {
    console.error("Checkout session handler error:", error);
    return false;
  }
};

// ============================================================================
// Main Webhook Handler
// ============================================================================
export async function POST(req: Request) {
  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");

    let event: Stripe.Event;
    try {
      if (!sig || !webhookSecret) {
        return new Response(`Webhook error: Missing signature or secret`, {
          status: 400,
        });
      }
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Webhook signature verification failed.",
        }),
        { status: 400 },
      );
    }

    await connectDB();

    switch (event.type) {
      case "checkout.session.completed": {
        const success = await checkout_session_successful_handler({
          session: event.data.object,
        });
        return new Response(
          JSON.stringify({
            success,
            message: success ? "Received" : "Handler failed",
          }),
          { status: success ? 200 : 500 },
        );
      }

      case "customer.subscription.created": {
        const success = await subscription_created_handler(event.data.object);
        return new Response(
          JSON.stringify({
            success,
            message: success ? "Received" : "Handler failed",
          }),
          { status: success ? 200 : 500 },
        );
      }

      case "customer.subscription.deleted": {
        const success = await subscription_deleted_handler(event.data.object);
        return new Response(
          JSON.stringify({
            success,
            message: success ? "Received" : "Handler failed",
          }),
          { status: success ? 200 : 500 },
        );
      }

      case "customer.subscription.updated": {
        const success = await subscription_updated_handler(event.data.object);
        return new Response(
          JSON.stringify({
            success,
            message: success ? "Received" : "Handler failed",
          }),
          { status: success ? 200 : 500 },
        );
      }

      case "invoice.paid": {
        const success = await invoice_paid_handler(event.data.object);
        return new Response(
          JSON.stringify({
            success,
            message: success ? "Received" : "Handler failed",
          }),
          { status: success ? 200 : 500 },
        );
      }

      case "invoice.payment_failed": {
        const success = await invoice_payment_failed_handler(event.data.object);
        return new Response(
          JSON.stringify({
            success,
            message: success ? "Received" : "Handler failed",
          }),
          { status: success ? 200 : 500 },
        );
      }

      case "customer.subscription.trial_will_end": {
        const success = await subscription_trial_will_end_handler(
          event.data.object,
        );
        return new Response(
          JSON.stringify({
            success,
            message: success ? "Received" : "Handler failed",
          }),
          { status: success ? 200 : 500 },
        );
      }

      case "charge.refunded": {
        const success = await charge_refunded_handler(event.data.object);
        return new Response(
          JSON.stringify({
            success,
            message: success ? "Received" : "Handler failed",
          }),
          { status: success ? 200 : 500 },
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: true, message: "Event received" }),
          { status: 200 },
        );
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return new Response(
      JSON.stringify({ success: false, message: "Webhook handler failed." }),
      { status: 500 },
    );
  }
}
