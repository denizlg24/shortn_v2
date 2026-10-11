import type { Polar } from "@polar-sh/sdk";

// Never send an empty subscription filter: Polar would return every order.
export async function paymentHistory(
  polar: Polar,
  externalCustomerId: string,
  subscriptionIds: string[],
  page = 1,
) {
  if (!subscriptionIds.length) return { items: [], pages: 0 };
  const response = await polar.orders.list({
    externalCustomerId,
    subscriptionId: subscriptionIds,
    page,
    limit: 20,
    sorting: ["-created_at"],
  });
  return {
    items: response.result.items
      .filter(
        (order) =>
          order.subscriptionId &&
          subscriptionIds.includes(order.subscriptionId),
      )
      .map((order) => ({
        id: order.id,
        date: order.createdAt.toISOString(),
        number: order.invoiceNumber,
        description: order.product?.name ?? order.description,
        status: order.status,
        total: order.totalAmount,
        refunded: order.refundedAmount + order.refundedTaxAmount,
        currency: order.currency,
        hasInvoice: order.isInvoiceGenerated,
      })),
    pages: response.result.pagination.maxPage,
  };
}
