import { sendEmail } from "@/app/actions/sendEmail";
import {
  subscriptionCreatedEmailTemplate,
  subscriptionActiveEmailTemplate,
  paymentSuccessfulEmailTemplate,
  subscriptionCanceledEmailTemplate,
  subscriptionUncanceledEmailTemplate,
  subscriptionRevokedEmailTemplate,
  orderRefundedEmailTemplate,
} from "@/lib/email-templates";
import { BASEURL } from "@/lib/utils";
import { format } from "date-fns";

/**
 * Fetch invoice PDF from URL and convert to base64 for email attachment
 */
async function fetchInvoiceAttachment(invoiceUrl: string) {
  try {
    const response = await fetch(invoiceUrl);
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    return {
      filename: `invoice-${Date.now()}.pdf`,
      content: base64,
    };
  } catch (error) {
    console.error("Failed to fetch invoice:", error);
    return null;
  }
}

/**
 * Get plan features for email display
 */
function getPlanFeatures(planName: string): string[] {
  const plan = planName.toLowerCase();

  if (plan.includes("basic")) {
    return [
      "Up to 100 short links per month",
      "Up to 50 QR codes per month",
      "Basic analytics and click tracking",
      "Custom link aliases",
      "Link expiration settings",
    ];
  }

  if (plan.includes("plus")) {
    return [
      "Up to 500 short links per month",
      "Up to 250 QR codes per month",
      "Advanced analytics with time-based insights",
      "City-level location tracking",
      "Campaign management",
      "Priority support",
    ];
  }

  if (plan.includes("pro")) {
    return [
      "Unlimited short links",
      "Unlimited QR codes",
      "Full analytics suite with device & browser details",
      "Source tracking and UTM parameters",
      "API access",
      "White-label options",
      "24/7 priority support",
    ];
  }

  return ["Access to all premium features"];
}

/**
 * Format currency amount for display
 */
function formatCurrency(amount: number, _currency: string): string {
  return (amount / 100).toFixed(2);
}

/**
 * Send subscription created email
 */
export async function sendSubscriptionCreatedEmail(params: {
  userEmail: string;
  userName: string;
  planName: string;
}) {
  const html = subscriptionCreatedEmailTemplate({
    userName: params.userName,
    planName: params.planName,
    planFeatures: getPlanFeatures(params.planName),
    dashboardLink: `${BASEURL}/dashboard`,
  });

  await sendEmail({
    from: "no-reply@shortn.at",
    to: params.userEmail,
    subject: `Welcome to Shortn ${params.planName}!`,
    html,
  });
}

/**
 * Send subscription active email
 */
export async function sendSubscriptionActiveEmail(params: {
  userEmail: string;
  userName: string;
  planName: string;
  nextBillingDate: Date;
}) {
  const html = subscriptionActiveEmailTemplate({
    userName: params.userName,
    planName: params.planName,
    nextBillingDate: format(params.nextBillingDate, "MMMM d, yyyy"),
    dashboardLink: `${BASEURL}/dashboard`,
  });

  await sendEmail({
    from: "no-reply@shortn.at",
    to: params.userEmail,
    subject: `Your Shortn ${params.planName} subscription is now active!`,
    html,
  });
}

/**
 * Send payment successful email
 */
export async function sendPaymentSuccessfulEmail(params: {
  userEmail: string;
  userName: string;
  planName: string;
  amount: number;
  currency: string;
  nextBillingDate: Date;
  invoiceUrl?: string;
}) {
  const html = paymentSuccessfulEmailTemplate({
    userName: params.userName,
    planName: params.planName,
    amount: formatCurrency(params.amount, params.currency),
    currency: params.currency.toUpperCase(),
    nextBillingDate: format(params.nextBillingDate, "MMMM d, yyyy"),
    invoiceUrl: params.invoiceUrl,
    manageSubscriptionLink: `${BASEURL}/dashboard/settings/plan`,
  });

  let attachments:
    | Array<{ filename: string; content: string | Buffer }>
    | undefined;
  if (params.invoiceUrl) {
    const attachment = await fetchInvoiceAttachment(params.invoiceUrl);
    if (attachment) {
      attachments = [attachment];
    }
  }

  await sendEmail({
    from: "no-reply@shortn.at",
    to: params.userEmail,
    subject: `Payment Received - Shortn ${params.planName}`,
    html,
    attachments,
  });
}

/**
 * Send subscription canceled email
 */
export async function sendSubscriptionCanceledEmail(params: {
  userEmail: string;
  userName: string;
  planName: string;
  endDate: Date;
}) {
  const html = subscriptionCanceledEmailTemplate({
    userName: params.userName,
    planName: params.planName,
    endDate: format(params.endDate, "MMMM d, yyyy"),
    feedbackLink: `${BASEURL}/feedback`,
    manageSubscriptionLink: `${BASEURL}/dashboard/settings/plan`,
  });

  await sendEmail({
    from: "no-reply@shortn.at",
    to: params.userEmail,
    subject: `Your Shortn subscription will end on ${format(params.endDate, "MMMM d, yyyy")}`,
    html,
  });
}

/**
 * Send subscription uncanceled (reactivated) email
 */
export async function sendSubscriptionUncanceledEmail(params: {
  userEmail: string;
  userName: string;
  planName: string;
  nextBillingDate: Date;
}) {
  const html = subscriptionUncanceledEmailTemplate({
    userName: params.userName,
    planName: params.planName,
    nextBillingDate: format(params.nextBillingDate, "MMMM d, yyyy"),
    dashboardLink: `${BASEURL}/dashboard`,
  });

  await sendEmail({
    from: "no-reply@shortn.at",
    to: params.userEmail,
    subject: "Welcome back! Your Shortn subscription continues",
    html,
  });
}

/**
 * Send subscription revoked (ended) email
 */
export async function sendSubscriptionRevokedEmail(params: {
  userEmail: string;
  userName: string;
  planName: string;
}) {
  const html = subscriptionRevokedEmailTemplate({
    userName: params.userName,
    planName: params.planName,
    resubscribeLink: `${BASEURL}/dashboard/subscription`,
  });

  await sendEmail({
    from: "no-reply@shortn.at",
    to: params.userEmail,
    subject: "Your Shortn subscription has ended",
    html,
  });
}

/**
 * Send order refunded email
 */
export async function sendOrderRefundedEmail(params: {
  userEmail: string;
  userName: string;
  amount: number;
  currency: string;
  refundReason?: string;
}) {
  const html = orderRefundedEmailTemplate({
    userName: params.userName,
    amount: formatCurrency(params.amount, params.currency),
    currency: params.currency.toUpperCase(),
    refundReason: params.refundReason,
    supportLink: `${BASEURL}/support`,
  });

  await sendEmail({
    from: "no-reply@shortn.at",
    to: params.userEmail,
    subject: "Refund Processed - Shortn",
    html,
  });
}
