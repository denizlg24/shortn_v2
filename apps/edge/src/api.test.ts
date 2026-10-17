import { expect, test } from "bun:test";
import { createHandler, type Env } from "./index";
const env: Env = {
  REDIRECT_ORIGIN: "https://redirect.shortn.at",
  CANARY_PERCENT: "100",
  API_PUBLIC_HOST: "api-staging.shortn.at",
  API_EDGE_AUTH_SECRET: "test-proof",
};
test("API forwards the edge address and overwrites forged proof without consuming streams", async () => {
  let calls = 0;
  const handler = createHandler(
    async () => {
      throw Error("redirect");
    },
    async (request) => {
      calls++;
      expect(request.url).toBe("https://api-staging.shortn.at/mcp");
      expect(request.headers.get("x-shortn-api-auth")).toBe(
        env.API_EDGE_AUTH_SECRET!,
      );
      expect(request.headers.get("x-shortn-client-ip")).toBe("2001:db8::1");
      expect(request.headers.get("authorization")).toBe("Bearer test");
      expect(await request.text()).toBe("payload");
      return new Response("data: ok\n\n", {
        headers: { "content-type": "text/event-stream" },
      });
    },
  );
  const response = await handler(
    new Request("https://api-staging.shortn.at/mcp", {
      method: "POST",
      body: "payload",
      headers: {
        "cf-connecting-ip": "2001:db8::1",
        "x-shortn-client-ip": "127.0.0.1",
        "x-shortn-api-auth": "forged",
        authorization: "Bearer test",
      },
    }),
    env,
  );
  expect(calls).toBe(1);
  expect(response.headers.get("content-type")).toBe("text/event-stream");
  expect(await response.text()).toBe("data: ok\n\n");
});
test("API fails closed when edge proof is not configured", async () => {
  const handler = createHandler(
    async () => {
      throw Error("redirect");
    },
    async () => {
      throw Error("origin");
    },
  );
  const withoutSecret = { ...env };
  delete withoutSecret.API_EDGE_AUTH_SECRET;
  expect(
    (
      await handler(
        new Request("https://api-staging.shortn.at/v1/workspace"),
        withoutSecret,
      )
    ).status,
  ).toBe(503);
});
