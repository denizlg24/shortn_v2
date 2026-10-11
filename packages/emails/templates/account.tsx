import {
  Action,
  FallbackLink,
  Heading,
  Layout,
  Muted,
  Paragraph,
} from "../layout";
import { messages, type Locale } from "../messages";

interface Base {
  locale: Locale;
}

export function VerifyEmail({
  locale,
  name,
  url,
  reason,
}: Base & { name: string; url: string; reason: "signup" | "change" }) {
  const t = messages[locale];
  const change = reason === "change";
  return (
    <Layout
      locale={locale}
      preview={change ? t.verify.changeBody : t.verify.body}
      footer={t.footer}
    >
      <Heading>
        {change ? t.verify.changeHeading : t.verify.heading(name)}
      </Heading>
      <Paragraph>{change ? t.verify.changeBody : t.verify.body}</Paragraph>
      <Action href={url}>{t.verify.action}</Action>
      <FallbackLink label={t.fallback} href={url} />
      <Muted>{t.ignore}</Muted>
    </Layout>
  );
}

export function EmailVerified({ locale, url }: Base & { url: string }) {
  const t = messages[locale];
  return (
    <Layout locale={locale} preview={t.verified.body} footer={t.footer}>
      <Heading>{t.verified.heading}</Heading>
      <Paragraph>{t.verified.body}</Paragraph>
      <Action href={url}>{t.verified.action}</Action>
    </Layout>
  );
}

export function ResetPassword({ locale, url }: Base & { url: string }) {
  const t = messages[locale];
  return (
    <Layout locale={locale} preview={t.reset.body} footer={t.footer}>
      <Heading>{t.reset.heading}</Heading>
      <Paragraph>{t.reset.body}</Paragraph>
      <Action href={url}>{t.reset.action}</Action>
      <FallbackLink label={t.fallback} href={url} />
      <Muted>{t.reset.expiry}</Muted>
      <Muted>{t.ignore}</Muted>
    </Layout>
  );
}

export function ConfirmEmailChange({
  locale,
  newEmail,
  url,
}: Base & { newEmail: string; url: string }) {
  const t = messages[locale];
  return (
    <Layout
      locale={locale}
      preview={t.emailChange.body(newEmail)}
      footer={t.footer}
    >
      <Heading>{t.emailChange.heading}</Heading>
      <Paragraph>{t.emailChange.body(newEmail)}</Paragraph>
      <Action href={url}>{t.emailChange.action}</Action>
      <FallbackLink label={t.fallback} href={url} />
      <Muted>{t.ignore}</Muted>
    </Layout>
  );
}

export function WorkspaceInvite({
  locale,
  inviter,
  workspace,
  role,
  url,
}: Base & {
  inviter: string;
  workspace: string;
  role: "admin" | "member" | "viewer";
  url: string;
}) {
  const t = messages[locale];
  const heading = t.invite.heading(inviter, workspace);
  return (
    <Layout locale={locale} preview={heading} footer={t.footer}>
      <Heading>{heading}</Heading>
      <Paragraph>{t.invite.body(t.invite.roles[role])}</Paragraph>
      <Action href={url}>{t.invite.action}</Action>
      <FallbackLink label={t.fallback} href={url} />
      <Muted>{t.invite.expiry}</Muted>
    </Layout>
  );
}
