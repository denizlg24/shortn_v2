import {
  validateEvent,
  WebhookVerificationError,
} from "@polar-sh/sdk/webhooks";
import { Webhook } from "standardwebhooks";
import type { VerifiedEvent } from "./webhooks";
import { WebhookSubscriptionCreatedPayload$inboundSchema as subscriptionCreated } from "@polar-sh/sdk/models/components/webhooksubscriptioncreatedpayload.js";
import { WebhookSubscriptionUpdatedPayload$inboundSchema as subscriptionUpdated } from "@polar-sh/sdk/models/components/webhooksubscriptionupdatedpayload.js";
import { WebhookSubscriptionActivePayload$inboundSchema as subscriptionActive } from "@polar-sh/sdk/models/components/webhooksubscriptionactivepayload.js";
import { WebhookSubscriptionCanceledPayload$inboundSchema as subscriptionCanceled } from "@polar-sh/sdk/models/components/webhooksubscriptioncanceledpayload.js";
import { WebhookSubscriptionUncanceledPayload$inboundSchema as subscriptionUncanceled } from "@polar-sh/sdk/models/components/webhooksubscriptionuncanceledpayload.js";
import { WebhookSubscriptionRevokedPayload$inboundSchema as subscriptionRevoked } from "@polar-sh/sdk/models/components/webhooksubscriptionrevokedpayload.js";
import { WebhookSubscriptionPastDuePayload$inboundSchema as subscriptionPastDue } from "@polar-sh/sdk/models/components/webhooksubscriptionpastduepayload.js";
import { WebhookOrderCreatedPayload$inboundSchema as orderCreated } from "@polar-sh/sdk/models/components/webhookordercreatedpayload.js";
import { WebhookOrderUpdatedPayload$inboundSchema as orderUpdated } from "@polar-sh/sdk/models/components/webhookorderupdatedpayload.js";
import { WebhookOrderPaidPayload$inboundSchema as orderPaid } from "@polar-sh/sdk/models/components/webhookorderpaidpayload.js";
import { WebhookOrderRefundedPayload$inboundSchema as orderRefunded } from "@polar-sh/sdk/models/components/webhookorderrefundedpayload.js";
import { WebhookCustomerStateChangedPayload$inboundSchema as customerStateChanged } from "@polar-sh/sdk/models/components/webhookcustomerstatechangedpayload.js";

const schemas = {
  "subscription.created": subscriptionCreated,
  "subscription.updated": subscriptionUpdated,
  "subscription.active": subscriptionActive,
  "subscription.canceled": subscriptionCanceled,
  "subscription.uncanceled": subscriptionUncanceled,
  "subscription.revoked": subscriptionRevoked,
  "subscription.past_due": subscriptionPastDue,
  "order.created": orderCreated,
  "order.updated": orderUpdated,
  "order.paid": orderPaid,
  "order.refunded": orderRefunded,
  "customer.state_changed": customerStateChanged,
};

// Polar secrets generated since 2026-09-08 use Standard Webhooks key
// derivation. SDK 0.49 still verifies the older literal UTF-8 secret.
// Keep its payload schemas and legacy verifier during the transition.
export function verifyPolarWebhook(
  body: string,
  headers: Record<string, string>,
  secret: string,
): VerifiedEvent {
  try {
    return validateEvent(body, headers, secret);
  } catch (error) {
    if (
      !(error instanceof WebhookVerificationError) ||
      !secret.startsWith("whsec_")
    )
      throw error;
  }
  let parsed: unknown;
  try {
    parsed = new Webhook(secret).verify(body, headers);
  } catch (error) {
    if (error instanceof Error)
      throw new WebhookVerificationError(error.message);
    throw error;
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("type" in parsed) ||
    typeof parsed.type !== "string"
  )
    throw new Error("Invalid Polar webhook payload");
  if (Object.hasOwn(schemas, parsed.type))
    return schemas[parsed.type as keyof typeof schemas].parse(parsed);
  // Signed non-billing events require no subscription work. Persist their
  // delivery id so future/irrelevant event types are still idempotent.
  return { type: parsed.type, data: {} };
}
