import { expect, test } from "bun:test";
import { ObjectId } from "mongodb";
import { SignJWT } from "jose";
import {
  boundedQuery,
  decide,
  decodeClickMessage,
  encodeClickMessage,
  encodeSecret,
  enrich,
  ipPrefix,
  localeFrom,
  parseRedirectPath,
  requestClickFields,
  toCachedLink,
} from "./index";
import type { CachedLink, DecisionInput } from "./index";

const legacySecret = "legacy-secret-legacy-secret-legacy-secret";
const secrets = { legacy: encodeSecret(legacySecret) };
const origin = "https://shortn.at";
const id = new ObjectId();

test("redirect paths match the legacy proxy's single-segment and /qr/ rules", () => {
  expect(parseRedirectPath("/abc")).toEqual({
    key: "abc",
    legacyQrPath: false,
  });
  expect(parseRedirectPath("/abc/")).toEqual({
    key: "abc",
    legacyQrPath: false,
  });
  expect(parseRedirectPath("/qr/abc")).toEqual({
    key: "abc",
    legacyQrPath: true,
  });
  expect(parseRedirectPath("/qr/pricing")).toEqual({
    key: "pricing",
    legacyQrPath: true,
  });
  for (const path of [
    "/",
    "/pricing",
    "/en",
    "/PT",
    "/Dashboard",
    "/qr",
    "/qr/",
    "/a/b",
    "/qr/a/b",
    "/logo.png",
    "/.env",
    "/qr/x.png",
    "/https:",
    "/http%3A%2F%2Fx",
    "/b",
    "/api",
    "/_next",
    "/llms.txt",
    "/%E0%A4%A",
  ])
    expect(parseRedirectPath(path)).toBeUndefined();
  expect(parseRedirectPath("/a%20b")?.key).toBe("a b");
});

test("locale falls back to en for unknown cookie values", () => {
  expect(localeFrom("pt")).toBe("pt");
  expect(localeFrom("../x")).toBe("en");
  expect(localeFrom(undefined)).toBe("en");
});

const link = (overrides: Partial<Parameters<typeof toCachedLink>[0]> = {}) =>
  toCachedLink(
    { _id: id, urlCode: "abc", longUrl: "https://example.com/x", ...overrides },
    "abc",
    null,
  );

const input = (
  cached: CachedLink,
  extra: Partial<DecisionInput> = {},
): DecisionInput => ({
  link: cached,
  key: "abc",
  origin,
  locale: "pt",
  secrets,
  ...extra,
});

test("gates follow legacy order: missing, blocked, interstitial, password, destination", async () => {
  expect(await decide(input({ kind: "missing" }))).toEqual({
    type: "redirect",
    status: 302,
    location: `${origin}/en/url-not-found`,
  });
  for (const overrides of [
    { disabled: true },
    { safetyStatus: "blocked" },
    { safetyStatus: "malicious" },
    { disabled: true, passwordProtected: true, requiresInterstitial: true },
  ])
    expect((await decide(input(link(overrides)))).location).toBe(
      `${origin}/pt/safety/abc`,
    );
  expect(
    (await decide(input(link({ safetyStatus: "suspicious" })))).location,
  ).toBe(`${origin}/pt/safety/abc`);
  const ok = await decide(input(link()));
  expect(ok).toEqual({
    type: "redirect",
    status: 302,
    location: "https://example.com/x",
    track: { linkId: id.toHexString() },
  });
  expect((await decide(input(link({ longUrl: undefined })))).location).toBe(
    `${origin}/en/url-not-found`,
  );
});

test("destinations are serialized the way legacy's NextResponse.redirect does", async () => {
  const location = async (longUrl: string) =>
    (await decide(input(link({ longUrl })))).location;
  expect(await location("https://denizlg24.com")).toBe(
    "https://denizlg24.com/",
  );
  expect(await location("https://e.com/Fiscalidade_automóvel.pdf")).toBe(
    "https://e.com/Fiscalidade_autom%C3%B3vel.pdf",
  );
  expect(await location("not a url")).toBe(`${origin}/en/url-not-found`);
});

test("interstitial accepts only a valid confirmation token for the same key", async () => {
  const token = (slug: string, purpose = "link-confirmation") =>
    new SignJWT({ slug, purpose })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("5m")
      .sign(secrets.legacy);
  const cached = link({ requiresInterstitial: true });
  expect(
    (await decide(input(cached, { confirmationToken: await token("abc") })))
      .location,
  ).toBe("https://example.com/x");
  for (const bad of [await token("other"), await token("abc", "x"), "garbage"])
    expect(
      (await decide(input(cached, { confirmationToken: bad }))).location,
    ).toBe(`${origin}/pt/safety/abc`);
});

test("password links require a valid access cookie and clear invalid ones", async () => {
  const cookie = (urlCode: string, secret: Uint8Array = secrets.legacy) =>
    new SignJWT({ urlCode })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("24h")
      .sign(secret);
  const cached = link({ passwordProtected: true });
  expect(await decide(input(cached))).toEqual({
    type: "redirect",
    status: 302,
    location: `${origin}/authenticate/abc`,
  });
  expect(
    await decide(input(cached, { accessCookie: await cookie("other") })),
  ).toEqual({
    type: "redirect",
    status: 302,
    location: `${origin}/authenticate/abc`,
    clearAccessCookie: true,
  });
  expect(
    (await decide(input(cached, { accessCookie: await cookie("abc") })))
      .location,
  ).toBe("https://example.com/x");
  const linkAccess = encodeSecret("link-access-secret-link-access-secret-xx");
  const both = { ...secrets, linkAccess };
  expect(
    (
      await decide(
        input(cached, {
          secrets: both,
          accessCookie: await cookie("abc", linkAccess),
        }),
      )
    ).location,
  ).toBe("https://example.com/x");
});

test("QR-backed links track as scans, and a missing QR document is untracked", async () => {
  const qrId = new ObjectId();
  const backed = toCachedLink(
    {
      _id: id,
      urlCode: "abc",
      longUrl: "https://e.com",
      isQrCode: true,
      qrCodeId: "q1",
    },
    "abc",
    { _id: qrId, qrCodeId: "q1" },
  );
  expect((await decide(input(backed))).track).toEqual({
    linkId: id.toHexString(),
    qr: { id: qrId.toHexString(), publicId: "q1" },
  });
  const orphan = toCachedLink(
    {
      _id: id,
      urlCode: "abc",
      longUrl: "https://e.com",
      isQrCode: true,
      qrCodeId: "q1",
    },
    "abc",
    null,
  );
  expect((await decide(input(orphan))).track).toBeUndefined();
  const flagOnly = toCachedLink(
    { _id: id, urlCode: "abc", longUrl: "https://e.com", isQrCode: true },
    "abc",
    null,
  );
  expect((await decide(input(flagOnly))).track).toEqual({
    linkId: id.toHexString(),
  });
});

test("aliases answer 301 to the canonical key", async () => {
  expect(
    await decide(input({ kind: "alias", id: id.toHexString(), key: "new" })),
  ).toEqual({
    type: "redirect",
    status: 301,
    location: `${origin}/new`,
  });
});

test("click messages round-trip and request fields are bounded", () => {
  const headers = new Headers({
    "cf-connecting-ip": "203.0.113.9",
    "user-agent": "x".repeat(3000),
    "accept-language": "pt-PT,pt;q=0.9",
    "cf-ipcountry": "pt",
    "cf-ipcity": "Lisboa%20Centro",
  });
  const fields = requestClickFields(headers);
  expect(fields.ip).toBe("203.0.113.9");
  expect(fields.ua?.length).toBe(2000);
  expect(fields.lang).toBe("pt-PT");
  expect(fields.country).toBe("PT");
  expect(fields.city).toBe("Lisboa Centro");
  expect(
    requestClickFields(new Headers({ "cf-connecting-ip": "evil" })).ip,
  ).toBeUndefined();
  const query = new URLSearchParams(
    Array.from({ length: 60 }, (_, i): [string, string] => [
      `k${i}`,
      "v".repeat(600),
    ]),
  );
  const bounded = boundedQuery(query);
  expect(Object.keys(bounded)).toHaveLength(50);
  expect(bounded.k0?.length).toBe(500);
  const message = {
    v: 1 as const,
    ts: Date.now(),
    linkId: id.toHexString(),
    domain: "shortn.at",
    key: "abc",
    bot: false,
    query: { utm_source: "news" },
  };
  expect(decodeClickMessage(encodeClickMessage(message))).toEqual(message);
});

test("enrichment hashes IPs, truncates prefixes and extracts UTM and referrer domain", () => {
  const enriched = enrich(
    {
      v: 1,
      ts: Date.now(),
      linkId: id.toHexString(),
      domain: "shortn.at",
      key: "abc",
      bot: false,
      ip: "203.0.113.9",
      ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      referrer: "https://www.google.com/search?q=x",
      query: { utm_source: "news", utm_medium: "email", other: "1" },
    },
    "ip-secret",
  );
  expect(enriched.ipHash).toMatch(/^[0-9a-f]{64}$/);
  expect(enriched.ipPrefix).toBe("203.0.113.0/24");
  expect(enriched.device).toBe("mobile");
  expect(enriched.os).toBe("iOS");
  expect(enriched.refDomain).toBe("google.com");
  expect(enriched.utm).toEqual({ source: "news", medium: "email" });
  expect(ipPrefix("2001:db8:abcd:12::1")).toBe("2001:db8:abcd::/48");
  expect(ipPrefix(undefined)).toBe("");
});
