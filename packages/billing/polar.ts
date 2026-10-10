import { Polar } from "@polar-sh/sdk";
import type { Subscription as PolarSubscription } from "@polar-sh/sdk/models/components/subscription.js";
import { collection, type Documents } from "@shortn/db";
import { ObjectId, type Db } from "mongodb";
import {
  planForProduct,
  planRank,
  products,
  type PlanId,
  type PolarServer,
} from "./catalog";
import { paidStatuses } from "./entitlements";

type Mirror = Documents["subscriptions"];

// The subscription fields the mirror reads; Polar's Subscription satisfies it.
export type SubscriptionLike = Pick<
  PolarSubscription,
  | "id"
  | "status"
  | "metadata"
  | "customerId"
  | "productId"
  | "currentPeriodStart"
  | "currentPeriodEnd"
  | "cancelAtPeriodEnd"
  | "createdAt"
  | "modifiedAt"
  | "endsAt"
> & {
  customer: Pick<PolarSubscription["customer"], "externalId">;
  product: Pick<PolarSubscription["product"], "metadata" | "name">;
  pendingUpdate: Pick<
    NonNullable<PolarSubscription["pendingUpdate"]>,
    "productId" | "appliesAt"
  > | null;
};

export interface PolarConfig {
  accessToken: string;
  server: PolarServer;
}

export const createPolar = (config: PolarConfig) =>
  new Polar({ accessToken: config.accessToken, server: config.server });

const statuses: readonly Mirror["status"][] = [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
];
const mirrorStatus = (status: string): Mirror["status"] =>
  statuses.find((known) => known === status) ?? "canceled";

const metadataString = (metadata: Record<string, unknown>, key: string) => {
  const value = metadata[key];
  return typeof value === "string" ? value : undefined;
};

// metadata.workspaceId decides which workspace a subscription funds; older
// subscriptions predate it and belong to the customer's personal workspace.
export async function workspaceForSubscription(db: Db, sub: SubscriptionLike) {
  const fromMetadata = metadataString(sub.metadata, "workspaceId");
  if (fromMetadata && ObjectId.isValid(fromMetadata)) {
    const workspace = await collection(db, "workspaces").findOne({
      _id: new ObjectId(fromMetadata),
    });
    if (workspace) return workspace._id;
  }
  const externalId = sub.customer.externalId;
  if (!externalId) return undefined;
  const personal = await collection(db, "workspaces").findOne({
    ownerUserId: externalId,
    personal: true,
  });
  return personal?._id;
}

export function toMirror(
  sub: SubscriptionLike,
  server: PolarServer,
  workspaceId: ObjectId,
): Omit<Mirror, "_id"> | undefined {
  const plan = planForProduct(server, sub.productId, sub.product.metadata);
  if (!plan) return undefined;
  const pending = sub.pendingUpdate;
  const pendingPlan = pending?.productId
    ? planForProduct(server, pending.productId)
    : undefined;
  return {
    workspaceId,
    polarSubscriptionId: sub.id,
    polarCustomerId: sub.customerId,
    productId: sub.productId,
    status: mirrorStatus(sub.status),
    plan,
    currentPeriodStart: sub.currentPeriodStart,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    modifiedAt: sub.modifiedAt ?? sub.createdAt,
    ...(sub.endsAt ? { endsAt: sub.endsAt } : {}),
    ...(pending?.productId
      ? {
          scheduledChange: {
            productId: pending.productId,
            ...(pendingPlan ? { plan: pendingPlan } : {}),
            at: pending.appliesAt,
          },
        }
      : {}),
  };
}

export type ApplyOutcome =
  | { status: "applied"; before: Mirror | null; after: Mirror }
  | { status: "stale" | "unmapped_product" | "no_workspace" };

// Refetch-and-upsert (06 §Webhook 4): the payload only says *which*
// subscription changed; Polar's current state is applied if it's newer than
// the mirror, so duplicates and out-of-order deliveries converge.
export async function applySubscription(
  db: Db,
  polar: Polar,
  server: PolarServer,
  subscriptionId: string,
): Promise<ApplyOutcome> {
  const sub = await polar.subscriptions.get({ id: subscriptionId });
  return applyFetched(db, server, sub);
}

export async function applyFetched(
  db: Db,
  server: PolarServer,
  sub: SubscriptionLike,
): Promise<ApplyOutcome> {
  const mirrors = collection(db, "subscriptions");
  const before = await mirrors.findOne({ polarSubscriptionId: sub.id });
  const workspaceId =
    before?.workspaceId ?? (await workspaceForSubscription(db, sub));
  if (!workspaceId) return { status: "no_workspace" };
  const next = toMirror(sub, server, workspaceId);
  if (!next) return { status: "unmapped_product" };
  if (
    before?.modifiedAt &&
    next.modifiedAt &&
    before.modifiedAt > next.modifiedAt
  )
    return { status: "stale" };
  const now = new Date();
  const $unset: Record<string, ""> = {};
  if (!next.scheduledChange) $unset.scheduledChange = "";
  if (!next.endsAt) $unset.endsAt = "";
  const after = await mirrors.findOneAndUpdate(
    { polarSubscriptionId: sub.id },
    {
      $set: { ...next, updatedAt: now },
      $setOnInsert: { createdAt: now },
      ...(Object.keys($unset).length ? { $unset } : {}),
    },
    { upsert: true, returnDocument: "after" },
  );
  if (!after) throw new Error("Mirror upsert returned nothing");
  await collection(db, "workspaces").updateOne(
    { _id: workspaceId },
    { $set: { plan: await currentPlan(db, workspaceId), updatedAt: now } },
  );
  return { status: "applied", before, after };
}

async function currentPlan(db: Db, workspaceId: ObjectId): Promise<PlanId> {
  const paid = await collection(db, "subscriptions")
    .find({ workspaceId, status: { $in: [...paidStatuses] } })
    .toArray();
  return paid.reduce<PlanId>(
    (best, sub) => (planRank[sub.plan] > planRank[best] ? sub.plan : best),
    "free",
  );
}

export async function* allSubscriptions(polar: Polar) {
  const pages = await polar.subscriptions.list({ limit: 100 });
  for await (const page of pages) yield* page.result.items;
}

export interface ReconcileReport {
  checked: number;
  changed: number;
  unmapped: string[];
  orphaned: string[];
}

// Nightly drift repair (06 §Webhook 5): Polar wins; every correction is
// counted so a non-zero `changed` after the switch is an alert.
export async function reconcile(
  db: Db,
  polar: Polar,
  server: PolarServer,
): Promise<ReconcileReport> {
  const report: ReconcileReport = {
    checked: 0,
    changed: 0,
    unmapped: [],
    orphaned: [],
  };
  const managed = new Set<string>([
    ...Object.values(products[server].checkout),
    ...Object.keys(products[server].legacy),
  ]);
  for await (const sub of allSubscriptions(polar)) {
    if (
      !managed.has(sub.productId) &&
      !metadataString(sub.product.metadata, "shortn_plan")
    )
      continue;
    report.checked++;
    const outcome = await applyFetched(db, server, sub);
    if (outcome.status === "unmapped_product")
      report.unmapped.push(sub.productId);
    else if (outcome.status === "no_workspace") report.orphaned.push(sub.id);
    else if (
      outcome.status === "applied" &&
      mirrorDiffers(outcome.before, outcome.after)
    )
      report.changed++;
  }
  return report;
}

const comparable = (mirror: Mirror | null) =>
  mirror && {
    workspaceId: mirror.workspaceId.toHexString(),
    productId: mirror.productId,
    status: mirror.status,
    plan: mirror.plan,
    end: mirror.currentPeriodEnd.getTime(),
    cancel: mirror.cancelAtPeriodEnd,
    scheduled: mirror.scheduledChange?.productId ?? null,
  };

export const mirrorDiffers = (before: Mirror | null, after: Mirror) =>
  JSON.stringify(comparable(before)) !== JSON.stringify(comparable(after));

export interface CheckoutInput {
  plan: "basic" | "plus" | "pro";
  workspaceId: ObjectId;
  customerExternalId: string;
  customerEmail: string;
  successUrl: string;
  returnUrl: string;
}

export async function checkoutUrl(
  polar: Polar,
  server: PolarServer,
  input: CheckoutInput,
) {
  const checkout = await polar.checkouts.create({
    products: [products[server].checkout[input.plan]],
    externalCustomerId: input.customerExternalId,
    customerEmail: input.customerEmail,
    successUrl: input.successUrl,
    returnUrl: input.returnUrl,
    metadata: { workspaceId: input.workspaceId.toHexString() },
  });
  return checkout.url;
}

export async function portalUrl(
  polar: Polar,
  customerExternalId: string,
  returnUrl: string,
) {
  const session = await polar.customerSessions.create({
    externalCustomerId: customerExternalId,
    returnUrl,
  });
  return session.customerPortalUrl;
}

export type ChangeError = "not_found" | "same_plan" | "custom_priced";

// 06 principle 4: upgrades apply now (prorated invoice); downgrades are
// queued by Polar for the next period. A subscription set to cancel is
// uncanceled first, because Polar rejects plan changes on it.
export async function changePlan(
  polar: Polar,
  server: PolarServer,
  mirror: Mirror,
  target: "basic" | "plus" | "pro",
): Promise<
  { ok: true; when: "now" | "next_period" } | { ok: false; error: ChangeError }
> {
  if (mirror.plan === target) return { ok: false, error: "same_plan" };
  if (mirror.plan === "enterprise")
    return { ok: false, error: "custom_priced" };
  if (mirror.cancelAtPeriodEnd)
    await polar.subscriptions.update({
      id: mirror.polarSubscriptionId,
      subscriptionUpdate: { cancelAtPeriodEnd: false },
    });
  const upgrade = planRank[target] > planRank[mirror.plan];
  await polar.subscriptions.update({
    id: mirror.polarSubscriptionId,
    subscriptionUpdate: {
      productId: products[server].checkout[target],
      prorationBehavior: upgrade ? "invoice" : "next_period",
    },
  });
  return { ok: true, when: upgrade ? "now" : "next_period" };
}

export async function setCancelAtPeriodEnd(
  polar: Polar,
  mirror: Mirror,
  cancel: boolean,
) {
  await polar.subscriptions.update({
    id: mirror.polarSubscriptionId,
    subscriptionUpdate: { cancelAtPeriodEnd: cancel },
  });
}
