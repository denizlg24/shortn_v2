import type { Polar } from "@polar-sh/sdk";
import {
  applyFetched,
  paidStatuses,
  reconcile,
  type ApplyOutcome,
  type PolarServer,
  type SubscriptionLike,
} from "@shortn/billing";
import { collection, physicalNames } from "@shortn/db";
import { messages, type Mailer } from "@shortn/emails";
import { ObjectId } from "mongodb";
import { noticesFor } from "./billing-notices";
import { planFromProductName } from "@shortn/db/migrations";
import type { Db } from "mongodb";

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

export async function processBillingEvents(deps: BillingDeps, limit = 50) {
  let processed = 0;
  for (; processed < limit; processed++) {
    const now = deps.now ? deps.now() : new Date();
    const event = await claim(deps.db, now);
    if (!event) break;
    try {
      for (const id of event.subscriptionIds) {
        const sub = await deps.polar.subscriptions.get({ id });
        const outcome = await applyFetched(deps.db, deps.server, sub);
        if (deps.mode === "shadow")
          await recordShadowDiff(deps, event._id, sub, outcome);
        else if (outcome.status === "applied" && deps.onApplied)
          await deps.onApplied(outcome);
      }
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
  db: Db;
  mailer: Pick<Mailer, "billing">;
  appUrl: string;
  log: (message: string, error?: unknown) => void;
}): NonNullable<BillingDeps["onApplied"]> {
  return async ({ before, after }) => {
    const notices = noticesFor(before, after);
    if (!notices.length) return;
    const workspace = await collection(deps.db, "workspaces").findOne({
      _id: after.workspaceId,
    });
    if (!workspace || !ObjectId.isValid(workspace.ownerUserId)) return;
    const owner = await deps.db
      .collection(physicalNames.user)
      .findOne(
        { _id: new ObjectId(workspace.ownerUserId) },
        { projection: { email: 1 } },
      );
    if (typeof owner?.email !== "string") return;
    const locale = "en";
    const plans = messages[locale].billing.plans;
    const date = (at: Date) =>
      at.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    for (const notice of notices)
      await deps.mailer.billing({
        to: owner.email,
        locale,
        workspace: workspace.name,
        url: `${deps.appUrl}/${workspace.slug}/settings/billing`,
        notice:
          notice.kind === "started" || notice.kind === "changed"
            ? { kind: notice.kind, plan: plans[notice.plan] }
            : notice.kind === "scheduled"
              ? {
                  kind: "scheduled",
                  plan: plans[notice.plan],
                  date: date(notice.at),
                }
              : notice.kind === "canceled"
                ? { kind: "canceled", date: date(notice.at) }
                : { kind: "payment_failed" },
      });
  };
}
