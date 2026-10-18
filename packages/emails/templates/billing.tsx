import {
  formatCard,
  formatDate,
  formatMoney,
  plainLine,
  type Card,
} from "../format";
import {
  Action,
  DetailRows,
  Heading,
  Layout,
  Panel,
  Paragraph,
  type Detail,
  type Branded,
} from "../layout";
import { isDeclineCode, messages, type Locale } from "../messages";

/** What Polar knows about the latest failed charge, amounts in minor units. */
export interface PaymentFailure {
  currency: string;
  amountDue: number;
  card?: Card | undefined;
  declineReason?: string | null | undefined;
  declineMessage?: string | null | undefined;
  nextAttemptAt?: Date | null | undefined;
}

// Paid starts and plan changes are covered by the receipt for their order.
export type BillingNotice =
  | { kind: "scheduled"; plan: string; date: string }
  | { kind: "canceled"; date: string }
  | { kind: "payment_failed"; failure?: PaymentFailure | undefined };

export function billingSubject(locale: Locale, notice: BillingNotice) {
  const t = messages[locale].billing;
  switch (notice.kind) {
    case "scheduled":
      return t.scheduledSubject;
    case "canceled":
      return t.canceledSubject;
    case "payment_failed":
      return t.paymentFailedSubject;
  }
}

/**
 * Known decline codes are translated. Otherwise the processor's own message
 * is shown, but only in English since that is the language it comes in.
 */
function declineText(locale: Locale, failure: PaymentFailure) {
  const t = messages[locale].billing;
  const code = failure.declineReason?.trim().toLowerCase();
  if (code && isDeclineCode(code)) return t.declines[code];
  const message = plainLine(failure.declineMessage);
  return locale === "en" && message ? message : t.declined;
}

function failureRows(locale: Locale, failure: PaymentFailure): Detail[] {
  const t = messages[locale].billing;
  return [
    {
      label: t.amountDue,
      value: formatMoney(failure.amountDue, failure.currency, locale),
    },
    ...(failure.card
      ? [{ label: t.card, value: formatCard(failure.card, t.cardFallback) }]
      : []),
    { label: t.reason, value: declineText(locale, failure) },
    ...(failure.nextAttemptAt
      ? [
          {
            label: t.nextAttempt,
            value: formatDate(failure.nextAttemptAt, locale),
          },
        ]
      : []),
  ];
}

function content(locale: Locale, workspace: string, notice: BillingNotice) {
  const t = messages[locale].billing;
  const workspaceRow: Detail = { label: t.workspace, value: workspace };
  switch (notice.kind) {
    case "scheduled":
      return {
        heading: t.scheduledSubject,
        body: t.scheduledBody,
        rows: [
          workspaceRow,
          { label: t.newPlan, value: notice.plan },
          { label: t.startsOn, value: notice.date },
        ],
      };
    case "canceled":
      return {
        heading: t.canceledSubject,
        body: t.canceledBody,
        rows: [
          workspaceRow,
          { label: t.endsOn, value: notice.date },
          { label: t.afterwards, value: t.plans.free },
        ],
      };
    case "payment_failed":
      return {
        heading: t.paymentFailedSubject,
        body: t.paymentFailedBody,
        rows: notice.failure
          ? [workspaceRow, ...failureRows(locale, notice.failure)]
          : [
              workspaceRow,
              { label: t.status, value: t.paymentFailed },
              { label: t.gracePeriod, value: t.gracePeriodValue },
            ],
      };
  }
}

export function BillingEmail({
  locale,
  workspace,
  notice,
  url,
  logoUrl,
}: Branded & {
  locale: Locale;
  workspace: string;
  notice: BillingNotice;
  url: string;
}) {
  const t = messages[locale];
  const { heading, body, rows } = content(locale, workspace, notice);
  return (
    <Layout
      logoUrl={logoUrl}
      locale={locale}
      preview={`${workspace} · ${body}`}
      footer={t.footer.workspace}
    >
      <Heading>{heading}</Heading>
      <Paragraph>{body}</Paragraph>
      <Panel>
        <DetailRows rows={rows} />
      </Panel>
      <Action href={url}>
        {notice.kind === "payment_failed"
          ? t.billing.paymentAction
          : t.billing.action}
      </Action>
    </Layout>
  );
}
