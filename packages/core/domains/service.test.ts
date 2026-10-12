import { expect, test } from "bun:test";
import { cloudflareDomains, domainBackoff, normalizeDomain } from "./service";
test("domain validation rejects URLs, credentials, IPs and platform hostnames", () => {
  for (const host of [
    "https://brand.com",
    "brand.com/path",
    "user@brand.com",
    "127.0.0.1",
    "shortn.at",
    "alice.shortn.at",
    "*.brand.com",
    "-bad.brand.com",
  ])
    expect(normalizeDomain(host, "shortn.at")).toBeNull();
  expect(normalizeDomain("GO.Brand.com", "shortn.at")).toBe("go.brand.com");
  expect(normalizeDomain("bücher.example", "shortn.at")).toBe(
    "xn--bcher-kva.example",
  );
});
test("provider sends DV/HTTP validation and fails closed on provider errors", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const provider = cloudflareDomains("zone", "token", (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    calls.push({ url: String(url), ...(init ? { init } : {}) });
    return Response.json({
      success: true,
      result: {
        id: "hostname",
        status: "pending",
        ssl: { status: "pending_validation" },
      },
    });
  }) as unknown as typeof fetch);
  await provider.add("go.brand.com");
  expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
    hostname: "go.brand.com",
    ssl: { method: "http", type: "dv" },
  });
  expect(calls[0]?.url).toBe(
    "https://api.cloudflare.com/client/v4/zones/zone/custom_hostnames",
  );
  const broken = cloudflareDomains("zone", "token", (async () =>
    Response.json(
      { success: false },
      { status: 500 },
    )) as unknown as typeof fetch);
  expect(broken.get("hostname")).rejects.toThrow(
    "Cloudflare hostname request failed (500)",
  );
  expect(domainBackoff(0)).toBe(60000);
  expect(domainBackoff(20)).toBe(3600000);
});
