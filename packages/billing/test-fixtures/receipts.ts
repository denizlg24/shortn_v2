// Synthetic Polar API responses (snake_case, as the SDK receives them) for
// receipt, refund and failed-payment mail. Amounts are in cents.
import { orderFixture } from "./order";

const organizationId = "00000000-0000-4000-8000-000000000002";
const created = "2026-10-01T12:00:00Z";

export function productFixture(
  id: string,
  name: string,
  metadata: Record<string, string> = {},
) {
  return {
    metadata,
    id,
    created_at: created,
    modified_at: null,
    trial_interval: null,
    trial_interval_count: null,
    name,
    description: null,
    visibility: "public",
    recurring_interval: "month",
    recurring_interval_count: 1,
    meter_interval: null,
    meter_interval_count: null,
    is_recurring: true,
    is_archived: false,
    organization_id: organizationId,
  };
}

export function subscriptionFixture(
  id: string,
  productId: string,
  overrides: Partial<{
    status: string;
    current_period_start: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
    ends_at: string | null;
  }> = {},
) {
  return {
    metadata: {},
    created_at: created,
    modified_at: null,
    id,
    amount: 1500,
    currency: "eur",
    recurring_interval: "month",
    recurring_interval_count: 1,
    status: "active",
    current_period_start: "2026-10-01T12:00:00Z",
    current_period_end: "2026-11-01T12:00:00Z",
    current_meter_period_start: null,
    current_meter_period_end: null,
    trial_start: null,
    trial_end: null,
    cancel_at_period_end: false,
    canceled_at: null,
    started_at: created,
    ends_at: null,
    ended_at: null,
    pause_at_period_end: false,
    paused_at: null,
    resumes_at: null,
    customer_id: "cus_1",
    product_id: productId,
    discount_id: null,
    checkout_id: null,
    customer_cancellation_reason: null,
    customer_cancellation_comment: null,
    ...overrides,
  };
}

export function percentageDiscountFixture(
  name: string,
  code: string | null,
  basisPoints: number,
) {
  return {
    duration: "once",
    type: "percentage",
    basis_points: basisPoints,
    created_at: created,
    modified_at: null,
    id: "00000000-0000-4000-8000-0000000000d1",
    metadata: {},
    name,
    code,
    starts_at: null,
    ends_at: null,
    max_redemptions: null,
    redemptions_count: 1,
    organization_id: organizationId,
  };
}

export function itemFixture(
  label: string,
  amount: number,
  taxAmount: number,
  proration = false,
) {
  return {
    created_at: created,
    modified_at: null,
    id: crypto.randomUUID(),
    label,
    amount,
    tax_amount: taxAmount,
    proration,
    product_price_id: null,
  };
}

type NullableOrderFields =
  | "product"
  | "product_id"
  | "subscription"
  | "subscription_id"
  | "discount"
  | "discount_id"
  | "items"
  | "invoice_number";

/** An order as Polar's API returns it, with the optional parts widened. */
export type OrderJson = Omit<
  ReturnType<typeof orderFixture>,
  NullableOrderFields
> & {
  product: ReturnType<typeof productFixture> | null;
  product_id: string | null;
  subscription: ReturnType<typeof subscriptionFixture> | null;
  subscription_id: string | null;
  discount: ReturnType<typeof percentageDiscountFixture> | null;
  discount_id: string | null;
  items: ReturnType<typeof itemFixture>[];
  invoice_number: string | null;
  next_payment_attempt_at: string | null;
};

export function paidOrderFixture(
  id: string,
  overrides: Partial<OrderJson> = {},
): OrderJson {
  return {
    ...orderFixture("sub_1", "cus_1", "owner_1"),
    next_payment_attempt_at: null,
    id,
    status: "paid",
    paid: true,
    refunded_amount: 0,
    refunded_tax_amount: 0,
    refundable_amount: 0,
    refundable_tax_amount: 0,
    ...overrides,
  };
}

export function cardPaymentFixture(
  orderId: string,
  overrides: Partial<{
    id: string;
    status: string;
    amount: number;
    created_at: string;
    decline_reason: string | null;
    decline_message: string | null;
    brand: string;
    last4: string;
  }> = {},
) {
  const { brand = "visa", last4 = "4242", ...payment } = overrides;
  return {
    created_at: created,
    modified_at: null,
    id: crypto.randomUUID(),
    processor: "stripe",
    status: "succeeded",
    amount: 0,
    currency: "eur",
    method: "card",
    trigger: "purchase",
    decline_reason: null,
    decline_message: null,
    organization_id: organizationId,
    checkout_id: null,
    order_id: orderId,
    method_metadata: { brand, last4 },
    ...payment,
  };
}
