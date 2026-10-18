import { expect, test } from "bun:test";
import { Polar } from "@polar-sh/sdk";
import { HTTPClient } from "@polar-sh/sdk/lib/http.js";
import { paymentHistory } from "./payments";
import { orderFixture } from "./test-fixtures/order";

test("empty workspace history never sends an unfiltered Polar request", async () => {
  const polar = new Polar({
    httpClient: new HTTPClient({
      fetcher: async () => {
        throw new Error("Unexpected request");
      },
    }),
  });
  expect(await paymentHistory(polar, "owner", [])).toEqual({
    items: [],
    pages: 0,
  });
});

test("SDK scopes history by owner and workspace subscriptions, paginates and preserves currency/refunds", async () => {
  let requested: URL | undefined;
  const polar = new Polar({
    httpClient: new HTTPClient({
      fetcher: async (input) => {
        requested = new URL(
          input instanceof Request ? input.url : String(input),
        );
        return Response.json({
          items: [
            orderFixture("sub-a", "customer", "owner"),
            orderFixture("other-workspace", "customer", "owner"),
          ],
          pagination: { total_count: 21, max_page: 2 },
        });
      },
    }),
  });
  const result = await paymentHistory(polar, "owner", ["sub-a", "sub-old"], 2);
  expect(requested?.searchParams.get("external_customer_id")).toBe("owner");
  expect(requested?.searchParams.getAll("subscription_id")).toEqual([
    "sub-a",
    "sub-old",
  ]);
  expect(requested?.searchParams.get("page")).toBe("2");
  expect(requested?.searchParams.get("limit")).toBe("20");
  expect(result.pages).toBe(2);
  expect(result.items).toHaveLength(1);
  expect(result.items[0]).toMatchObject({
    total: 1230,
    refunded: 123,
    currency: "eur",
    hasInvoice: true,
  });
});

test("provider failure is propagated instead of appearing as empty history", async () => {
  const polar = new Polar({
    httpClient: new HTTPClient({
      fetcher: async () =>
        Response.json({ detail: "Unavailable" }, { status: 401 }),
    }),
  });
  await expect(paymentHistory(polar, "owner", ["sub"])).rejects.toThrow();
});
