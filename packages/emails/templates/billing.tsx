import { Action, Heading, Layout, Paragraph } from "../layout";
import { messages, type Locale } from "../messages";

export type BillingNotice =
  | { kind: "started"; plan: string }
  | { kind: "changed"; plan: string }
  | { kind: "scheduled"; plan: string; date: string }
  | { kind: "canceled"; date: string }
  | { kind: "payment_failed" };

export function billingSubject(locale: Locale, notice: BillingNotice) {
  const t = messages[locale].billing;
  switch (notice.kind) {
    case "started":
      return t.startedSubject(notice.plan);
    case "changed":
      return t.changedSubject(notice.plan);
    case "scheduled":
      return t.scheduledSubject;
    case "canceled":
      return t.canceledSubject;
    case "payment_failed":
      return t.paymentFailedSubject;
  }
}

function body(locale: Locale, workspace: string, notice: BillingNotice) {
  const t = messages[locale].billing;
  switch (notice.kind) {
    case "started":
      return t.startedBody(workspace);
    case "changed":
      return t.changedBody(workspace, notice.plan);
    case "scheduled":
      return t.scheduledBody(workspace, notice.plan, notice.date);
    case "canceled":
      return t.canceledBody(workspace, notice.date);
    case "payment_failed":
      return t.paymentFailedBody(workspace);
  }
}

export function BillingEmail({
  locale,
  workspace,
  notice,
  url,
}: {
  locale: Locale;
  workspace: string;
  notice: BillingNotice;
  url: string;
}) {
  const t = messages[locale];
  const text = body(locale, workspace, notice);
  return (
    <Layout locale={locale} preview={text} footer={t.footer}>
      <Heading>
        {notice.kind === "started"
          ? t.billing.startedHeading(notice.plan)
          : billingSubject(locale, notice)}
      </Heading>
      <Paragraph>{text}</Paragraph>
      <Action href={url}>{t.billing.action}</Action>
    </Layout>
  );
}
