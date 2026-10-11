import {
  validateEvent,
  WebhookVerificationError,
} from "@polar-sh/sdk/webhooks";
import { collection } from "@shortn/db";
import type { Db } from "mongodb";

// The fields this handler reads; every validated Polar event satisfies it.
export interface VerifiedEvent {
  type: string;
  data: object;
}
export type Verify = (
  body: string,
  headers: Record<string, string>,
  secret: string,
) => VerifiedEvent;

const field = (data: object, name: string): unknown => Reflect.get(data, name);
const stringField = (data: object, name: string) => {
  const value = field(data, name);
  return typeof value === "string" && value ? [value] : [];
};

// Which subscriptions an event concerns; everything else is recorded but
// needs no mirror work.
export function subscriptionIdsOf(event: VerifiedEvent): string[] {
  if (event.type.startsWith("subscription."))
    return stringField(event.data, "id");
  if (event.type.startsWith("order."))
    return stringField(event.data, "subscriptionId");
  if (event.type === "customer.state_changed") {
    const active = field(event.data, "activeSubscriptions");
    return Array.isArray(active)
      ? active.flatMap((sub: unknown) =>
          sub && typeof sub === "object" ? stringField(sub, "id") : [],
        )
      : [];
  }
  return [];
}

export type WebhookResult =
  | { status: 403 }
  | { status: 200; duplicate: true }
  | { status: 202; id: string; subscriptionIds: string[] };

export async function receivePolarWebhook(
  input: { body: string; headers: Record<string, string>; secret: string },
  deps: {
    db: Db;
    verify?: Verify;
    log?: (message: string, error?: unknown) => void;
  },
): Promise<WebhookResult> {
  let event: VerifiedEvent;
  try {
    event = (deps.verify ?? validateEvent)(
      input.body,
      input.headers,
      input.secret,
    );
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      deps.log?.("polar webhook verification failed", error);
      return { status: 403 };
    }
    throw error;
  }
  const id = input.headers["webhook-id"];
  if (!id) return { status: 403 };
  const subscriptionIds = subscriptionIdsOf(event);
  try {
    await collection(deps.db, "billing_events").insertOne({
      _id: id,
      type: event.type,
      subscriptionIds,
      receivedAt: new Date(),
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 11000)
      return { status: 200, duplicate: true };
    throw error;
  }
  // apps/worker picks up unprocessed events within seconds (16 D4).
  return { status: 202, id, subscriptionIds };
}
