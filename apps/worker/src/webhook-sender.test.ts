import { expect, test } from "bun:test";
import {
  publicWebhookAddress,
  resolveWebhookTarget,
  sendWebhook,
} from "./webhook-sender";
import { sealWebhookSecret, openWebhookSecret } from "@shortn/core";
test("webhook destinations exclude special IPv4/IPv6 ranges and pin a DNS result", async () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "192.168.1.1",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "2001:db8::1",
    "fe80::1%eth0",
    "invalid",
  ])
    expect(publicWebhookAddress(ip)).toBe(false);
  for (const ip of ["8.8.8.8", "2606:4700:4700::1111"])
    expect(publicWebhookAddress(ip)).toBe(true);
  await expect(
    resolveWebhookTarget("https://receiver.example", async () => [
      { address: "8.8.8.8", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]),
  ).rejects.toThrow("destination_rejected");
  await expect(
    resolveWebhookTarget("http://receiver.example", async () => []),
  ).rejects.toThrow("destination_rejected");
  const target = await resolveWebhookTarget(
    "https://receiver.example/hook",
    async () => [{ address: "8.8.8.8", family: 4 }],
  );
  expect(target.address.address).toBe("8.8.8.8");
  expect(target.url.hostname).toBe("receiver.example");
});
test("webhook secret encryption is randomized and authenticated", () => {
  const key = "distinct-webhook-encryption-secret".repeat(2),
    secret = "whsec_private-fixture";
  const a = sealWebhookSecret(secret, key),
    b = sealWebhookSecret(secret, key);
  expect(a).not.toBe(b);
  expect(a).not.toContain(secret);
  expect(openWebhookSecret(a, key)).toBe(secret);
  expect(() =>
    openWebhookSecret(a, "wrong-encryption-secret".repeat(3)),
  ).toThrow();
  expect(() => sealWebhookSecret(secret, "short")).toThrow();
});

test("the actual sender refuses local targets before opening HTTP connections", async () => {
  for (const url of [
    "https://127.0.0.1",
    "https://2130706433",
    "https://[::1]",
    "https://169.254.169.254",
  ])
    await expect(sendWebhook(url, "{}", {})).rejects.toThrow(
      "destination_rejected",
    );
});
