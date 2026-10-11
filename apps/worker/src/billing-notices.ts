import { paidStatuses } from "@shortn/billing";
import type { Documents } from "@shortn/db";

type Mirror = Documents["subscriptions"];
type PlanId = Mirror["plan"];

export type Notice =
  | { kind: "started"; plan: PlanId }
  | { kind: "changed"; plan: PlanId }
  | { kind: "scheduled"; plan: PlanId; at: Date }
  | { kind: "canceled"; at: Date }
  | { kind: "payment_failed" };

const paid = (mirror: Mirror | null) =>
  Boolean(
    mirror && (paidStatuses as readonly string[]).includes(mirror.status),
  );

// The emails a mirror transition sends once billing is live (legacy sent
// created/active, canceled and past-due mails from its Polar hooks).
// Comparing states, not event types, keeps replays from re-sending.
export function noticesFor(before: Mirror | null, after: Mirror): Notice[] {
  const notices: Notice[] = [];
  if (!paid(before) && paid(after) && after.status !== "past_due")
    return [{ kind: "started", plan: after.plan }];
  if (!paid(after)) return [];
  if (before && before.plan !== after.plan)
    notices.push({ kind: "changed", plan: after.plan });
  if (after.status === "past_due" && before?.status !== "past_due")
    notices.push({ kind: "payment_failed" });
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
