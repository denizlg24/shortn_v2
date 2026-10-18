import {
  Action,
  DetailRows,
  FallbackLink,
  Heading,
  Layout,
  Muted,
  Panel,
  Paragraph,
  type Branded,
} from "../layout";
import { messages, type Locale } from "../messages";

interface Base {
  locale: Locale;
}

// Auth falls back to the email address when a user has no name; greeting
// someone by their address reads like a mail merge gone wrong.
const greetingName = (name: string) => (name.includes("@") ? "" : name.trim());

export function VerifyEmail({
  locale,
  name,
  url,
  reason,
  logoUrl,
}: Branded &
  Base & { name: string; url: string; reason: "signup" | "change" }) {
  const t = messages[locale];
  const change = reason === "change";
  const body = change ? t.verify.changeBody : t.verify.body(greetingName(name));
  return (
    <Layout
      logoUrl={logoUrl}
      locale={locale}
      preview={body}
      footer={t.footer.account}
    >
      <Heading>{change ? t.verify.changeHeading : t.verify.heading}</Heading>
      <Paragraph>{body}</Paragraph>
      <Action href={url}>{t.verify.action}</Action>
      <Muted>{t.verify.expiry}</Muted>
      <FallbackLink label={t.fallback} href={url} />
      <Muted>{t.ignore}</Muted>
    </Layout>
  );
}

export function EmailVerified({
  locale,
  url,
  logoUrl,
}: Branded & Base & { url: string }) {
  const t = messages[locale];
  return (
    <Layout
      logoUrl={logoUrl}
      locale={locale}
      preview={t.verified.body}
      footer={t.footer.account}
    >
      <Heading>{t.verified.heading}</Heading>
      <Paragraph>{t.verified.body}</Paragraph>
      <Action href={url}>{t.verified.action}</Action>
    </Layout>
  );
}

export function ResetPassword({
  locale,
  url,
  logoUrl,
}: Branded & Base & { url: string }) {
  const t = messages[locale];
  return (
    <Layout
      logoUrl={logoUrl}
      locale={locale}
      preview={t.reset.body}
      footer={t.footer.account}
    >
      <Heading>{t.reset.heading}</Heading>
      <Paragraph>{t.reset.body}</Paragraph>
      <Action href={url}>{t.reset.action}</Action>
      <Muted>{t.reset.expiry}</Muted>
      <FallbackLink label={t.fallback} href={url} />
      <Muted>{t.ignore}</Muted>
    </Layout>
  );
}

export function ConfirmEmailChange({
  locale,
  newEmail,
  url,
  logoUrl,
}: Branded & Base & { newEmail: string; url: string }) {
  const t = messages[locale];
  return (
    <Layout
      logoUrl={logoUrl}
      locale={locale}
      preview={t.emailChange.body}
      footer={t.footer.account}
    >
      <Heading>{t.emailChange.heading}</Heading>
      <Paragraph>{t.emailChange.body}</Paragraph>
      <Panel>
        <DetailRows
          rows={[{ label: t.emailChange.newEmail, value: newEmail }]}
        />
      </Panel>
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
  logoUrl,
}: Branded &
  Base & {
    inviter: string;
    workspace: string;
    role: "admin" | "member" | "viewer";
    url: string;
  }) {
  const t = messages[locale];
  const body = t.invite.body(inviter, t.invite.roles[role]);
  return (
    <Layout
      logoUrl={logoUrl}
      locale={locale}
      preview={body}
      footer={t.footer.invite}
    >
      <Heading>{t.invite.heading(workspace)}</Heading>
      <Paragraph>
        {body} {t.invite.roleDescriptions[role]}
      </Paragraph>
      <Action href={url}>{t.invite.action}</Action>
      <Muted>{t.invite.expiry}</Muted>
      <FallbackLink label={t.fallback} href={url} />
    </Layout>
  );
}
