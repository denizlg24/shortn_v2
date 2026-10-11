import { buttonVariants } from "@shortn/ui";
import { getFormatter, getTranslations } from "next-intl/server";
import { PaymentRetry } from "./payment-retry";
import { Notice } from "@/components/page/notice";
import { Pagination } from "@/components/page/pagination";
import { paymentHistoryAction } from "@/server/actions/billing";
import { invoicePageAction } from "@/server/actions/settings-pages";
import { billingFormat } from "@/server/billing-format";

export async function PaymentHistory({
  workspace,
  page,
}: {
  workspace: string;
  page: number;
}) {
  const [result, t, format, f] = await Promise.all([
    paymentHistoryAction(workspace, page),
    getTranslations("billing"),
    getFormatter(),
    billingFormat(),
  ]);
  if (!result.ok)
    return (
      <Notice tone="warning">
        {t("invoices.unavailable")} <PaymentRetry />
      </Notice>
    );
  const money = (amount: number, currency: string) =>
    format.number(amount / 100, {
      style: "currency",
      currency: currency.toUpperCase(),
    });
  const statuses: Record<string, string> = {
    draft: t("invoices.statuses.draft"),
    pending: t("invoices.statuses.pending"),
    paid: t("invoices.statuses.paid"),
    refunded: t("invoices.statuses.refunded"),
    partially_refunded: t("invoices.statuses.partiallyRefunded"),
    void: t("invoices.statuses.void"),
  };
  return (
    <div className="flex flex-col gap-4">
      {result.data.items.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-small">
            <caption className="sr-only">{t("invoices.title")}</caption>
            <thead className="border-b border-line text-fg-muted">
              <tr>
                {[
                  t("invoices.date"),
                  t("invoices.invoice"),
                  t("invoices.status"),
                  t("invoices.amount"),
                  t("invoices.download"),
                ].map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className="px-3 py-2 font-medium first:pl-0 last:pr-0"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.data.items.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-line last:border-b-0"
                >
                  <td className="py-3 pr-3 whitespace-nowrap">
                    {f.date(order.date)}
                  </td>
                  <td className="px-3 py-3">
                    <span className="block">
                      {order.number ?? t("invoices.awaitingNumber")}
                    </span>
                    <span className="text-fg-muted">{order.description}</span>
                  </td>
                  <td className="px-3 py-3">
                    {statuses[order.status] ?? t("invoices.statuses.unknown")}
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                    {money(order.total, order.currency)}
                    {order.refunded > 0 ? (
                      <span className="block text-fg-muted">
                        {t("invoices.refundedAmount", {
                          amount: money(order.refunded, order.currency),
                        })}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 pl-3 text-right">
                    {order.hasInvoice ? (
                      <form
                        action={invoicePageAction.bind(
                          null,
                          workspace,
                          order.id,
                        )}
                      >
                        <button
                          type="submit"
                          aria-label={t("invoices.downloadInvoice", {
                            number: order.number ?? f.date(order.date),
                          })}
                          className={buttonVariants({
                            variant: "secondary",
                            size: "sm",
                          })}
                        >
                          {t("invoices.download")}
                        </button>
                      </form>
                    ) : (
                      <span className="text-fg-muted">
                        {t("invoices.notReady")}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-small text-fg-muted">{t("invoices.empty")}</p>
      )}
      <Pagination page={page} pages={result.data.pages} params={{}} />
    </div>
  );
}
