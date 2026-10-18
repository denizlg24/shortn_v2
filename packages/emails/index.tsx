import { render } from "@react-email/components";
import type { ReactElement } from "react";
import { Resend } from "resend";
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
  ConfirmEmailChange,
  EmailVerified,
  ResetPassword,
  VerifyEmail,
  WorkspaceInvite,
} from "./templates/account";

export { isLocale, locales, messages, type Locale } from "./messages";
export type { BillingNotice } from "./templates/billing";

export interface MailerConfig {
  apiKey: string;
  from: string;
  // Comma-separated addresses or "@domain" suffixes. When set, every other
  // recipient is dropped, so staging can't reach real customers (15).
  allowlist?: string | undefined;
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

export function createMailer(config: MailerConfig) {
  const resend = new Resend(config.apiKey);
  async function send(
    to: string,
    subject: string,
    element: ReactElement,
    idempotencyKey?: string,
    replyTo?: string,
  ) {
    if (!recipientAllowed(config.allowlist, to)) {
      console.info("mail dropped by allowlist", { subject });
      return;
    }
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const { error } = await resend.emails.send(
      {
        from: config.from,
        to,
        subject,
        html,
        text,
        ...(replyTo ? { replyTo } : {}),
      },
      idempotencyKey ? { idempotencyKey } : undefined,
    );
    if (error) throw new Error(`Resend: ${error.name}: ${error.message}`);
  }
  return {
    contactReceived(input: {
      to: string;
      locale: Locale;
      reference: string;
      message: string;
    }) {
      return send(
        input.to,
        contactReceivedSubject(input.locale, input.reference),
        <ContactReceived {...input} />,
        `contact-received-${input.reference}`,
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
        <ContactNotification {...input} />,
        `contact-notification-${input.reference}`,
        input.replyTo,
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
        <WorkspaceExportReady {...input} />,
        input.idempotencyKey,
      );
    },
    webhookDisabled(input: {
      to: string;
      locale: Locale;
      name: string;
      url: string;
      idempotencyKey: string;
    }) {
      return send(
        input.to,
        webhookDisabledSubject(input.locale),
        <WebhookDisabled {...input} />,
        input.idempotencyKey,
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
        <DomainReady {...input} />,
        input.idempotencyKey,
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
        <VerifyEmail {...input} />,
      );
    },
    emailVerified(input: { to: string; locale: Locale; url: string }) {
      return send(
        input.to,
        messages[input.locale].verified.subject,
        <EmailVerified {...input} />,
      );
    },
    resetPassword(input: { to: string; locale: Locale; url: string }) {
      return send(
        input.to,
        messages[input.locale].reset.subject,
        <ResetPassword {...input} />,
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
        <ConfirmEmailChange {...input} />,
      );
    },
    billing(input: {
      to: string;
      locale: Locale;
      workspace: string;
      notice: BillingNotice;
      url: string;
    }) {
      return send(
        input.to,
        billingSubject(input.locale, input.notice),
        <BillingEmail {...input} />,
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
        <WorkspaceInvite {...input} />,
      );
    },
  };
}

export type Mailer = ReturnType<typeof createMailer>;
