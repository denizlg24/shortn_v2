import {
  validateEvent,
  WebhookVerificationError,
} from "@polar-sh/sdk/webhooks";
import { Webhook } from "standardwebhooks";
import type { VerifiedEvent } from "./webhooks";
import { WebhookSubscriptionCreatedPayload$inboundSchema as schema0 } from "@polar-sh/sdk/models/components/webhooksubscriptioncreatedpayload.js";
import { WebhookSubscriptionUpdatedPayload$inboundSchema as schema1 } from "@polar-sh/sdk/models/components/webhooksubscriptionupdatedpayload.js";
import { WebhookSubscriptionActivePayload$inboundSchema as schema2 } from "@polar-sh/sdk/models/components/webhooksubscriptionactivepayload.js";
import { WebhookSubscriptionCanceledPayload$inboundSchema as schema3 } from "@polar-sh/sdk/models/components/webhooksubscriptioncanceledpayload.js";
import { WebhookSubscriptionUncanceledPayload$inboundSchema as schema4 } from "@polar-sh/sdk/models/components/webhooksubscriptionuncanceledpayload.js";
import { WebhookSubscriptionRevokedPayload$inboundSchema as schema5 } from "@polar-sh/sdk/models/components/webhooksubscriptionrevokedpayload.js";
import { WebhookSubscriptionPastDuePayload$inboundSchema as schema6 } from "@polar-sh/sdk/models/components/webhooksubscriptionpastduepayload.js";
import { WebhookOrderCreatedPayload$inboundSchema as schema7 } from "@polar-sh/sdk/models/components/webhookordercreatedpayload.js";
import { WebhookOrderUpdatedPayload$inboundSchema as schema8 } from "@polar-sh/sdk/models/components/webhookorderupdatedpayload.js";
import { WebhookOrderPaidPayload$inboundSchema as schema9 } from "@polar-sh/sdk/models/components/webhookorderpaidpayload.js";
import { WebhookOrderRefundedPayload$inboundSchema as schema10 } from "@polar-sh/sdk/models/components/webhookorderrefundedpayload.js";
import { WebhookCustomerStateChangedPayload$inboundSchema as schema11 } from "@polar-sh/sdk/models/components/webhookcustomerstatechangedpayload.js";

const schemas = {
  "subscription.created": schema0,
  "subscription.updated": schema1,
  "subscription.active": schema2,
  "subscription.canceled": schema3,
  "subscription.uncanceled": schema4,
  "subscription.revoked": schema5,
  "subscription.past_due": schema6,
  "order.created": schema7,
  "order.updated": schema8,
  "order.paid": schema9,
  "order.refunded": schema10,
  "customer.state_changed": schema11,
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
