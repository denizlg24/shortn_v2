import type { ReactElement } from "react";
import { messages, type Locale } from "./messages";
import {
  ConfirmEmailChange,
  EmailVerified,
  ResetPassword,
  VerifyEmail,
  WorkspaceInvite,
} from "./templates/account";
import {
  announcementSubject,
  ProductAnnouncement,
} from "./templates/announcement";
import {
  BillingEmail,
  billingSubject,
  type BillingNotice,
} from "./templates/billing";
import {
  ContactNotification,
  contactNotificationSubject,
  ContactReceived,
  contactReceivedSubject,
} from "./templates/contact";
import { DomainReady, domainReadySubject } from "./templates/domain";
import {
  BillingReceipt,
  BillingRefund,
  receiptSubject,
  refundSubject,
  type Receipt,
  type Refund,
} from "./templates/receipt";
import { WebhookDisabled, webhookDisabledSubject } from "./templates/webhook";
import {
  WorkspaceExportReady,
  workspaceExportSubject,
} from "./templates/workspace-export";

export interface CatalogEntry {
  slug: string;
  title: string;
  subject: string;
  /** Every URL the email must link to. */
  urls: string[];
  element: ReactElement;
}

// Realistic sample data for the tests and `bun run preview`. Not exported
// from the package.
export const sample = {
  app: "https://app.shortn.at",
  name: "Ana Ferreira",
  inviter: "Rui Costa",
  workspace: "Vida Económica",
  newEmail: "ana.ferreira@vidaeconomica.pt",
  hostname: "links.vidaeconomica.pt",
  webhook: "CMS publish hook",
  endpoint: "https://hooks.vidaeconomica.pt/shortn/events?source=production",
  reference: "CT-20261018-K7PQ2",
  date: "12 November 2026",
  topic: "Sales",
  message:
    "Hi,\n\nWe print around 40 QR codes a week across three magazines. Can we move them to our own domain without reprinting?\n\nThanks,\nAna",
};

const at = (path: string) => `${sample.app}${path}`;

const period = {
  start: new Date("2026-10-01T12:00:00Z"),
  end: new Date("2026-11-01T12:00:00Z"),
};

// Mirrors the worker's Polar fixtures (apps/worker/src/billing-receipts.test.ts).
function sampleReceipts(plans: Record<"basic" | "plus" | "pro", string>) {
  const newSubscription: Receipt = {
    reason: "subscription_create",
    plan: plans.pro,
    product: "Shortn Pro",
    currency: "eur",
    items: [{ label: "Shortn Pro", amount: 1500 }],
    subtotal: 1500,
    discount: { amount: 300, name: "Launch offer", code: "LAUNCH20" },
    tax: 276,
    appliedBalance: 0,
    total: 1476,
    card: { brand: "visa", last4: "4242" },
    invoiceNumber: "SHORTN-2026-0042",
    period,
    nextRenewal: period.end,
  };
  return {
    newSubscription,
    upgrade: {
      ...newSubscription,
      reason: "subscription_update",
      items: [
        {
          label: "Unused time on Shortn Plus (after 15 Oct 2026)",
          amount: -400,
        },
        {
          label: "Remaining time on Shortn Pro (after 15 Oct 2026)",
          amount: 750,
        },
      ],
      subtotal: 350,
      discount: undefined,
      tax: 80,
      total: 430,
      card: { brand: "mastercard", last4: "5100" },
      invoiceNumber: "SHORTN-2026-0057",
    } satisfies Receipt,
    renewal: {
      ...newSubscription,
      reason: "subscription_cycle",
      plan: plans.plus,
      product: "Shortn Plus",
      items: [{ label: "Shortn Plus", amount: 800 }],
      subtotal: 800,
      discount: undefined,
      tax: 184,
      appliedBalance: -200,
      total: 984,
      invoiceNumber: "SHORTN-2026-0071",
      period: {
        start: new Date("2026-11-01T12:00:00Z"),
        end: new Date("2026-12-01T12:00:00Z"),
      },
      nextRenewal: new Date("2026-12-01T12:00:00Z"),
    } satisfies Receipt,
    free: {
      ...newSubscription,
      discount: { amount: 1500, name: "Press partners", code: null },
      tax: 0,
      total: 0,
      card: undefined,
      invoiceNumber: null,
      receiptNumber: "R-2026-0012",
    } satisfies Receipt,
    addon: {
      ...newSubscription,
      reason: "purchase",
      plan: undefined,
      product: "Custom domains",
      items: [{ label: "Custom domains", amount: 300 }],
      subtotal: 300,
      discount: undefined,
      tax: 69,
      total: 369,
      invoiceNumber: "SHORTN-2026-0063",
      period: undefined,
      nextRenewal: undefined,
    } satisfies Receipt,
  };
}

const sampleRefund: Refund = {
  currency: "eur",
  refunded: 1200,
  refundedTax: 276,
  originalTotal: 1476,
  product: "Shortn Pro",
  card: { brand: "visa", last4: "4242" },
  reference: "SHORTN-2026-0042",
};

export function catalog(locale: Locale): CatalogEntry[] {
  const t = messages[locale];
  const plans = t.billing.plans;
  const billingUrl = at("/vida-economica/settings/billing");
  const receipts = sampleReceipts(plans);
  const billing = (slug: string, title: string, notice: BillingNotice) => ({
    slug,
    title,
    subject: billingSubject(locale, notice),
    urls: [billingUrl],
    element: (
      <BillingEmail
        locale={locale}
        workspace={sample.workspace}
        notice={notice}
        url={billingUrl}
      />
    ),
  });
  const receipt = (slug: string, title: string, data: Receipt) => ({
    slug,
    title,
    subject: receiptSubject(locale, data),
    urls: [billingUrl],
    element: (
      <BillingReceipt
        locale={locale}
        workspace={sample.workspace}
        receipt={data}
        url={billingUrl}
      />
    ),
  });
  const verifyUrl = at("/api/auth/verify-email?token=eyJhbGciOiJIUzI1NiJ9");
  const resetUrl = at("/reset-password/Xf3kP9qLmZ2v");
  const changeUrl = at("/api/auth/verify-email?token=change-eyJhbGciOi");
  const inviteUrl = at("/invite/inv_4m8QkP2xZr");
  const domainsUrl = at("/vida-economica/settings/domains");
  const settingsUrl = at("/vida-economica/settings");
  const exportUrl = at(
    "/vida-economica/settings/workspace/exports/6712f0c4a1b2c3d4e5f60718",
  );
  return [
    {
      slug: "verify-email",
      title: "Verify email (sign-up)",
      subject: t.verify.subject,
      urls: [verifyUrl],
      element: (
        <VerifyEmail
          locale={locale}
          name={sample.name}
          url={verifyUrl}
          reason="signup"
        />
      ),
    },
    {
      slug: "verify-email-change",
      title: "Verify email (new address)",
      subject: t.verify.changeSubject,
      urls: [verifyUrl],
      element: (
        <VerifyEmail
          locale={locale}
          name={sample.name}
          url={verifyUrl}
          reason="change"
        />
      ),
    },
    {
      slug: "email-verified",
      title: "Email verified",
      subject: t.verified.subject,
      urls: [sample.app],
      element: <EmailVerified locale={locale} url={sample.app} />,
    },
    {
      slug: "reset-password",
      title: "Reset password",
      subject: t.reset.subject,
      urls: [resetUrl],
      element: <ResetPassword locale={locale} url={resetUrl} />,
    },
    {
      slug: "confirm-email-change",
      title: "Approve email change",
      subject: t.emailChange.subject,
      urls: [changeUrl],
      element: (
        <ConfirmEmailChange
          locale={locale}
          newEmail={sample.newEmail}
          url={changeUrl}
        />
      ),
    },
    {
      slug: "workspace-invite",
      title: "Workspace invite",
      subject: t.invite.subject(sample.workspace),
      urls: [inviteUrl],
      element: (
        <WorkspaceInvite
          locale={locale}
          inviter={sample.inviter}
          workspace={sample.workspace}
          role="member"
          url={inviteUrl}
        />
      ),
    },
    receipt(
      "receipt-new",
      "Receipt: new subscription",
      receipts.newSubscription,
    ),
    receipt(
      "receipt-upgrade",
      "Receipt: upgrade with proration",
      receipts.upgrade,
    ),
    receipt(
      "receipt-renewal",
      "Receipt: renewal with balance",
      receipts.renewal,
    ),
    receipt("receipt-free", "Receipt: zero total", receipts.free),
    receipt("receipt-addon", "Receipt: add-on purchase", receipts.addon),
    {
      slug: "refund",
      title: "Refund",
      subject: refundSubject(locale, sampleRefund),
      urls: [billingUrl],
      element: (
        <BillingRefund
          locale={locale}
          workspace={sample.workspace}
          refund={sampleRefund}
          url={billingUrl}
        />
      ),
    },
    billing("billing-scheduled", "Billing: change scheduled", {
      kind: "scheduled",
      plan: plans.basic,
      date: sample.date,
    }),
    billing("billing-canceled", "Billing: subscription ending", {
      kind: "canceled",
      date: sample.date,
    }),
    billing("billing-payment-failed", "Billing: payment failed", {
      kind: "payment_failed",
      failure: {
        currency: "eur",
        amountDue: 1476,
        card: { brand: "visa", last4: "9995" },
        declineReason: "insufficient_funds",
        declineMessage: "Your card has insufficient funds.",
        nextAttemptAt: new Date("2026-11-04T12:00:00Z"),
      },
    }),
    billing(
      "billing-payment-failed-plain",
      "Billing: payment failed (Polar unavailable)",
      { kind: "payment_failed" },
    ),
    {
      slug: "contact-received",
      title: "Contact: received (to sender)",
      subject: contactReceivedSubject(locale, sample.reference),
      urls: [],
      element: (
        <ContactReceived
          locale={locale}
          reference={sample.reference}
          message={sample.message}
        />
      ),
    },
    {
      slug: "contact-notification",
      title: "Contact: notification (to team, English only)",
      subject: contactNotificationSubject(sample.topic, sample.reference),
      urls: [`mailto:${sample.newEmail}`],
      element: (
        <ContactNotification
          reference={sample.reference}
          name={sample.name}
          email={sample.newEmail}
          company={sample.workspace}
          topic={sample.topic}
          locale={locale}
          message={sample.message}
        />
      ),
    },
    {
      slug: "domain-ready",
      title: "Custom domain ready",
      subject: domainReadySubject(locale),
      urls: [domainsUrl],
      element: (
        <DomainReady
          locale={locale}
          hostname={sample.hostname}
          url={domainsUrl}
        />
      ),
    },
    {
      slug: "webhook-disabled",
      title: "Webhook disabled",
      subject: webhookDisabledSubject(locale),
      urls: [settingsUrl],
      element: (
        <WebhookDisabled
          locale={locale}
          name={sample.webhook}
          endpoint={sample.endpoint}
          url={settingsUrl}
        />
      ),
    },
    {
      slug: "workspace-export-ready",
      title: "Workspace export ready",
      subject: workspaceExportSubject(locale),
      urls: [exportUrl],
      element: (
        <WorkspaceExportReady
          locale={locale}
          workspace={sample.workspace}
          url={exportUrl}
        />
      ),
    },
    {
      slug: "product-announcement",
      title: "Product announcement",
      subject: announcementSubject(locale),
      urls: [sample.app],
      element: (
        <ProductAnnouncement
          locale={locale}
          name="Ana"
          handle="vidaeconomica"
          url={sample.app}
        />
      ),
    },
    {
      slug: "product-announcement-generic",
      title: "Product announcement (no name or handle)",
      subject: announcementSubject(locale),
      urls: [sample.app],
      element: <ProductAnnouncement locale={locale} url={sample.app} />,
    },
  ];
}
