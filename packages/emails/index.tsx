import {
  PlatformNotice,
  platformSubject,
  type PlatformNoticeKind,
} from "./templates/platform";
import type { ReactElement } from "react";
import { Resend } from "resend";
import { renderEmail } from "./render";
import {
  WorkspaceExportReady,
  workspaceExportSubject,
} from "./templates/workspace-export";
import { messages, type Locale } from "./messages";
import { WebhookDisabled, webhookDisabledSubject } from "./templates/webhook";
import { DomainReady, domainReadySubject } from "./templates/domain";
import {
  ContactNotification,
  contactNotificationSubject,
  ContactReceived,
  contactReceivedSubject,
} from "./templates/contact";
import {
  BillingEmail,
  billingSubject,
  type BillingNotice,
} from "./templates/billing";
import {
  BillingReceipt,
  BillingRefund,
  receiptSubject,
  refundSubject,
  type Receipt,
  type Refund,
} from "./templates/receipt";
import {
  announcementSubject,
  ProductAnnouncement,
} from "./templates/announcement";
import {
  ConfirmEmailChange,
  EmailVerified,
  ResetPassword,
  VerifyEmail,
  WorkspaceInvite,
} from "./templates/account";

export { isLocale, locales, messages, type Locale } from "./messages";
export type { Card } from "./format";
export type { BillingNotice, PaymentFailure } from "./templates/billing";
export type { Receipt, ReceiptReason, Refund } from "./templates/receipt";

export interface MailerConfig {
  apiKey: string;
  from: string;
  // Comma-separated addresses or "@domain" suffixes. When set, every other
  // recipient is dropped, so staging can't reach real customers (15).
  allowlist?: string | undefined;
  /**
   * Dashboard origin that serves apps/web/public (the brand mark). Only an
   * https origin is used: mail clients can't load images from localhost.
   */
  assetOrigin?: string | undefined;
}

export function recipientAllowed(allowlist: string | undefined, to: string) {
  if (!allowlist?.trim()) return true;
  const address = to.trim().toLowerCase();
  return allowlist
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .some((entry) =>
      entry.startsWith("@") ? address.endsWith(entry) : address === entry,
    );
}

export function logoUrl(assetOrigin: string | undefined) {
  if (!assetOrigin?.startsWith("https://")) return undefined;
  return new URL("/email/mark@2x.png", assetOrigin).toString();
}

// Announcements go to every account, so they carry an unsubscribe route.
const announcementHeaders = {
  "List-Unsubscribe": "<mailto:support@shortn.at?subject=unsubscribe>",
};

interface SendOptions {
  idempotencyKey?: string | undefined;
  replyTo?: string | undefined;
  headers?: Record<string, string> | undefined;
}

export function createMailer(config: MailerConfig) {
  const resend = new Resend(config.apiKey);
  const logo = logoUrl(config.assetOrigin);
  async function send(
    to: string,
    subject: string,
    element: ReactElement,
    options: SendOptions = {},
  ) {
    if (!recipientAllowed(config.allowlist, to)) {
      console.info("mail dropped by allowlist", { subject });
      return;
    }
    const { html, text } = await renderEmail(element);
    const { error } = await resend.emails.send(
      {
        from: config.from,
        to,
        subject,
        html,
        text,
        ...(options.replyTo ? { replyTo: options.replyTo } : {}),
        ...(options.headers ? { headers: options.headers } : {}),
      },
      options.idempotencyKey
        ? { idempotencyKey: options.idempotencyKey }
        : undefined,
    );
    if (error) throw new Error(`Resend: ${error.name}: ${error.message}`);
  }
  return {
    platformNotice(input: {
      to: string;
      locale: Locale;
      kind: PlatformNoticeKind;
      details: { label: string; value: string }[];
      idempotencyKey: string;
    }) {
      return send(
        input.to,
        platformSubject(input.locale, input.kind),
        <PlatformNotice {...input} logoUrl={logo} />,
        { idempotencyKey: input.idempotencyKey },
      );
    },
    contactReceived(input: {
      to: string;
      locale: Locale;
      reference: string;
      message: string;
    }) {
      return send(
        input.to,
        contactReceivedSubject(input.locale, input.reference),
        <ContactReceived {...input} logoUrl={logo} />,
        { idempotencyKey: `contact-received-${input.reference}` },
      );
    },
    contactNotification(input: {
      to: string;
      replyTo: string;
      reference: string;
      name: string;
      email: string;
      company?: string | undefined;
      topic: string;
      locale: Locale;
      message: string;
    }) {
      return send(
        input.to,
        contactNotificationSubject(input.topic, input.reference),
        <ContactNotification {...input} logoUrl={logo} />,
        {
          idempotencyKey: `contact-notification-${input.reference}`,
          replyTo: input.replyTo,
        },
      );
    },
    workspaceExportReady(input: {
      to: string;
      locale: Locale;
      workspace: string;
      url: string;
      idempotencyKey: string;
    }) {
      return send(
        input.to,
        workspaceExportSubject(input.locale),
        <WorkspaceExportReady {...input} logoUrl={logo} />,
        { idempotencyKey: input.idempotencyKey },
      );
    },
    webhookDisabled(input: {
      to: string;
      locale: Locale;
      name: string;
      endpoint?: string | undefined;
      url: string;
      idempotencyKey: string;
    }) {
      return send(
        input.to,
        webhookDisabledSubject(input.locale),
        <WebhookDisabled {...input} logoUrl={logo} />,
        { idempotencyKey: input.idempotencyKey },
      );
    },
    domainReady(input: {
      to: string;
      locale: Locale;
      hostname: string;
      url: string;
      idempotencyKey: string;
    }) {
      return send(
        input.to,
        domainReadySubject(input.locale),
        <DomainReady {...input} logoUrl={logo} />,
        { idempotencyKey: input.idempotencyKey },
      );
    },
    verifyEmail(input: {
      to: string;
      locale: Locale;
      name: string;
      url: string;
      reason: "signup" | "change";
    }) {
      const t = messages[input.locale].verify;
      return send(
        input.to,
        input.reason === "change" ? t.changeSubject : t.subject,
        <VerifyEmail {...input} logoUrl={logo} />,
      );
    },
    emailVerified(input: { to: string; locale: Locale; url: string }) {
      return send(
        input.to,
        messages[input.locale].verified.subject,
        <EmailVerified {...input} logoUrl={logo} />,
      );
    },
    resetPassword(input: { to: string; locale: Locale; url: string }) {
      return send(
        input.to,
        messages[input.locale].reset.subject,
        <ResetPassword {...input} logoUrl={logo} />,
      );
    },
    confirmEmailChange(input: {
      to: string;
      locale: Locale;
      newEmail: string;
      url: string;
    }) {
      return send(
        input.to,
        messages[input.locale].emailChange.subject,
        <ConfirmEmailChange {...input} logoUrl={logo} />,
      );
    },
    billing(input: {
      to: string;
      locale: Locale;
      workspace: string;
      notice: BillingNotice;
      url: string;
      idempotencyKey?: string | undefined;
    }) {
      return send(
        input.to,
        billingSubject(input.locale, input.notice),
        <BillingEmail {...input} logoUrl={logo} />,
        { idempotencyKey: input.idempotencyKey },
      );
    },
    billingReceipt(input: {
      to: string;
      locale: Locale;
      workspace: string;
      receipt: Receipt;
      url: string;
      idempotencyKey: string;
    }) {
      return send(
        input.to,
        receiptSubject(input.locale, input.receipt),
        <BillingReceipt {...input} logoUrl={logo} />,
        { idempotencyKey: input.idempotencyKey },
      );
    },
    billingRefund(input: {
      to: string;
      locale: Locale;
      workspace: string;
      refund: Refund;
      url: string;
      idempotencyKey: string;
    }) {
      return send(
        input.to,
        refundSubject(input.locale, input.refund),
        <BillingRefund {...input} logoUrl={logo} />,
        { idempotencyKey: input.idempotencyKey },
      );
    },
    workspaceInvite(input: {
      to: string;
      locale: Locale;
      inviter: string;
      workspace: string;
      role: "admin" | "member" | "viewer";
      url: string;
    }) {
      return send(
        input.to,
        messages[input.locale].invite.subject(input.workspace),
        <WorkspaceInvite {...input} logoUrl={logo} />,
      );
    },
    productAnnouncement(input: {
      to: string;
      locale: Locale;
      name?: string | undefined;
      handle?: string | undefined;
      url: string;
      idempotencyKey?: string | undefined;
    }) {
      return send(
        input.to,
        announcementSubject(input.locale),
        <ProductAnnouncement {...input} logoUrl={logo} />,
        {
          idempotencyKey: input.idempotencyKey,
          headers: announcementHeaders,
        },
      );
    },
  };
}

export type Mailer = ReturnType<typeof createMailer>;
