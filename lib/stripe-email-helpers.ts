/**
 * Stripe Email Helpers
 * Utility functions to retrieve payment and subscription data from Stripe for transactional emails
 */

import Stripe from "stripe";
import env from "@/utils/env";

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export interface SubscriptionEmailData {
  userName: string;
  userEmail: string;
  planName: string;
  planDisplayName: string;
  features: string[];
  currency: string;
  unitAmount: number;
  formattedUnitAmount: string;
  billingInterval: "month" | "year";
  billingPeriod: string;
  recurringAmount: string;
  invoiceId?: string;
  invoiceNumber?: string;
  invoicePdfUrl?: string;
  hostedInvoiceUrl?: string;
  subtotal: string;
  discount?: DiscountInfo;
  tax?: string;
  taxAmount: number;
  total: string;
  amountPaid: string;
  amountDue: string;
  transactionDate: string;
  periodStart: string;
  periodEnd: string;
  nextBillingDate?: string;
  paymentMethod?: PaymentMethodInfo;
  billingDetails: BillingDetails;
  dashboardLink: string;
}

export interface DiscountInfo {
  name: string;
  code?: string;
  percentOff?: number;
  amountOff?: number;
  formattedAmountOff?: string;
  duration: string;
  durationInMonths?: number;
}

export interface PaymentMethodInfo {
  type: string;
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  displayName: string;
}

export interface BillingDetails {
  email?: string;
  name?: string;
  companyName?: string;
  taxId?: string;
  taxIdType?: string;
  billingAddress?: string;
  phoneNumber?: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitAmount: string;
  amount: string;
  proration: boolean;
}

export interface UpcomingInvoiceData {
  nextBillingDate: string;
  subtotal: string;
  tax?: string;
  total: string;
  discount?: DiscountInfo;
  lineItems: InvoiceLineItem[];
}

export interface PaymentFailureData {
  failureCode?: string;
  failureMessage?: string;
  nextRetryDate?: string;
  attemptCount: number;
}

export interface RefundData {
  refundId: string;
  amount: string;
  reason?: string;
  status: string;
  createdDate: string;
}

export const PLAN_FEATURES: Record<string, string[]> = {
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

export const PLAN_DISPLAY_NAMES: Record<string, string> = {
  free: "Free Plan",
  basic: "Basic Plan",
  plus: "Plus Plan",
  pro: "Pro Plan",
};

export const PLAN_HIERARCHY: Record<string, number> = {
  free: 0,
  basic: 1,
  plus: 2,
  pro: 3,
};

export function getPlanFromPriceId(priceId: string): string {
  switch (priceId) {
    case env.FREE_PLAN_ID:
      return "free";
    case env.BASIC_PLAN_ID:
      return "basic";
    case env.PLUS_PLAN_ID:
      return "plus";
    case env.PRO_PLAN_ID:
      return "pro";
    default:
      return "free";
  }
}

export function getPriceIdFromPlan(plan: string): string {
  switch (plan) {
    case "free":
      return env.FREE_PLAN_ID;
    case "basic":
      return env.BASIC_PLAN_ID;
    case "plus":
      return env.PLUS_PLAN_ID;
    case "pro":
      return env.PRO_PLAN_ID;
    default:
      return env.FREE_PLAN_ID;
  }
}

export function getBasePlanPrice(priceId: string): number {
  const prices: Record<string, number> = {
    [env.FREE_PLAN_ID]: 0,
    [env.BASIC_PLAN_ID]: 500,
    [env.PLUS_PLAN_ID]: 1500,
    [env.PRO_PLAN_ID]: 2500,
  };
  return prices[priceId] || 0;
}

export function formatCurrency(
  amount: number,
  currency: string = "eur",
): string {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatter.format(amount / 100);
}

export function formatDate(
  date: Date | number,
  options?: Intl.DateTimeFormatOptions,
): string {
  const dateObj = typeof date === "number" ? new Date(date * 1000) : date;
  return dateObj.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    ...options,
  });
}

export function getBillingPeriodDisplay(interval: string): string {
  switch (interval) {
    case "month":
      return "Monthly";
    case "year":
      return "Yearly";
    case "week":
      return "Weekly";
    case "day":
      return "Daily";
    default:
      return "Monthly";
  }
}

export async function getPaymentMethodInfo(
  customerId: string,
  paymentMethodId?: string | null,
): Promise<PaymentMethodInfo | undefined> {
  try {
    let paymentMethod: Stripe.PaymentMethod | undefined;

    if (paymentMethodId) {
      paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    } else {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: "card",
        limit: 1,
      });
      paymentMethod = paymentMethods.data[0];
    }

    if (!paymentMethod) {
      return undefined;
    }

    if (paymentMethod.type === "card" && paymentMethod.card) {
      const card = paymentMethod.card;
      const brand = card.brand
        ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1)
        : "Card";

      return {
        type: "card",
        brand,
        last4: card.last4,
        expMonth: card.exp_month,
        expYear: card.exp_year,
        displayName: `${brand} •••• ${card.last4}`,
      };
    }

    return {
      type: paymentMethod.type,
      displayName:
        paymentMethod.type.charAt(0).toUpperCase() +
        paymentMethod.type.slice(1),
    };
  } catch (error) {
    console.error("Failed to fetch payment method:", error);
    return undefined;
  }
}

export async function getBillingDetails(
  customerId: string,
): Promise<BillingDetails> {
  try {
    const customer = await stripe.customers.retrieve(customerId, {
      expand: ["tax_ids"],
    });

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

    const taxIdData = customer.tax_ids?.data?.[0];
    const taxId = taxIdData?.value;
    const taxIdType = taxIdData?.type;

    return {
      email: customer.email || undefined,
      name: customer.name || undefined,
      companyName: customer.name || undefined,
      taxId,
      taxIdType,
      billingAddress,
      phoneNumber: customer.phone || undefined,
    };
  } catch (error) {
    console.error("Failed to fetch billing details:", error);
    return {};
  }
}

export async function getDiscountInfo(
  discount: Stripe.Discount | null | undefined,
  currency: string = "eur",
): Promise<DiscountInfo | undefined> {
  if (!discount) {
    return undefined;
  }

  const discount_promo = discount.promotion_code as
    | Stripe.PromotionCode
    | undefined;
  const coupon_id = discount_promo?.promotion.coupon as
    | string
    | Stripe.Coupon
    | null
    | undefined;
  if (!coupon_id) {
    return undefined;
  }

  const coupon =
    typeof coupon_id === "string"
      ? await stripe.coupons.retrieve(coupon_id)
      : coupon_id;

  let promoCode: string | undefined;
  if (discount.promotion_code) {
    if (typeof discount.promotion_code === "string") {
      promoCode = discount.promotion_code;
    } else {
      promoCode = (discount.promotion_code as Stripe.PromotionCode).code;
    }
  }

  return {
    name: "Discount",
    code: promoCode,
    percentOff: coupon.percent_off || undefined,
    amountOff: coupon.amount_off || undefined,
    formattedAmountOff: coupon.amount_off
      ? formatCurrency(coupon.amount_off, currency)
      : undefined,
    duration: coupon.duration,
    durationInMonths: coupon.duration_in_months || undefined,
  };
}

export async function getInvoiceDiscounts(
  invoice: Stripe.Invoice,
): Promise<DiscountInfo | undefined> {
  if (
    invoice.total_discount_amounts &&
    invoice.total_discount_amounts.length > 0
  ) {
    const totalDiscount = invoice.total_discount_amounts.reduce(
      (sum, d) => sum + d.amount,
      0,
    );
    if (totalDiscount > 0) {
      const firstDiscount = invoice.discounts?.[0];
      let discountInfo: DiscountInfo | undefined;

      if (firstDiscount && typeof firstDiscount !== "string") {
        discountInfo = await getDiscountInfo(
          firstDiscount as Stripe.Discount,
          invoice.currency,
        );
      }

      return {
        name: discountInfo?.name || "Discount",
        code: discountInfo?.code,
        percentOff: discountInfo?.percentOff,
        amountOff: totalDiscount,
        formattedAmountOff: formatCurrency(totalDiscount, invoice.currency),
        duration: discountInfo?.duration || "once",
        durationInMonths: discountInfo?.durationInMonths,
      };
    }
  }

  const invoiceDiscounts = invoice.discounts;
  if (invoiceDiscounts && invoiceDiscounts.length > 0) {
    const firstDiscount = invoiceDiscounts[0];
    if (typeof firstDiscount !== "string") {
      return getDiscountInfo(
        firstDiscount as Stripe.Discount,
        invoice.currency,
      );
    }
  }

  return undefined;
}

export async function getLatestInvoice(
  subscriptionId: string,
): Promise<Stripe.Invoice | null> {
  try {
    const invoices = await stripe.invoices.list({
      subscription: subscriptionId,
      limit: 1,
    });
    return invoices.data[0] || null;
  } catch (error) {
    console.error("Failed to fetch latest invoice:", error);
    return null;
  }
}

export async function getInvoiceById(
  invoiceId: string,
): Promise<Stripe.Invoice | null> {
  try {
    return await stripe.invoices.retrieve(invoiceId, {
      expand: ["subscription", "discounts", "total_discount_amounts.discount"],
    });
  } catch (error) {
    console.error("Failed to fetch invoice:", error);
    return null;
  }
}

export async function getUpcomingInvoice(
  customerId: string,
  subscriptionId?: string,
): Promise<UpcomingInvoiceData | null> {
  try {
    const subscription = subscriptionId
      ? await stripe.subscriptions.retrieve(subscriptionId)
      : null;

    if (!subscription) {
      return null;
    }

    const subItem = subscription.items.data[0];
    if (!subItem) {
      return null;
    }

    const currency = subItem.price.currency || "eur";
    const unitAmount = subItem.price.unit_amount || 0;
    const interval = subItem.price.recurring?.interval || "month";

    const periodEnd = subscription.cancel_at;
    const nextBillingDate = periodEnd
      ? formatDate(periodEnd)
      : formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

    const lineItems: InvoiceLineItem[] = [
      {
        description: `${PLAN_DISPLAY_NAMES[getPlanFromPriceId(subItem.price.id)] || "Subscription"} - ${getBillingPeriodDisplay(interval)}`,
        quantity: subItem.quantity || 1,
        unitAmount: formatCurrency(unitAmount, currency),
        amount: formatCurrency(unitAmount * (subItem.quantity || 1), currency),
        proration: false,
      },
    ];

    let discount: DiscountInfo | undefined;
    const subscriptionDiscounts = subscription.discounts;
    if (subscriptionDiscounts && subscriptionDiscounts.length > 0) {
      const firstDiscount = subscriptionDiscounts[0];
      if (typeof firstDiscount !== "string") {
        discount = await getDiscountInfo(
          firstDiscount as Stripe.Discount,
          currency,
        );
      }
    }

    let total = unitAmount;
    if (discount?.amountOff) {
      total = Math.max(0, total - discount.amountOff);
    } else if (discount?.percentOff) {
      total = Math.round(total * (1 - discount.percentOff / 100));
    }

    return {
      nextBillingDate,
      subtotal: formatCurrency(unitAmount, currency),
      tax: undefined, // Tax calculated at invoice time
      total: formatCurrency(total, currency),
      discount,
      lineItems,
    };
  } catch (error) {
    console.error("Failed to fetch upcoming invoice:", error);
    return null;
  }
}

export async function getSubscriptionDetails(
  subscriptionId: string,
): Promise<Stripe.Subscription | null> {
  try {
    return await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["default_payment_method", "latest_invoice", "schedule"],
    });
  } catch (error) {
    console.error("Failed to fetch subscription:", error);
    return null;
  }
}

export async function getPaymentFailureData(
  invoice: Stripe.Invoice,
): Promise<PaymentFailureData> {
  let failureCode: string | undefined;
  let failureMessage: string | undefined;

  const inv = invoice;
  const charge = inv.payments?.data?.[0].payment.charge;
  const paymentIntent = inv.payments?.data?.[0].payment.payment_intent;

  if (charge) {
    const chargeId = typeof charge === "string" ? charge : charge.id;

    try {
      const charge = await stripe.charges.retrieve(chargeId);
      failureCode = charge.failure_code || undefined;
      failureMessage = charge.failure_message || undefined;
    } catch (error) {
      console.error("Failed to fetch charge:", error);
    }
  }

  if (!failureMessage && paymentIntent) {
    const piId =
      typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(piId);
      if (paymentIntent.last_payment_error) {
        failureCode = paymentIntent.last_payment_error.code || undefined;
        failureMessage = paymentIntent.last_payment_error.message || undefined;
      }
    } catch (error) {
      console.error("Failed to fetch payment intent:", error);
    }
  }

  const nextRetryDate = invoice.next_payment_attempt
    ? formatDate(invoice.next_payment_attempt)
    : formatDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));

  return {
    failureCode,
    failureMessage: failureMessage || getFailureMessageFromCode(failureCode),
    nextRetryDate,
    attemptCount: invoice.attempt_count || 1,
  };
}

export function getFailureMessageFromCode(code?: string): string {
  const messages: Record<string, string> = {
    card_declined: "Your card was declined",
    insufficient_funds: "Insufficient funds",
    lost_card: "Card reported lost",
    stolen_card: "Card reported stolen",
    expired_card: "Card has expired",
    incorrect_cvc: "Incorrect security code",
    processing_error: "Processing error - please try again",
    incorrect_number: "Invalid card number",
    invalid_expiry_month: "Invalid expiration month",
    invalid_expiry_year: "Invalid expiration year",
    authentication_required: "Authentication required",
  };
  return messages[code || ""] || "Payment could not be processed";
}

export async function getRefundData(
  chargeId: string,
): Promise<RefundData | null> {
  try {
    const charge = await stripe.charges.retrieve(chargeId, {
      expand: ["refunds"],
    });

    const latestRefund = charge.refunds?.data?.[0];
    if (!latestRefund) {
      return null;
    }

    return {
      refundId: latestRefund.id,
      amount: formatCurrency(latestRefund.amount, latestRefund.currency),
      reason: latestRefund.reason || undefined,
      status: latestRefund.status || "succeeded",
      createdDate: formatDate(latestRefund.created),
    };
  } catch (error) {
    console.error("Failed to fetch refund data:", error);
    return null;
  }
}

export async function buildSubscriptionEmailData(params: {
  customerId: string;
  subscription?: Stripe.Subscription;
  invoice?: Stripe.Invoice;
  userName: string;
  userEmail: string;
  dashboardLink: string;
}): Promise<SubscriptionEmailData> {
  const {
    customerId,
    subscription,
    invoice,
    userName,
    userEmail,
    dashboardLink,
  } = params;

  let plan = "free";
  let priceId = env.FREE_PLAN_ID;
  let currency = "eur";
  let unitAmount = 0;
  let billingInterval: "month" | "year" = "month";

  if (subscription) {
    const subItem = subscription.items.data[0];
    if (subItem) {
      priceId = subItem.price.id;
      plan = getPlanFromPriceId(priceId);
      currency = subItem.price.currency || "eur";
      unitAmount = subItem.price.unit_amount || 0;
      billingInterval =
        (subItem.price.recurring?.interval as "month" | "year") || "month";
    }
  }

  const paymentMethodId = subscription?.default_payment_method
    ? typeof subscription.default_payment_method === "string"
      ? subscription.default_payment_method
      : subscription.default_payment_method.id
    : null;
  const paymentMethod = await getPaymentMethodInfo(customerId, paymentMethodId);

  const billingDetails = await getBillingDetails(customerId);

  let subtotal = formatCurrency(unitAmount, currency);
  let taxAmount = 0;
  let tax: string | undefined;
  let total = subtotal;
  let discount: DiscountInfo | undefined;
  let invoiceId: string | undefined;
  let invoiceNumber: string | undefined;
  let invoicePdfUrl: string | undefined;
  let hostedInvoiceUrl: string | undefined;
  let amountPaid = formatCurrency(0, currency);
  let amountDue = subtotal;
  let periodStart = formatDate(new Date());
  let periodEnd = formatDate(new Date());

  if (invoice) {
    invoiceId = invoice.id;
    invoiceNumber = invoice.number || undefined;
    invoicePdfUrl = invoice.invoice_pdf || undefined;
    hostedInvoiceUrl = invoice.hosted_invoice_url || undefined;
    subtotal = formatCurrency(invoice.subtotal, invoice.currency);
    taxAmount = invoice.total_taxes?.[0]?.amount || 0;
    tax =
      taxAmount > 0 ? formatCurrency(taxAmount, invoice.currency) : undefined;
    total = formatCurrency(invoice.total, invoice.currency);
    discount = await getInvoiceDiscounts(invoice);
    amountPaid = formatCurrency(invoice.amount_paid, invoice.currency);
    amountDue = formatCurrency(invoice.amount_due, invoice.currency);
    periodStart = formatDate(invoice.period_start);
    periodEnd = formatDate(invoice.period_end);
    currency = invoice.currency;
  } else if (subscription) {
    if (subscription.start_date) {
      periodStart = formatDate(subscription.start_date);
    }
    if (subscription.cancel_at) {
      periodEnd = formatDate(subscription.cancel_at);
    }

    const subscriptionDiscounts = subscription.discounts;
    if (subscriptionDiscounts && subscriptionDiscounts.length > 0) {
      const firstDiscount = subscriptionDiscounts[0];
      if (typeof firstDiscount !== "string") {
        discount = await getDiscountInfo(
          firstDiscount as Stripe.Discount,
          currency,
        );
      }
    }
  }

  let nextBillingDate: string | undefined;
  if (subscription && subscription.status === "active") {
    try {
      const upcomingInvoice = await getUpcomingInvoice(
        customerId,
        subscription.id,
      );
      nextBillingDate = upcomingInvoice?.nextBillingDate;
    } catch {
      nextBillingDate = undefined;
    }
  }

  if (!nextBillingDate && subscription) {
    if (subscription.cancel_at) {
      nextBillingDate = formatDate(subscription.cancel_at);
    }
  }

  return {
    userName,
    userEmail,
    planName: plan,
    planDisplayName: PLAN_DISPLAY_NAMES[plan] || plan,
    features: PLAN_FEATURES[plan] || [],
    currency,
    unitAmount,
    formattedUnitAmount: formatCurrency(unitAmount, currency),
    billingInterval,
    billingPeriod: getBillingPeriodDisplay(billingInterval),
    recurringAmount: `${formatCurrency(unitAmount, currency)}/${billingInterval}`,
    invoiceId,
    invoiceNumber,
    invoicePdfUrl,
    hostedInvoiceUrl,
    subtotal,
    discount,
    tax,
    taxAmount,
    total,
    amountPaid,
    amountDue,
    transactionDate: formatDate(new Date()),
    periodStart,
    periodEnd,
    nextBillingDate,
    paymentMethod,
    billingDetails,
    dashboardLink,
  };
}

export function formatDiscountDisplay(discount: DiscountInfo): string {
  if (discount.percentOff) {
    return `${discount.percentOff}% off${discount.code ? ` (${discount.code})` : ""}`;
  }
  if (discount.formattedAmountOff) {
    return `${discount.formattedAmountOff} off${discount.code ? ` (${discount.code})` : ""}`;
  }
  return discount.name;
}

export function getDiscountDurationDisplay(discount: DiscountInfo): string {
  switch (discount.duration) {
    case "forever":
      return "Forever";
    case "once":
      return "One-time";
    case "repeating":
      return discount.durationInMonths
        ? `${discount.durationInMonths} months`
        : "Limited time";
    default:
      return "";
  }
}
