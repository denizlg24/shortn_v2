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

export function catalog(locale: Locale): CatalogEntry[] {
  const t = messages[locale];
  const plans = t.billing.plans;
  const billing = (slug: string, title: string, notice: BillingNotice) => {
    const url = at("/vida-economica/settings/billing");
    return {
      slug,
      title,
      subject: billingSubject(locale, notice),
      urls: [url],
      element: (
        <BillingEmail
          locale={locale}
          workspace={sample.workspace}
          notice={notice}
          url={url}
        />
      ),
    };
  };
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
    billing("billing-started", "Billing: plan started", {
      kind: "started",
      plan: plans.pro,
    }),
    billing("billing-changed", "Billing: plan changed", {
      kind: "changed",
      plan: plans.plus,
    }),
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
    }),
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
        <ProductAnnouncement locale={locale} name="Ana" url={sample.app} />
      ),
    },
  ];
}
