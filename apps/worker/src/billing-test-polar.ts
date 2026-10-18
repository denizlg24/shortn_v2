// Test support: a real Polar SDK client whose HTTP layer serves fixture
// orders and payments, so the SDK's own response parsing is exercised.
import { Polar } from "@polar-sh/sdk";
import { HTTPClient } from "@polar-sh/sdk/lib/http.js";
import type {
  cardPaymentFixture,
  OrderJson,
} from "../../../packages/billing/test-fixtures/receipts";

export interface PolarState {
  orders: OrderJson[];
  payments: ReturnType<typeof cardPaymentFixture>[];
  down?: boolean;
}

export function polarServing(state: PolarState) {
  const requests: URL[] = [];
  const list = <T>(items: T[]) =>
    Response.json({
      items,
      pagination: { total_count: items.length, max_page: 1 },
    });
  const polar = new Polar({
    httpClient: new HTTPClient({
      fetcher: async (input) => {
        const url = new URL(
          input instanceof Request ? input.url : String(input),
        );
        requests.push(url);
        if (state.down)
          return Response.json({ detail: "Unavailable" }, { status: 503 });
        if (url.pathname === "/v1/payments/")
          return list(
            state.payments.filter(
              (payment) =>
                payment.order_id === url.searchParams.get("order_id"),
            ),
          );
        if (url.pathname === "/v1/orders/")
          return list(
            state.orders.filter(
              (order) =>
                order.subscription_id ===
                url.searchParams.get("subscription_id"),
            ),
          );
        const id = /^\/v1\/orders\/([^/]+)$/.exec(url.pathname)?.[1];
        const order = state.orders.find((candidate) => candidate.id === id);
        return order
          ? Response.json(order)
          : Response.json({ detail: "Not found" }, { status: 404 });
      },
    }),
  });
  return { polar, requests };
}
