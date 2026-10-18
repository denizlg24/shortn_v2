import type { Polar } from "@polar-sh/sdk";
import type { Order } from "@polar-sh/sdk/models/components/order.js";
import type { Payment } from "@polar-sh/sdk/models/components/payment.js";
import { planForProduct, type PolarServer } from "@shortn/billing";
import {
  messages,
  type Card,
  type Locale,
  type Mailer,
  type PaymentFailure,
  type Receipt,
  type ReceiptReason,
  type Refund,
} from "@shortn/emails";
import { sendOnce, type MailLedger } from "./billing-mail-ledger";
import type { BillingRecipients } from "./billing-recipients";

export interface OrderPolar {
  orders: Pick<Polar["orders"], "get" | "list">;
  payments: Pick<Polar["payments"], "list">;
}

// English until the owner's language is stored server-side.
const locale: Locale = "en";

const reasons: readonly ReceiptReason[] = [
  "subscription_create",
  "subscription_update",
  "subscription_cycle",
  "purchase",
];
const reasonOf = (value: string): ReceiptReason =>
  reasons.find((reason) => reason === value) ?? "purchase";

const productName = (order: Order) => order.product?.name ?? order.description;

const cardOf = (payment: Payment | undefined): Card | undefined =>
  payment && "methodMetadata" in payment
    ? {
        brand: payment.methodMetadata.brand,
        last4: payment.methodMetadata.last4,
      }
    : undefined;

/** The order's payments, newest first. A zero-total order has none. */
async function paymentsOf(
  polar: Pick<OrderPolar, "payments">,
  orderId: string,
) {
  const page = await polar.payments.list({
    orderId,
    sorting: ["-created_at"],
    limit: 10,
  });
  return page.result.items;
}

const latest = (payments: readonly Payment[], status: Payment["status"]) =>
  payments.find((payment) => payment.status === status);

export function receiptFrom(
  order: Order,
  server: PolarServer,
  card: Card | undefined,
): Receipt {
  const plan = order.productId
    ? planForProduct(server, order.productId, order.product?.metadata)
    : undefined;
  const subscription = order.subscription;
  const renews =
    subscription &&
    !subscription.cancelAtPeriodEnd &&
    !subscription.endsAt &&
    (subscription.status === "active" || subscription.status === "trialing");
  return {
    reason: reasonOf(order.billingReason),
    plan: plan ? messages[locale].billing.plans[plan] : undefined,
    product: productName(order),
    currency: order.currency,
    // Polar always itemises; the fallback keeps an odd order readable.
    items: order.items.length
      ? order.items.map((item) => ({ label: item.label, amount: item.amount }))
      : [{ label: productName(order), amount: order.subtotalAmount }],
    subtotal: order.subtotalAmount,
    discount:
      order.discountAmount > 0
        ? {
            amount: order.discountAmount,
            name: order.discount?.name ?? "",
            code: order.discount?.code,
          }
        : undefined,
    tax: order.taxAmount,
    appliedBalance: order.appliedBalanceAmount,
    total: order.totalAmount,
    card,
    invoiceNumber: order.invoiceNumber,
    receiptNumber: order.receiptNumber,
    period: subscription
      ? {
          start: subscription.currentPeriodStart,
          end: subscription.currentPeriodEnd,
        }
      : undefined,
    nextRenewal: renews ? subscription.currentPeriodEnd : undefined,
  };
}

export const refundFrom = (order: Order, card: Card | undefined): Refund => ({
  currency: order.currency,
  refunded: order.refundedAmount,
  refundedTax: order.refundedTaxAmount,
  originalTotal: order.totalAmount,
  product: productName(order),
  card,
  reference: order.invoiceNumber ?? order.receiptNumber ?? order.id,
});

export function failureFrom(
  order: Order,
  payment: Payment | undefined,
): PaymentFailure {
  return {
    currency: order.currency,
    amountDue:
      order.dueAmount > 0
        ? order.dueAmount
        : Math.max(0, order.totalAmount + order.appliedBalanceAmount),
    card: cardOf(payment),
    declineReason: payment?.declineReason,
    declineMessage: payment?.declineMessage,
    nextAttemptAt: order.nextPaymentAttemptAt ?? null,
  };
}

export interface OrderMailDeps {
  polar: OrderPolar;
  mailer: Pick<Mailer, "billingReceipt" | "billingRefund">;
  ledger: MailLedger;
  recipients: Pick<BillingRecipients, "forOrder">;
  server: PolarServer;
  log: (message: string, error?: unknown) => void;
  now?: () => Date;
}

/** Live-mode side effect for order events: receipts and refund notices. */
export function orderMailer(deps: OrderMailDeps) {
  return async (event: { type: string; orderId: string }) => {
    if (event.type !== "order.paid" && event.type !== "order.refunded") return;
    const order = await deps.polar.orders.get({ id: event.orderId });
    const refunded = order.refundedAmount + order.refundedTaxAmount;
    if (event.type === "order.paid" ? !order.paid : refunded <= 0) return;
    const recipient = await deps.recipients.forOrder(order);
    if (!recipient) {
      deps.log(`billing mail: no workspace owner for order ${order.id}`);
      return;
    }
    // A second partial refund is a new email; the same refund state is not.
    const key =
      event.type === "order.paid"
        ? `receipt:${order.id}`
        : `refund:${order.id}:${refunded}`;
    const now = deps.now ? deps.now() : new Date();
    await sendOnce(deps.ledger, key, now, async () => {
      const card = cardOf(
        latest(await paymentsOf(deps.polar, order.id), "succeeded"),
      );
      const common = {
        to: recipient.to,
        locale,
        workspace: recipient.workspace,
        url: recipient.url,
        idempotencyKey: key,
      };
      if (event.type === "order.paid")
        await deps.mailer.billingReceipt({
          ...common,
          receipt: receiptFrom(order, deps.server, card),
        });
      else
        await deps.mailer.billingRefund({
          ...common,
          refund: refundFrom(order, card),
        });
    });
  };
}

/** The latest order of a past-due subscription and why its charge failed. */
export async function paymentFailureFor(
  polar: Pick<OrderPolar, "orders" | "payments">,
  subscriptionId: string,
) {
  const page = await polar.orders.list({
    subscriptionId,
    sorting: ["-created_at"],
    limit: 1,
  });
  const order = page.result.items[0];
  if (!order) return undefined;
  const payment = latest(await paymentsOf(polar, order.id), "failed");
  return { orderId: order.id, failure: failureFrom(order, payment) };
}
