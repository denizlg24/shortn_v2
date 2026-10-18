import type { Order } from "@polar-sh/sdk/models/components/order.js";
import { collection, physicalNames } from "@shortn/db";
import { ObjectId, type Db } from "mongodb";

/** Who gets a workspace's billing mail, and where its billing page lives. */
export interface BillingRecipient {
  to: string;
  workspace: string;
  url: string;
}

export interface BillingRecipients {
  forWorkspace(workspaceId: ObjectId): Promise<BillingRecipient | null>;
  forOrder(order: Order): Promise<BillingRecipient | null>;
}

const objectIdIn = (metadata: Record<string, unknown> | undefined) => {
  const value = metadata?.workspaceId;
  return typeof value === "string" && ObjectId.isValid(value)
    ? new ObjectId(value)
    : undefined;
};

// Billing mail goes to the workspace owner, as the legacy Polar hooks did.
export function billingRecipients(db: Db, appUrl: string): BillingRecipients {
  async function forWorkspace(workspaceId: ObjectId) {
    const workspace = await collection(db, "workspaces").findOne({
      _id: workspaceId,
    });
    if (!workspace || !ObjectId.isValid(workspace.ownerUserId)) return null;
    const owner = await db
      .collection(physicalNames.user)
      .findOne(
        { _id: new ObjectId(workspace.ownerUserId) },
        { projection: { email: 1 } },
      );
    if (typeof owner?.email !== "string") return null;
    return {
      to: owner.email,
      workspace: workspace.name,
      url: `${appUrl.replace(/\/$/, "")}/${encodeURIComponent(workspace.slug)}/settings/billing`,
    };
  }

  // The mirrors are written before the event's order is mailed, so they
  // answer for subscription orders; checkout metadata and the customer's
  // personal workspace cover the rest.
  async function workspaceOf(order: Order) {
    if (order.subscriptionId) {
      const mirror =
        (await collection(db, "subscriptions").findOne({
          polarSubscriptionId: order.subscriptionId,
        })) ??
        (await collection(db, "domain_addons").findOne({
          polarSubscriptionId: order.subscriptionId,
        }));
      if (mirror) return mirror.workspaceId;
    }
    for (const candidate of [
      objectIdIn(order.metadata),
      objectIdIn(order.subscription?.metadata),
    ])
      if (
        candidate &&
        (await collection(db, "workspaces").countDocuments(
          { _id: candidate },
          { limit: 1 },
        ))
      )
        return candidate;
    const externalId = order.customer.externalId;
    if (!externalId) return undefined;
    const personal = await collection(db, "workspaces").findOne({
      ownerUserId: externalId,
      personal: true,
    });
    return personal?._id;
  }

  return {
    forWorkspace,
    async forOrder(order) {
      const workspaceId = await workspaceOf(order);
      return workspaceId ? forWorkspace(workspaceId) : null;
    },
  };
}
