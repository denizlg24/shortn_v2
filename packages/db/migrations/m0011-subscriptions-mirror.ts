import type { AnyBulkWriteOperation, Document } from "mongodb";
import { z } from "zod";
import { names, report, workspaceMaps } from "./helpers";
import type { Migration } from "./runner";

const createdBy = "migration:0011-subscriptions-mirror";
const paidStatuses = new Set(["active", "trialing", "past_due"]);

const subscription = z.object({
  id: z.string(),
  status: z.string(),
  current_period_start: z.coerce.date(),
  current_period_end: z.coerce.date().nullable(),
  cancel_at_period_end: z.boolean(),
  customer_id: z.string(),
  product_id: z.string(),
  product: z.object({ name: z.string() }),
  customer: z.object({ external_id: z.string().nullable() }),
});
const page = z.object({
  items: z.array(subscription),
  pagination: z.object({ max_page: z.number() }),
});
type PolarSubscription = z.infer<typeof subscription>;

// Same rule as legacy polarActions.ts: product name words decide the plan.
export function planFromProductName(name: string) {
  const words = name.toLowerCase().split(" ");
  if (words.includes("basic")) return "basic" as const;
  if (words.includes("plus")) return "plus" as const;
  if (words.includes("pro")) return "pro" as const;
  if (words.includes("enterprise")) return "enterprise" as const;
  return undefined;
}

// Read-only against Polar during P3: writing would fire the legacy hooks
// (02 M11), so the mirror is built locally.
async function fetchSubscriptions(): Promise<PolarSubscription[]> {
  const token = process.env.POLAR_ACCESS_TOKEN;
  if (!token) throw new Error("POLAR_ACCESS_TOKEN is required for 0011");
  const base =
    process.env.POLAR_API_URL ??
    (process.env.POLAR_ENVIRONMENT === "sandbox"
      ? "https://sandbox-api.polar.sh"
      : "https://api.polar.sh");
  const all: PolarSubscription[] = [];
  for (let current = 1, max = 1; current <= max; current++) {
    const response = await fetch(
      `${base}/v1/subscriptions/?limit=100&page=${current}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );
    if (!response.ok)
      throw new Error(
        `Polar subscriptions ${response.status}: ${await response.text()}`,
      );
    const parsed = page.parse(await response.json());
    all.push(...parsed.items);
    max = parsed.pagination.max_page;
  }
  return all;
}

const statusOf = (status: string) =>
  (
    [
      "active",
      "trialing",
      "past_due",
      "canceled",
      "unpaid",
      "incomplete",
      "incomplete_expired",
    ] as const
  ).find((known) => known === status) ?? "canceled";

export const subscriptionsMirror: Migration = {
  id: "0011-subscriptions-mirror",
  phase: "backfill",
  async up(ctx) {
    const subscriptions = (await fetchSubscriptions()).filter((item) =>
      paidStatuses.has(item.status),
    );
    const unmapped = subscriptions.filter(
      (item) => !planFromProductName(item.product.name),
    );
    if (unmapped.length)
      throw new Error(
        `Unmapped Polar products block 0011: ${[...new Set(unmapped.map((item) => `${item.product_id} (${item.product.name})`))].join(", ")}`,
      );
    const byUser = new Map<string, PolarSubscription>();
    for (const item of subscriptions) {
      const userId = item.customer.external_id;
      // Legacy prefers active/trialing over past_due for the same customer.
      if (userId && (!byUser.has(userId) || item.status !== "past_due"))
        byUser.set(userId, item);
    }
    const maps = await workspaceMaps(ctx);
    const now = new Date();
    await ctx.batch({
      name: names.user,
      target: names.subscriptions,
      checkpointId: "user__subscriptions",
      operations: (users) =>
        users.flatMap((user): AnyBulkWriteOperation<Document>[] => {
          const item = byUser.get(String(user._id));
          const workspaceId = maps.byUserId.get(String(user._id));
          const plan = item && planFromProductName(item.product.name);
          if (!item || !workspaceId || !plan) return [];
          return [
            {
              updateOne: {
                filter: { polarSubscriptionId: item.id },
                update: {
                  $set: {
                    workspaceId,
                    polarCustomerId: item.customer_id,
                    productId: item.product_id,
                    status: statusOf(item.status),
                    plan,
                    currentPeriodStart: item.current_period_start,
                    currentPeriodEnd:
                      item.current_period_end ?? item.current_period_start,
                    cancelAtPeriodEnd: item.cancel_at_period_end,
                    updatedAt: now,
                  },
                  $setOnInsert: {
                    polarSubscriptionId: item.id,
                    createdAt: now,
                    createdBy,
                  },
                },
                upsert: true,
              },
            },
          ];
        }),
    });
    await ctx.batch({
      name: names.user,
      target: names.workspaces,
      checkpointId: "user__workspace_plans",
      operations: (users) =>
        users.flatMap((user): AnyBulkWriteOperation<Document>[] => {
          const workspaceId = maps.byUserId.get(String(user._id));
          if (!workspaceId) return [];
          const item = byUser.get(String(user._id));
          const plan =
            (item && planFromProductName(item.product.name)) ?? "free";
          return [
            {
              updateOne: {
                filter: { _id: workspaceId },
                update: { $set: { plan } },
              },
            },
          ];
        }),
    });
  },
  async verify(ctx) {
    const maps = await workspaceMaps(ctx);
    const workspaces = await ctx
      .read(names.workspaces)
      .find({ personal: true }, { projection: { ownerUserId: 1, plan: 1 } })
      .toArray();
    const mirror = (await ctx.exists(names.subscriptions))
      ? await ctx
          .read(names.subscriptions)
          .find({ status: { $in: [...paidStatuses] } })
          .toArray()
      : [];
    if (ctx.direction === "down")
      return report(
        { mirrored: mirror.length },
        mirror.length ? ["mirror rows remain"] : [],
      );
    const polar = (await fetchSubscriptions()).filter((item) =>
      paidStatuses.has(item.status),
    );
    const discrepancies: string[] = [];
    const workspaceByUser = new Map(
      workspaces.map((ws) => [String(ws.ownerUserId), ws]),
    );
    const paidUsers = new Set<string>();
    const knownUsers = new Set(
      (
        await ctx
          .read(names.user)
          .find({}, { projection: { _id: 1 } })
          .toArray()
      ).map((user) => String(user._id)),
    );
    // A Polar customer whose user no longer exists here (deleted account, or a
    // sandbox customer from another database) is reported, not mapped.
    const unknown = polar.filter(
      (item) =>
        item.customer.external_id && !knownUsers.has(item.customer.external_id),
    );
    for (const item of polar) {
      if (unknown.includes(item)) continue;
      const userId = item.customer.external_id;
      if (!userId) {
        discrepancies.push(
          `Polar subscription ${item.id} has no external customer id`,
        );
        continue;
      }
      paidUsers.add(userId);
      const workspace = workspaceByUser.get(userId);
      if (!workspace) {
        discrepancies.push(
          `Polar subscription ${item.id} matches no workspace`,
        );
        continue;
      }
      if (workspace.plan !== planFromProductName(item.product.name))
        discrepancies.push(
          `workspace of ${userId} has plan ${String(workspace.plan)}, Polar says ${item.product.name}`,
        );
    }
    for (const workspace of workspaces)
      if (
        workspace.plan !== "free" &&
        !paidUsers.has(String(workspace.ownerUserId))
      )
        discrepancies.push(
          `workspace ${String(workspace._id)} is ${String(workspace.plan)} without a Polar subscription`,
        );
    return report(
      {
        polarPaid: polar.length,
        mirrored: mirror.length,
        personalWorkspaces: maps.byUserId.size,
        unknownCustomers: unknown.length,
      },
      discrepancies,
      unknown.map((item) => ({
        subscription: item.id,
        externalId: item.customer.external_id,
      })),
    );
  },
  async down(ctx) {
    if (await ctx.exists(names.subscriptions))
      await ctx.batch({
        name: names.subscriptions,
        filter: { createdBy },
        operations: (docs) =>
          docs.map((doc) => ({ deleteOne: { filter: { _id: doc._id } } })),
      });
    if (await ctx.exists(names.workspaces))
      await ctx.batch({
        name: names.workspaces,
        checkpointId: "workspaces__plan_reset",
        filter: { personal: true, plan: { $ne: "free" } },
        operations: (docs) =>
          docs.map((doc) => ({
            updateOne: {
              filter: { _id: doc._id },
              update: { $set: { plan: "free" } },
            },
          })),
      });
  },
};
