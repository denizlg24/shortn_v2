import { paidStatuses } from "@shortn/billing";
import type { Documents } from "@shortn/db";

type Mirror = Documents["subscriptions"];
type PlanId = Mirror["plan"];

export type Notice =
  | { kind: "scheduled"; plan: PlanId; at: Date }
  | { kind: "canceled"; at: Date }
  | { kind: "payment_failed" };

const paid = (mirror: Mirror | null) =>
  Boolean(
    mirror && (paidStatuses as readonly string[]).includes(mirror.status),
  );

// The emails a mirror transition sends once billing is live. Paid starts and
// plan changes are not here: each has a paid Polar order, and its receipt
// (order.paid) says what changed. Comparing states, not event types, keeps
// replays from re-sending.
export function noticesFor(before: Mirror | null, after: Mirror): Notice[] {
  if (!paid(after)) return [];
  const notices: Notice[] = [];
  // Asked for on every applied event while past due, not only on the
  // transition: the billing mail ledger sends it once, and a retried event
  // after a failed send would otherwise never deliver it.
  if (after.status === "past_due") notices.push({ kind: "payment_failed" });
  if (after.cancelAtPeriodEnd && !before?.cancelAtPeriodEnd)
    notices.push({
      kind: "canceled",
      at: after.endsAt ?? after.currentPeriodEnd,
    });
  const scheduled = after.scheduledChange;
  if (
    scheduled?.plan &&
    !after.cancelAtPeriodEnd &&
    scheduled.productId !== before?.scheduledChange?.productId
  )
    notices.push({ kind: "scheduled", plan: scheduled.plan, at: scheduled.at });
  return notices;
}
