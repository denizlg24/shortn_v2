import {
  formatCard,
  formatDate,
  formatDateRange,
  formatMoney,
  type Card,
} from "../format";
import {
  Action,
  DetailRows,
  Heading,
  Layout,
  Ledger,
  Panel,
  Paragraph,
  type Detail,
  type LedgerLine,
  type Branded,
} from "../layout";
import { messages, type Locale } from "../messages";

export type ReceiptReason =
  | "subscription_create"
  | "subscription_update"
  | "subscription_cycle"
  | "purchase";

/** A paid Polar order. Amounts are in the currency's minor unit. */
export interface Receipt {
  reason: ReceiptReason;
  /** Display name of the Shortn plan, when the product is one. */
  plan?: string | undefined;
  product: string;
  currency: string;
  items: readonly { label: string; amount: number }[];
  subtotal: number;
  discount?:
    | { amount: number; name: string; code?: string | null | undefined }
    | undefined;
  tax: number;
  /** Polar's signed customer balance: positive adds to the charge. */
  appliedBalance: number;
  /** After discounts and tax, before any balance. */
  total: number;
  card?: Card | undefined;
  invoiceNumber?: string | null | undefined;
  receiptNumber?: string | null | undefined;
  period?: { start: Date; end: Date } | undefined;
  nextRenewal?: Date | undefined;
}

/** A refunded Polar order. Amounts are in the currency's minor unit. */
export interface Refund {
  currency: string;
  /** Refunded amount excluding tax, as Polar reports it. */
  refunded: number;
  refundedTax: number;
  originalTotal: number;
  product: string;
  card?: Card | undefined;
  reference: string;
}

export const amountPaid = (receipt: Receipt) =>
  Math.max(0, receipt.total + receipt.appliedBalance);

export const receiptSubject = (locale: Locale, receipt: Receipt) =>
  messages[locale].receipt.subject(
    formatMoney(amountPaid(receipt), receipt.currency, locale),
  );

const refundTotal = (refund: Refund) => refund.refunded + refund.refundedTax;

export const refundSubject = (locale: Locale, refund: Refund) =>
  messages[locale].refund.subject(
    formatMoney(refundTotal(refund), refund.currency, locale),
  );

function headline(locale: Locale, receipt: Receipt) {
  const t = messages[locale].receipt;
  const { plan } = receipt;
  if (!plan)
    return {
      heading: t.purchaseHeading(receipt.product),
      body:
        receipt.reason === "subscription_cycle" ? t.cycleBody : t.purchaseBody,
    };
  switch (receipt.reason) {
    case "subscription_create":
      return { heading: t.createHeading(plan), body: t.createBody(plan) };
    case "subscription_update":
      return { heading: t.updateHeading(plan), body: t.updateBody };
    case "subscription_cycle":
      return { heading: t.cycleHeading(plan), body: t.cycleBody };
    case "purchase":
      return {
        heading: t.purchaseHeading(receipt.product),
        body: t.purchaseBody,
      };
  }
}

function discountName(discount: NonNullable<Receipt["discount"]>) {
  const code = discount.code?.trim();
  const name = discount.name.trim();
  if (code && name && code.toLowerCase() !== name.toLowerCase())
    return `${name} (${code})`;
  return name || code || "";
}

function ledger(locale: Locale, receipt: Receipt) {
  const t = messages[locale].receipt;
  const money = (amount: number) =>
    formatMoney(amount, receipt.currency, locale);
  const discount = receipt.discount;
  const adjustments: LedgerLine[] = [
    { label: t.subtotal, amount: money(receipt.subtotal) },
    ...(discount && discount.amount > 0
      ? [
          {
            label: [t.discount, discountName(discount)]
              .filter(Boolean)
              .join(" · "),
            amount: money(-discount.amount),
          },
        ]
      : []),
    { label: t.tax, amount: money(receipt.tax) },
    ...(receipt.appliedBalance
      ? [{ label: t.balance, amount: money(receipt.appliedBalance) }]
      : []),
  ];
  return {
    items: receipt.items.map((item) => ({
      label: item.label,
      amount: money(item.amount),
    })),
    adjustments,
    total: { label: t.total, amount: money(amountPaid(receipt)) },
  };
}

function details(locale: Locale, workspace: string, receipt: Receipt) {
  const t = messages[locale].receipt;
  const rows: Detail[] = [{ label: t.workspace, value: workspace }];
  if (receipt.card)
    rows.push({
      label: t.paidWith,
      value: formatCard(receipt.card, messages[locale].billing.cardFallback),
    });
  if (receipt.invoiceNumber)
    rows.push({ label: t.invoice, value: receipt.invoiceNumber, mono: true });
  else if (receipt.receiptNumber)
    rows.push({ label: t.receipt, value: receipt.receiptNumber, mono: true });
  if (receipt.period)
    rows.push({
      label: t.period,
      value: formatDateRange(receipt.period.start, receipt.period.end, locale),
    });
  if (receipt.nextRenewal)
    rows.push({
      label: t.nextRenewal,
      value: formatDate(receipt.nextRenewal, locale),
    });
  return rows;
}

export function BillingReceipt({
  locale,
  workspace,
  receipt,
  url,
  logoUrl,
}: Branded & {
  locale: Locale;
  workspace: string;
  receipt: Receipt;
  url: string;
}) {
  const t = messages[locale];
  const { heading, body } = headline(locale, receipt);
  return (
    <Layout
      logoUrl={logoUrl}
      locale={locale}
      preview={`${receiptSubject(locale, receipt)} · ${workspace}`}
      footer={t.footer.workspace}
    >
      <Heading>{heading}</Heading>
      <Paragraph>{body}</Paragraph>
      <Panel>
        <Ledger {...ledger(locale, receipt)} />
      </Panel>
      <DetailRows ruled rows={details(locale, workspace, receipt)} />
      <Action href={url}>{t.receipt.action}</Action>
    </Layout>
  );
}

export function BillingRefund({
  locale,
  workspace,
  refund,
  url,
  logoUrl,
}: Branded & {
  locale: Locale;
  workspace: string;
  refund: Refund;
  url: string;
}) {
  const t = messages[locale];
  const money = (amount: number) =>
    formatMoney(amount, refund.currency, locale);
  const total = money(refundTotal(refund));
  const body = refund.card
    ? t.refund.toCard(total)
    : t.refund.toOriginalMethod(total);
  const rows: Detail[] = [
    { label: t.refund.refunded, value: total },
    ...(refund.refundedTax > 0
      ? [{ label: t.refund.includesTax, value: money(refund.refundedTax) }]
      : []),
    { label: t.refund.originalTotal, value: money(refund.originalTotal) },
    { label: t.refund.product, value: refund.product },
    ...(refund.card
      ? [
          {
            label: t.refund.refundedTo,
            value: formatCard(refund.card, t.billing.cardFallback),
          },
        ]
      : []),
    { label: t.refund.reference, value: refund.reference, mono: true },
    { label: t.receipt.workspace, value: workspace },
  ];
  return (
    <Layout
      logoUrl={logoUrl}
      locale={locale}
      preview={body}
      footer={t.footer.workspace}
    >
      <Heading>{t.refund.heading}</Heading>
      <Paragraph>{body}</Paragraph>
      <Panel>
        <DetailRows rows={rows} />
      </Panel>
      <Action href={url}>{t.refund.action}</Action>
    </Layout>
  );
}
