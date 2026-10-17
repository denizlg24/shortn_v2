import { expect, test } from "bun:test";
import { clientIp } from "./client-ip";
const secret = "secure-edge-proof-for-client-address";
const request = (auth?: string, ip?: string) =>
  new Request("https://api.shortn.at/v1/workspace", {
    headers: {
      ...(auth ? { "x-shortn-api-auth": auth } : {}),
      ...(ip ? { "x-shortn-client-ip": ip } : {}),
    },
  });
test("direct deployments ignore forwarded addresses", () => {
  expect(clientIp(request(secret, "203.0.113.1"), "127.0.0.1", undefined)).toBe(
    "127.0.0.1",
  );
});
test("proxied deployments accept only authenticated valid addresses", () => {
  for (const ip of ["203.0.113.1", "2001:db8::1"])
    expect(clientIp(request(secret, ip), "10.0.0.1", secret)).toBe(ip);
  for (const auth of [undefined, "wrong", "x".repeat(secret.length)])
    expect(
      clientIp(request(auth, "203.0.113.1"), "10.0.0.1", secret),
    ).toBeUndefined();
  for (const ip of [
    undefined,
    "127.0.0.1, 203.0.113.1",
    "bad",
    "203.0.113.1/32",
  ])
    expect(clientIp(request(secret, ip), "10.0.0.1", secret)).toBeUndefined();
});
