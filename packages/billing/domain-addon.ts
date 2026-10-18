import { physicalNames } from "@shortn/db";
import type { Db, ObjectId } from "mongodb";
import type { Polar } from "@polar-sh/sdk";
import type { SubscriptionLike } from "./polar";
export async function mirrorDomainAddon(
  db: Db,
  sub: SubscriptionLike,
  workspaceId: ObjectId,
) {
  if (sub.product.metadata.shortn_addon !== "custom_domains") return false;
  const modifiedAt = sub.modifiedAt ?? sub.createdAt;
  try {
    await db
      .collection(physicalNames.domain_addons)
      .updateOne(
        {
          polarSubscriptionId: sub.id,
          $or: [
            { modifiedAt: { $lte: modifiedAt } },
            { modifiedAt: { $exists: false } },
          ],
        },
        {
          $set: {
            workspaceId,
            polarSubscriptionId: sub.id,
            polarCustomerId: sub.customerId,
            productId: sub.productId,
            status: sub.status,
            modifiedAt,
            currentPeriodEnd: sub.currentPeriodEnd,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          },
        },
        { upsert: true },
      );
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === 11000))
      throw error;
  }
  return true;
}
export async function domainAddonCheckout(
  polar: Polar,
  input: {
    productId: string;
    workspaceId: ObjectId;
    customerExternalId: string;
    email: string;
    returnUrl: string;
  },
) {
  const checkout = await polar.checkouts.create({
    products: [input.productId],
    externalCustomerId: input.customerExternalId,
    customerEmail: input.email,
    successUrl: `${input.returnUrl}?checkout={CHECKOUT_ID}`,
    returnUrl: input.returnUrl,
    metadata: { workspaceId: String(input.workspaceId) },
  });
  return checkout.url;
}
