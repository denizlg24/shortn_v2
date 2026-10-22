import {
  activeEntitlementOverride,
  collection,
  type Documents,
  type EntitlementOverride,
} from "@shortn/db";
import { ObjectId, type Db } from "mongodb";
import {
  features as catalogFeatures,
  planRank,
  plans,
  type Feature,
  type PlanDefinition,
  type PlanId,
  type PlanLimits,
} from "./catalog";

type Subscription = Documents["subscriptions"];

// past_due keeps full access during its grace window, as legacy does (06).
export const paidStatuses = ["active", "trialing", "past_due"] as const;

export interface Period {
  start: Date;
  end: Date;
}

/** Where the effective entitlements came from, so billing and admin UIs can
 * explain a comp or a limit override. */
export interface EntitlementSources {
  plan: "subscription" | "comp" | "free";
  overriddenLimits: (keyof PlanLimits)[];
  overrideExpiresAt?: Date;
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
  sources: EntitlementSources;
}

/** What entitlement resolution needs from a workspace document. */
export type EntitlementSubject = Pick<
  Documents["workspaces"],
  "_id" | "entitlementOverride"
>;

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

const limitKeys = [
  "links",
  "qrCodes",
  "bioPages",
  "seats",
  "workspaces",
  "analyticsDays",
  "apiPerMinute",
] as const satisfies readonly (keyof PlanLimits)[];
// Fails to compile if PlanLimits gains a key that overrides can't reach.
const everyLimit: Record<
  Exclude<keyof PlanLimits, (typeof limitKeys)[number]>,
  never
> = {};
void everyLimit;
const isFeature = (value: string): value is Feature =>
  catalogFeatures.some((feature) => feature === value);

/** The higher of the best paid plan and an unexpired comp. */
export function effectivePlan(
  subscriptions: Pick<Subscription, "plan" | "status">[],
  override: EntitlementOverride | null | undefined,
  now = new Date(),
): PlanId {
  const paid = subscriptions
    .filter((sub) => (paidStatuses as readonly string[]).includes(sub.status))
    .reduce<PlanId>(
      (best, sub) => (planRank[sub.plan] > planRank[best] ? sub.plan : best),
      "free",
    );
  const comp = activeEntitlementOverride(override, now)?.plan;
  return comp && planRank[comp] > planRank[paid] ? comp : paid;
}

/** Pure: subscriptions, then a staff override (23 §3.4). A comp raises the
 * plan floor; limit overrides replace single limits (null = unlimited, and
 * they may also lower one); features are added or removed by catalog name. */
export function resolveEntitlements(
  subscriptions: Subscription[],
  now = new Date(),
  overrideInput?: EntitlementOverride | null,
): Entitlements {
  const paid = subscriptions
    .filter((sub) => (paidStatuses as readonly string[]).includes(sub.status))
    .sort((a, b) => planRank[b.plan] - planRank[a.plan]);
  const best = paid[0];
  const override = activeEntitlementOverride(overrideInput, now);
  const plan = effectivePlan(paid, override, now);
  const comp = Boolean(best ? plan !== best.plan : plan !== "free");
  const definition = plans[plan];
  const overriddenLimits = limitKeys.filter(
    (key) => override?.limits?.[key] !== undefined,
  );
  const limits: PlanLimits = { ...definition.limits };
  for (const key of overriddenLimits) {
    const value = override?.limits?.[key];
    if (value !== undefined) limits[key] = value;
  }
  const removed = new Set(override?.features?.remove ?? []);
  const featureSet = [
    ...new Set([
      ...definition.features,
      ...(override?.features?.add ?? []).filter(isFeature),
    ]),
  ].filter((feature) => !removed.has(feature));
  return {
    plan,
    ...definition,
    limits,
    features: featureSet,
    period: best ? billingPeriod(best, now) : calendarMonth(now),
    ...(best
      ? {
          subscription: {
            id: best.polarSubscriptionId,
            status: best.status,
            cancelAtPeriodEnd: best.cancelAtPeriodEnd,
            currentPeriodEnd: best.currentPeriodEnd,
          },
        }
      : {}),
    sources: {
      plan: comp ? "comp" : best ? "subscription" : "free",
      overriddenLimits,
      ...(override?.expiresAt ? { overrideExpiresAt: override.expiresAt } : {}),
    },
  };
}

/** Pass the workspace document when the caller has it; a bare id costs one
 * extra read for the override, so no caller can silently skip it. */
export async function loadEntitlements(
  db: Db,
  workspace: EntitlementSubject | ObjectId,
  now = new Date(),
) {
  const subject =
    workspace instanceof ObjectId
      ? await collection(db, "workspaces").findOne(
          { _id: workspace },
          { projection: { _id: 1, entitlementOverride: 1 } },
        )
      : workspace;
  const workspaceId = workspace instanceof ObjectId ? workspace : workspace._id;
  const subscriptions = await collection(db, "subscriptions")
    .find({ workspaceId, status: { $in: [...paidStatuses] } })
    .toArray();
  return resolveEntitlements(subscriptions, now, subject?.entitlementOverride);
}

export const hasFeature = (
  entitlements: Pick<Entitlements, "features">,
  feature: Feature,
) => entitlements.features.includes(feature);
