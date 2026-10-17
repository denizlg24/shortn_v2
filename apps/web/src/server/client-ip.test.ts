import { expect, test } from "bun:test";
import { visitorIp } from "./client-ip";

const secrets = {
  edge: "synthetic-web-edge-secret",
  bio: "synthetic-bio-secret",
};
const proxied = {
  "cf-connecting-ip": "2a06:98c0:3600::103",
  "x-shortn-client-ip": "203.0.113.7",
};

test("edge-proxied visitors are identified by the proven forwarded address", () => {
  expect(
    visitorIp(
      new Headers({ ...proxied, "x-shortn-web-auth": secrets.edge }),
      secrets,
    ),
  ).toBe("203.0.113.7");
  expect(
    visitorIp(new Headers({ ...proxied, "x-bio-auth": secrets.bio }), secrets),
  ).toBe("203.0.113.7");
});

test("forwarded addresses without a valid proof are ignored", () => {
  for (const extra of [
    {},
    { "x-shortn-web-auth": "forged" },
    { "x-bio-auth": secrets.edge },
  ])
    expect(visitorIp(new Headers({ ...proxied, ...extra }), secrets)).toBe(
      "2a06:98c0:3600::103",
    );
  expect(
    visitorIp(new Headers({ ...proxied, "x-shortn-web-auth": "" }), {}),
  ).toBe("2a06:98c0:3600::103");
  expect(
    visitorIp(
      new Headers({
        "cf-connecting-ip": "198.51.100.4",
        "x-shortn-client-ip": "not-an-ip",
        "x-shortn-web-auth": secrets.edge,
      }),
      secrets,
    ),
  ).toBe("198.51.100.4");
  expect(visitorIp(new Headers(), secrets)).toBe("unknown");
});
