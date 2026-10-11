import { collection, type Documents } from "@shortn/db";
import type { Db, ObjectId } from "mongodb";
import {
  planRank,
  plans,
  type Feature,
  type PlanDefinition,
  type PlanId,
} from "./catalog";

type Subscription = Documents["subscriptions"];

// past_due keeps full access during its grace window, as legacy does (06).
export const paidStatuses = ["active", "trialing", "past_due"] as const;

export interface Period {
  start: Date;
  end: Date;
}

export interface Entitlements extends PlanDefinition {
  plan: PlanId;
  period: Period;
  subscription?: {
    id: string;
    status: Subscription["status"];
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: Date;
  };
}

export function calendarMonth(now: Date): Period {
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}

const addMonths = (date: Date, months: number) => {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
};

// The mirror can lag a renewal until its webhook lands; roll the stored
// period forward so the usage window never sticks on an expired one.
export function billingPeriod(
  sub: Pick<Subscription, "currentPeriodStart" | "currentPeriodEnd">,
  now: Date,
): Period {
  let start = sub.currentPeriodStart;
  let end = sub.currentPeriodEnd;
  for (let guard = 0; end <= now && guard < 240; guard++) {
    start = end;
    end = addMonths(end, 1);
  }
  return { start, end };
}

export function resolveEntitlements(
  subscriptions: Subscription[],
  now = new Date(),
): Entitlements {
  const paid = subscriptions
    .filter((sub) => (paidStatuses as readonly string[]).includes(sub.status))
    .sort((a, b) => planRank[b.plan] - planRank[a.plan]);
  const best = paid[0];
  if (!best) return { plan: "free", ...plans.free, period: calendarMonth(now) };
  return {
    plan: best.plan,
    ...plans[best.plan],
    period: billingPeriod(best, now),
    subscription: {
      id: best.polarSubscriptionId,
      status: best.status,
      cancelAtPeriodEnd: best.cancelAtPeriodEnd,
      currentPeriodEnd: best.currentPeriodEnd,
    },
  };
}

export async function loadEntitlements(db: Db, workspaceId: ObjectId) {
  const subscriptions = await collection(db, "subscriptions")
    .find({ workspaceId, status: { $in: [...paidStatuses] } })
    .toArray();
  return resolveEntitlements(subscriptions);
}

export const hasFeature = (
  entitlements: Pick<Entitlements, "features">,
  feature: Feature,
) => entitlements.features.includes(feature);

export function minimumPlanFor(feature: Feature): PlanId {
  const plan = (Object.keys(plans) as PlanId[]).find((id) =>
    plans[id].features.includes(feature),
  );
  return plan ?? "enterprise";
}
