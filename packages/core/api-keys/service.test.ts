import { describe, expect, test } from "bun:test";
import {
  apiKeyIpAllowed,
  createApiKeyInput,
  hashApiKey,
  hasApiScope,
} from "./service";

test("API key hashes depend on the pepper and reject missing configuration", () => {
  const pepper = "a".repeat(32);
  expect(hashApiKey("secret", pepper)).toMatch(/^[a-f0-9]{64}$/);
  expect(hashApiKey("secret", pepper)).not.toBe(
    hashApiKey("secret", "b".repeat(32)),
  );
  expect(() => hashApiKey("secret", "")).toThrow("API_KEY_PEPPER");
});

test("scopes allow only their resource and operation", () => {
  const principal = { scopes: ["links:read", "qr:*"] };
  expect(hasApiScope(principal, "links:read")).toBe(true);
  expect(hasApiScope(principal, "links:write")).toBe(false);
  expect(hasApiScope(principal, "qr:write")).toBe(true);
  expect(hasApiScope(principal, "bio:read")).toBe(false);
  expect(
    createApiKeyInput.safeParse({ name: "test", scopes: ["*"] }).success,
  ).toBe(false);
});

describe("IP restrictions", () => {
  test("exact IPs and IPv4/IPv6 subnets", () => {
    expect(apiKeyIpAllowed(["192.0.2.0/24"], "192.0.2.123")).toBe(true);
    expect(apiKeyIpAllowed(["192.0.2.0/24"], "192.0.3.1")).toBe(false);
    expect(apiKeyIpAllowed(["2001:db8::/32"], "2001:db8::1")).toBe(true);
    expect(apiKeyIpAllowed(["2001:db8::1"], "2001:db8::2")).toBe(false);
    expect(apiKeyIpAllowed(["192.0.2.1"], "::ffff:192.0.2.1")).toBe(true);
  });
  test("restricted keys fail closed on missing or malformed addresses", () => {
    expect(apiKeyIpAllowed(["192.0.2.1"], undefined)).toBe(false);
    expect(apiKeyIpAllowed(["192.0.2.1"], "spoofed")).toBe(false);
    expect(apiKeyIpAllowed(["invalid"], "192.0.2.1")).toBe(false);
    expect(apiKeyIpAllowed([], undefined)).toBe(true);
    for (const cidr of ["192.0.2.1/33", "::1/129", "::1/-1", "::1/", "::1/2/3"])
      expect(
        createApiKeyInput.safeParse({
          name: "test",
          scopes: ["links:read"],
          ipAllowlist: [cidr],
        }).success,
      ).toBe(false);
  });
});
