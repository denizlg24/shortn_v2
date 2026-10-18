import type { Polar } from "@polar-sh/sdk";
import {
  applyFetched,
  paidStatuses,
  reconcile,
  type ApplyOutcome,
  type PolarServer,
  type SubscriptionLike,
} from "@shortn/billing";
import { collection, physicalNames, type Documents } from "@shortn/db";
import { messages, type Mailer, type PaymentFailure } from "@shortn/emails";
import { noticesFor } from "./billing-notices";
import { planFromProductName } from "@shortn/db/migrations";
import type { Db } from "mongodb";
import { sendOnce, type MailLedger } from "./billing-mail-ledger";
import { paymentFailureFor, type OrderPolar } from "./billing-receipts";
import type { BillingRecipients } from "./billing-recipients";

export interface BillingDeps {
  db: Db;
  polar: {
    subscriptions: { get(request: { id: string }): Promise<SubscriptionLike> };
  };
  server: PolarServer;
  mode: "shadow" | "live";
  log: (message: string, error?: unknown) => void;
  now?: () => Date;
  // Side effects that only run after the billing switch (06 §Migration 5).
  onApplied?: (
    outcome: Extract<ApplyOutcome, { status: "applied" }>,
  ) => Promise<void>;
  // Runs for order.* events once their subscriptions are applied.
  onOrder?: (event: { type: string; orderId: string }) => Promise<void>;
}

const leaseMs = 60_000;
const maxAttempts = 10;

// What legacy believes for the same subscription: the product-name rule in
// polarActions.ts. Shadow mode records every disagreement (06 §Migration 4).
export function legacyPlanOf(sub: SubscriptionLike) {
  if (!(paidStatuses as readonly string[]).includes(sub.status)) return "free";
  return planFromProductName(sub.product.name) ?? "free";
}

async function recordShadowDiff(
  deps: BillingDeps,
  eventId: string,
  sub: SubscriptionLike,
  outcome: ApplyOutcome,
) {
  const legacy = legacyPlanOf(sub);
  const mirrored =
    outcome.status === "applied"
      ? (paidStatuses as readonly string[]).includes(outcome.after.status)
        ? outcome.after.plan
        : "free"
      : outcome.status;
  if (legacy === mirrored || outcome.status === "stale") return;
  await deps.db.collection(physicalNames.billing_shadow_diffs).insertOne({
    eventId,
    subscriptionId: sub.id,
    legacy,
    mirrored,
    productId: sub.productId,
    status: sub.status,
    at: deps.now ? deps.now() : new Date(),
  });
}

// Claims one unprocessed event with a lease, so two workers never apply the
// same event and a crashed attempt is retried after the lease runs out.
async function claim(db: Db, now: Date) {
  return collection(db, "billing_events").findOneAndUpdate(
    {
      processedAt: { $exists: false },
      attempts: { $not: { $gte: maxAttempts } },
      $or: [{ lockedUntil: { $exists: false } }, { lockedUntil: { $lt: now } }],
    },
    {
      $set: { lockedUntil: new Date(now.getTime() + leaseMs) },
      $inc: { attempts: 1 },
    },
    { sort: { receivedAt: 1 } },
  );
}

type BillingEvent = Documents["billing_events"];

/** Applies one event's subscriptions, then its live-mode side effects. */
export async function handleEvent(
  deps: BillingDeps,
  event: Pick<BillingEvent, "_id" | "type" | "subscriptionIds" | "orderId">,
) {
  for (const id of event.subscriptionIds) {
    const sub = await deps.polar.subscriptions.get({ id });
    const outcome = await applyFetched(deps.db, deps.server, sub);
    if (deps.mode === "shadow")
      await recordShadowDiff(deps, event._id, sub, outcome);
    else if (outcome.status === "applied" && deps.onApplied)
      await deps.onApplied(outcome);
  }
  if (deps.mode === "live" && event.orderId && deps.onOrder)
    await deps.onOrder({ type: event.type, orderId: event.orderId });
}

export async function processBillingEvents(deps: BillingDeps, limit = 50) {
  let processed = 0;
  for (; processed < limit; processed++) {
    const now = deps.now ? deps.now() : new Date();
    const event = await claim(deps.db, now);
    if (!event) break;
    try {
      await handleEvent(deps, event);
      await collection(deps.db, "billing_events").updateOne(
        { _id: event._id },
        {
          $set: { processedAt: new Date() },
          $unset: { lockedUntil: "", error: "" },
        },
      );
    } catch (error) {
      deps.log(`billing event ${event._id} failed`, error);
      const attempts = (event.attempts ?? 0) + 1;
      await collection(deps.db, "billing_events").updateOne(
        { _id: event._id },
        {
          $set: {
            error: String(error).slice(0, 500),
            // Exponential backoff capped at an hour.
            lockedUntil: new Date(
              now.getTime() + Math.min(2 ** attempts * 5_000, 3_600_000),
            ),
          },
        },
      );
    }
  }
  return processed;
}

export async function runReconcile(deps: BillingDeps & { polar: Polar }) {
  const report = await reconcile(deps.db, deps.polar, deps.server);
  await deps.db
    .collection(physicalNames.billing_reconcile_runs)
    .insertOne({ ...report, at: new Date() });
  const drift =
    report.changed + report.unmapped.length + report.orphaned.length;
  deps.log(
    `billing reconcile: ${report.checked} checked, ${report.changed} corrected, ${report.unmapped.length} unmapped, ${report.orphaned.length} orphaned`,
    drift && deps.mode === "live" ? new Error("billing drift") : undefined,
  );
  return report;
}

// Live-mode side effect: email the workspace owner about the transition.
// English only for now: the user's language isn't stored server-side yet.
export function billingMailer(deps: {
  mailer: Pick<Mailer, "billing">;
  recipients: Pick<BillingRecipients, "forWorkspace">;
  ledger: MailLedger;
  polar: Pick<OrderPolar, "orders" | "payments">;
  log: (message: string, error?: unknown) => void;
  now?: () => Date;
}): NonNullable<BillingDeps["onApplied"]> {
  return async ({ before, after }) => {
    const notices = noticesFor(before, after);
    if (!notices.length) return;
    const recipient = await deps.recipients.forWorkspace(after.workspaceId);
    if (!recipient) return;
    const locale = "en";
    const plans = messages[locale].billing.plans;
    const date = (at: Date) =>
      at.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
    const send = (
      notice: Parameters<Mailer["billing"]>[0]["notice"],
      idempotencyKey?: string,
    ) =>
      deps.mailer.billing({
        to: recipient.to,
        locale,
        workspace: recipient.workspace,
        url: recipient.url,
        notice,
        idempotencyKey,
      });
    for (const notice of notices) {
      if (notice.kind === "scheduled")
        await send({
          kind: "scheduled",
          plan: plans[notice.plan],
          date: date(notice.at),
        });
      else if (notice.kind === "canceled")
        await send({ kind: "canceled", date: date(notice.at) });
      else await sendPaymentFailed(after, send);
    }
  };

  // Every applied event while past due lands here, so both variants go
  // through the ledger. A failed lookup degrades to the plain notice, keyed
  // by subscription and period, rather than throwing.
  async function sendPaymentFailed(
    after: Parameters<NonNullable<BillingDeps["onApplied"]>>[0]["after"],
    send: (
      notice: { kind: "payment_failed"; failure?: PaymentFailure },
      idempotencyKey?: string,
    ) => Promise<void>,
  ) {
    const subscriptionId = after.polarSubscriptionId;
    let latest: Awaited<ReturnType<typeof paymentFailureFor>>;
    try {
      latest = await paymentFailureFor(deps.polar, subscriptionId);
    } catch (error) {
      deps.log(
        `billing mail: failed payment lookup for ${subscriptionId}`,
        error,
      );
    }
    const at = deps.now ? deps.now() : new Date();
    if (!latest) {
      const key = `payment-failed:${subscriptionId}:${after.currentPeriodEnd.toISOString()}`;
      return sendOnce(deps.ledger, key, at, () =>
        send({ kind: "payment_failed" }, key),
      );
    }
    const key = `payment-failed:${latest.orderId}`;
    const failure = latest.failure;
    await sendOnce(deps.ledger, key, at, () =>
      send({ kind: "payment_failed", failure }, key),
    );
  }
}
