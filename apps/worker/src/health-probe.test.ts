import { pinnedLookup } from "./webhook-sender";
import { expect, test } from "bun:test";
import {
  request as httpRequest,
  type RequestOptions,
  type IncomingMessage,
} from "node:http";
import {
  healthRequest,
  probeHealth,
  resolveHealthTarget,
  HealthRequestError,
} from "./health-probe";
const reserve = async () => ({ wait: 0 });
test("health DNS rejects private/mixed/rebinding targets before requesting a socket", async () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "::1",
    "fc00::1",
    "::ffff:127.0.0.1",
    "100.64.0.1",
  ])
    await expect(
      resolveHealthTarget("https://example.com", async () => [
        { address: "8.8.8.8", family: 4 },
        { address, family: address.includes(":") ? 6 : 4 },
      ]),
    ).rejects.toThrow("destination_rejected");
  for (const value of [
    "file:///tmp/x",
    "http://127.0.0.1/x",
    "https://user:pass@example.com",
    "not-a-url",
  ])
    await expect(
      resolveHealthTarget(value, async () => {
        throw new Error("DNS must not run");
      }),
    ).rejects.toThrow("destination_rejected");
  expect(
    (
      await resolveHealthTarget(
        "http://example.com/path#fragment",
        async () => [{ address: "8.8.8.8", family: 4 }],
      )
    ).url.toString(),
  ).toBe("http://example.com/path");
});
test("health protocol uses GET after unsupported HEAD, validates redirects and bounds redirect loops", async () => {
  const calls: string[] = [];
  expect(
    await probeHealth("https://example.com/a", {
      reserve,
      request: async (url, method) => {
        calls.push(`${method} ${url}`);
        return method === "HEAD" ? { status: 405 } : { status: 503 };
      },
    }),
  ).toEqual({ status: "http_error", httpStatus: 503 });
  expect(calls).toEqual([
    "HEAD https://example.com/a",
    "GET https://example.com/a",
  ]);
  calls.length = 0;
  expect(
    await probeHealth("https://example.com", {
      reserve,
      request: async (url) => {
        calls.push(url);
        return { status: 302, location: "http://127.0.0.1/private" };
      },
    }),
  ).toEqual({ status: "blocked", error: "destination_rejected" });
  expect(calls).toHaveLength(1);
  calls.length = 0;
  expect(
    await probeHealth("https://example.com", {
      reserve,
      request: async (url) => {
        calls.push(url);
        return { status: 302, location: "/loop" };
      },
    }),
  ).toEqual({ status: "unreachable", error: "redirect_limit" });
  expect(calls).toHaveLength(4);
  expect(
    await probeHealth("https://example.com", {
      reserve,
      request: async () => {
        throw new HealthRequestError("timeout");
      },
    }),
  ).toEqual({ status: "unreachable", error: "timeout" });
});
test("pinned HTTP transport retains Host, requests only a byte range on GET, and stops at headers", async () => {
  const calls: {
    method: string | undefined;
    range: string | undefined;
    host: string | undefined;
  }[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      calls.push({
        method: request.method,
        range: request.headers.get("range") ?? undefined,
        host: request.headers.get("host") ?? undefined,
      });
      if (new URL(request.url).pathname === "/timeout")
        return Bun.sleep(100).then(() => new Response("late"));
      if (request.method === "HEAD") return new Response(null, { status: 405 });
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([120]));
          },
        }),
        { status: 200 },
      );
    },
  });
  const order: string[] = [],
    pinned: string[] = [];
  const request = ((
    url: URL,
    options: RequestOptions,
    callback: (response: IncomingMessage) => void,
  ) => {
    options.lookup!(url.hostname, { family: 4, all: false }, (error, value) => {
      if (error) throw error;
      pinned.push(String(value));
    });
    return httpRequest(
      {
        hostname: "127.0.0.1",
        port: server.port,
        path: url.pathname + url.search,
        method: options.method,
        headers: { ...options.headers, Host: url.host },
        agent: false,
      },
      callback,
    );
  }) as typeof httpRequest;
  const resolve = async () => {
    order.push("dns");
    return [{ address: "8.8.8.8", family: 4 }];
  };
  const options = {
    request,
    resolve,
    reserve: async () => {
      order.push("reserve");
      return { wait: 0 };
    },
  };
  try {
    const result = await probeHealth("http://example.com/headers", {
      reserve,
      request: (url, method, deps) =>
        healthRequest(url, method, { ...deps, ...options }),
    });
    expect(result).toEqual({ status: "ok", httpStatus: 200 });
    expect(calls.map((call) => call.method)).toEqual(["HEAD", "GET"]);
    expect(calls[1]!.range).toBe("bytes=0-0");
    expect(calls.every((call) => call.host === "example.com")).toBe(true);
    expect(pinned).toEqual(["8.8.8.8", "8.8.8.8"]);
    expect(order).toEqual(["dns", "reserve", "dns", "reserve"]);
    await expect(
      healthRequest("http://example.com/timeout", "HEAD", {
        ...options,
        timeoutMs: 40,
      }),
    ).rejects.toThrow("timeout");
    expect(
      await probeHealth("http://example.com/headers", {
        reserve: async () => ({ retryAfter: 3000 }),
        request: (url, method, deps) =>
          healthRequest(url, method, { ...deps, request, resolve }),
      }),
    ).toEqual({ retryAfter: 3000 });
    await expect(
      probeHealth("http://example.com/headers", {
        reserve: async () => {
          throw new Error("Redis unavailable");
        },
        request: (url, method, deps) =>
          healthRequest(url, method, { ...deps, request, resolve }),
      }),
    ).rejects.toThrow("rate_store_unavailable");
  } finally {
    void server.stop(true);
  }
});

test("the DNS pin works with Bun's all-address callback on a real socket", async () => {
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => new Response("fixture"),
  });
  try {
    const status = await new Promise<number>((resolve, reject) => {
      const req = httpRequest(
        new URL(`http://health-fixture.invalid:${server.port}/`),
        {
          agent: false,
          family: 4,
          lookup: pinnedLookup({ address: "127.0.0.1", family: 4 }),
        },
        (response) => {
          clearTimeout(timer);
          response.destroy();
          resolve(response.statusCode!);
        },
      );
      const timer = setTimeout(() => {
        reject(new Error("Fixture DNS pin timeout"));
        req.destroy();
      }, 1000);
      req.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      req.end();
    });
    expect(status).toBe(200);
  } finally {
    void server.stop(true);
  }
});
