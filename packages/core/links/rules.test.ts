import { chooseRuleTarget } from "./rules";
import { expect, test } from "bun:test";
import {
  linkRulesInputSchema,
  compileRules,
  storedRules,
  rulesView,
  applyQueryRules,
} from "./rules";
import {
  toCachedLink,
  encodeCachedLink,
  decodeCachedLink,
} from "./cached-link";
import { decide } from "./decide";
import { encodeSecret } from "./tokens";
import type { CachedLink } from "./cached-link";

const link = (rules: Parameters<typeof compileRules>[0]): CachedLink => ({
  kind: "link",
  id: "0123456789abcdef01234567",
  key: "abc",
  dest: "https://example.com/dest",
  status: "ok",
  pwd: false,
  ...(compileRules(rules) ? { rules: compileRules(rules) } : {}),
});
const input = (
  value: CachedLink,
  now = Date.parse("2026-10-13T12:00:00Z"),
) => ({
  link: value,
  key: "abc",
  origin: "https://shortn.at",
  locale: "en" as const,
  secrets: { legacy: encodeSecret("test") },
  now,
});

test("rule validation rejects invalid chronology, private fallbacks, unsupported fields and unbounded UTM", () => {
  for (const rules of [
    { activeFrom: "bad" },
    { activeFrom: "2026-10-13T12:00:00Z", expiresAt: "2026-10-13T12:00:00Z" },
    { activeFrom: "2026-10-14T12:00:00Z", expiresAt: "2026-10-13T12:00:00Z" },
    { expiredUrl: "http://127.0.0.1/x" },
    { expiredUrl: "javascript:alert(1)" },
    { permanent: "yes" },
    { geo: [{ country: "P", url: "https://example.com" }] },
    { utm: { source: "x".repeat(201) } },
    { utm: { unknown: "x" } },
  ])
    expect(linkRulesInputSchema.safeParse(rules).success).toBe(false);
});

test("rules compile dates to epoch and round-trip cache and API views", () => {
  const rules = linkRulesInputSchema.parse({
    activeFrom: "2026-10-13T12:00:00.000Z",
    expiresAt: "2026-10-14T12:00:00.000Z",
    expiredUrl: "https://example.com/expired",
    utm: { source: " news " },
    permanent: true,
  });
  const stored = storedRules(rules);
  expect(stored.activeFrom).toBeInstanceOf(Date);
  const cached = toCachedLink(
    {
      _id: { toHexString: () => "0123456789abcdef01234567" },
      longUrl: "https://example.com",
      rules: stored,
    },
    "abc",
    null,
  );
  expect(cached.kind === "link" && cached.rules?.activeFrom).toBe(
    Date.parse(rules.activeFrom!),
  );
  expect(decodeCachedLink(encodeCachedLink(cached))).toEqual(cached);
  expect(rulesView(stored)).toEqual({ ...rules, utm: { source: "news" } });
  expect(
    compileRules({ startsAt: new Date(rules.activeFrom!) })?.activeFrom,
  ).toBe(Date.parse(rules.activeFrom!));
  expect(() => compileRules({ activeFrom: "bad" })).toThrow();
  const omitted = storedRules({
    forwardQuery: undefined,
    utm: { source: undefined, campaign: "Launch" },
  });
  expect(JSON.stringify(omitted)).toBe('{"utm":{"campaign":"Launch"}}');
  expect(compileRules(JSON.parse(JSON.stringify(omitted)))?.utm).toEqual({
    campaign: "Launch",
  });
});

test("activation is inclusive and expiry is exclusive, even with the same cached payload", async () => {
  const from = Date.parse("2026-10-13T12:00:00Z"),
    until = from + 1000;
  const value = link({
    activeFrom: new Date(from),
    expiresAt: new Date(until),
  });
  expect(await decide(input(value, from - 1))).toMatchObject({
    type: "unavailable",
    reason: "scheduled",
    status: 404,
  });
  expect(await decide(input(value, from))).toMatchObject({
    type: "redirect",
    location: "https://example.com/dest",
    status: 302,
    track: { linkId: "0123456789abcdef01234567" },
  });
  expect(await decide(input(value, until - 1))).toMatchObject({
    type: "redirect",
  });
  const expired = await decide(input(value, until));
  expect(expired).toMatchObject({
    type: "unavailable",
    reason: "expired",
    status: 410,
  });
  expect(expired.track).toBeUndefined();
});

test("status and password gates precede rules, including fallback and permanent redirects", async () => {
  const value = link({
    expiresAt: new Date(0),
    expiredUrl: "https://example.com/fallback",
    permanent: true,
    forwardQuery: true,
    utm: { source: "fixed" },
  });
  if (value.kind !== "link") throw new Error("fixture");
  for (const status of ["blocked", "interstitial"] as const) {
    const decision = await decide(input({ ...value, status }));
    expect(decision).toMatchObject({
      status: 302,
      location: "https://shortn.at/en/safety/abc",
    });
    expect(decision.track).toBeUndefined();
  }
  expect(await decide(input({ ...value, pwd: true }))).toMatchObject({
    status: 302,
    location: "https://shortn.at/authenticate/abc",
  });
  const fallback = await decide({
    ...input(value),
    query: new URLSearchParams("token=secret&new=private"),
  });
  expect(fallback).toEqual({
    type: "redirect",
    status: 302,
    location: "https://example.com/fallback",
  });
});

test("destination query wins over incoming, fixed UTM wins over both, internal tokens stay private", async () => {
  const incoming = new URLSearchParams(
    "x=incoming&new=first&new=second&utm_source=incoming&token=secret&q=qr&ref=bio:abc&block=block",
  );
  const result = new URL(
    applyQueryRules(
      "https://example.com/?x=destination&utm_source=old#hash",
      {
        forwardQuery: true,
        utm: { source: "fixed", campaign: "Launch & win" },
      },
      incoming,
    ),
  );
  expect(result.searchParams.get("x")).toBe("destination");
  expect(result.searchParams.getAll("new")).toEqual(["first", "second"]);
  expect(result.searchParams.get("utm_source")).toBe("fixed");
  expect(result.searchParams.get("utm_campaign")).toBe("Launch & win");
  for (const key of ["token", "q", "ref", "block"])
    expect(result.searchParams.has(key)).toBe(false);
  expect(result.hash).toBe("#hash");
  expect(applyQueryRules("https://example.com", undefined, incoming)).toBe(
    "https://example.com/",
  );
  expect(
    await decide({
      ...input(link({ permanent: true, forwardQuery: true })),
      query: incoming,
    }),
  ).toMatchObject({
    status: 301,
    track: { linkId: "0123456789abcdef01234567" },
  });
});

test("query forwarding has bounded parameter count and sizes", () => {
  const incoming = new URLSearchParams(
    Array.from(
      { length: 100 },
      (_, i) =>
        [String(i) + "k".repeat(110), "v".repeat(700)] as [string, string],
    ),
  );
  const result = new URL(
    applyQueryRules("https://example.com", { forwardQuery: true }, incoming),
  );
  expect([...result.searchParams]).toHaveLength(50);
  for (const [key, value] of result.searchParams) {
    expect(key.length).toBeLessThanOrEqual(100);
    expect(value.length).toBeLessThanOrEqual(500);
  }
});

const iphone =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";
const android =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const mac =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/129.0.0.0 Safari/537.36";

test("device targeting precedes ordered geo matches, with OS/device conjunction and default branch", async () => {
  const rules = compileRules({
    device: [
      { os: "ios", device: "tablet", url: "https://example.com/tablet" },
      { os: "ios", device: "mobile", url: "https://example.com/ios" },
      { device: "mobile", url: "https://example.com/mobile" },
    ],
    geo: [
      { country: "PT", url: "https://example.com/pt-first" },
      { country: "PT", url: "https://example.com/pt-second" },
    ],
  });
  expect(
    chooseRuleTarget("https://example.com/default", rules, {
      userAgent: iphone,
      country: "PT",
    }),
  ).toEqual({ destination: "https://example.com/ios", branch: "device:1" });
  expect(
    chooseRuleTarget("https://example.com/default", rules, {
      userAgent: android,
      country: "PT",
    }),
  ).toEqual({ destination: "https://example.com/mobile", branch: "device:2" });
  expect(
    chooseRuleTarget("https://example.com/default", rules, {
      userAgent: mac,
      country: "pt",
    }),
  ).toEqual({ destination: "https://example.com/pt-first", branch: "geo:0" });
  expect(
    chooseRuleTarget("https://example.com/default", rules, {
      userAgent: mac,
      country: "XX",
    }),
  ).toEqual({
    destination: "https://example.com/default",
    branch: "destination",
  });
  const selected = await decide({
    ...input(link(rules)),
    userAgent: iphone,
    country: "PT",
    query: new URLSearchParams("extra=value"),
  });
  expect(selected).toMatchObject({
    location: "https://example.com/ios",
    track: { branch: "device:1" },
  });
  const value = link(rules);
  if (value.kind !== "link") throw new Error("fixture");
  expect(
    await decide({
      ...input({ ...value, status: "blocked" }),
      userAgent: iphone,
    }),
  ).toMatchObject({ location: "https://shortn.at/en/safety/abc" });
  expect(
    await decide({ ...input({ ...value, pwd: true }), userAgent: iphone }),
  ).toMatchObject({ location: "https://shortn.at/authenticate/abc" });
});

test("target lists reject private destinations and empty predicates, and normalize prototype stored fields", () => {
  for (const rules of [
    { device: [{ url: "https://example.com" }] },
    { device: [{ os: "linux", url: "https://example.com" }] },
    { geo: [{ country: "PT", url: "http://127.0.0.1" }] },
    {
      geo: Array.from({ length: 11 }, () => ({
        country: "PT",
        url: "https://example.com",
      })),
    },
  ])
    expect(linkRulesInputSchema.safeParse(rules).success).toBe(false);
  expect(
    compileRules({
      geo: [{ countries: ["PT", "ES"], destination: "https://example.com" }],
      devices: [
        { device: "mobile", destination: "https://example.com/mobile" },
      ],
    }),
  ).toMatchObject({
    geo: [{ country: "PT" }, { country: "ES" }],
    device: [{ device: "mobile", url: "https://example.com/mobile" }],
  });
});

test("rotation uses relative weight boundaries, sticky buckets and configuration invalidation", () => {
  const rules = compileRules({
    rotation: [
      { url: "https://example.com/a", weight: 1 },
      { url: "https://example.com/b", weight: 3 },
    ],
  })!;
  for (const [random, branch] of [
    [0, "rotation:0"],
    [0.24999, "rotation:0"],
    [0.25, "rotation:1"],
    [0.999999, "rotation:1"],
  ] as const)
    expect(
      chooseRuleTarget("https://example.com/default", rules, {
        rotationRandom: () => random,
      }).branch,
    ).toBe(branch);
  const first = chooseRuleTarget("https://example.com/default", rules, {
    rotationRandom: () => 0.5,
  });
  expect(first.rotationCookie).toBeTruthy();
  const same = chooseRuleTarget("https://example.com/default", rules, {
    rotationCookie: first.rotationCookie,
    rotationRandom: () => {
      throw new Error("Sticky selection drew again");
    },
  });
  expect(same.branch).toBe("rotation:1");
  expect(same.rotationCookie).toBeUndefined();
  const changed = compileRules({
    rotation: [
      { url: "https://example.com/a", weight: 3 },
      { url: "https://example.com/b", weight: 1 },
    ],
  })!;
  const reassigned = chooseRuleTarget("https://example.com/default", changed, {
    rotationCookie: first.rotationCookie,
    rotationRandom: () => 0,
  });
  expect(reassigned.branch).toBe("rotation:0");
  expect(reassigned.rotationCookie).not.toBe(first.rotationCookie);
  for (const cookie of [
    "bad",
    `${rules.rotationKey}.99`,
    `${rules.rotationKey}.-1`,
    `${rules.rotationKey}.0.trailing`,
  ])
    expect(
      chooseRuleTarget("https://example.com/default", rules, {
        rotationCookie: cookie,
        rotationRandom: () => 0,
      }).rotationCookie,
    ).toBeTruthy();
});

test("rotation follows targeting and stays behind password/safety/time gates", async () => {
  const value = link({
    device: [{ os: "ios", url: "https://example.com/ios" }],
    geo: [{ country: "PT", url: "https://example.com/pt" }],
    rotation: [
      { url: "https://example.com/a", weight: 1 },
      { url: "https://example.com/b", weight: 1 },
    ],
    utm: { source: "fixed" },
    forwardQuery: true,
  });
  if (value.kind !== "link") throw new Error("fixture");
  const device = await decide({
    ...input(value),
    userAgent: iphone,
    rotationRandom: () => 0,
  });
  expect(device).toMatchObject({ track: { branch: "device:0" } });
  if (device.type === "redirect") expect(device.rotationCookie).toBeUndefined();
  const geo = await decide({
    ...input(value),
    country: "PT",
    rotationRandom: () => 0,
  });
  expect(geo).toMatchObject({ track: { branch: "geo:0" } });
  if (geo.type === "redirect") expect(geo.rotationCookie).toBeUndefined();
  const rotated = await decide({
    ...input(value),
    rotationRandom: () => 0,
    query: new URLSearchParams("extra=ok"),
  });
  expect(rotated).toMatchObject({
    location: "https://example.com/a?extra=ok&utm_source=fixed",
    track: { branch: "rotation:0" },
    rotationCookie: { maxAge: 3600 },
  });
  for (const candidate of [
    { ...value, pwd: true },
    { ...value, status: "blocked" as const },
    { ...value, rules: { ...value.rules!, expiresAt: 0 } },
  ]) {
    const decision = await decide({
      ...input(candidate),
      rotationRandom: () => {
        throw new Error("Gate reached rotation");
      },
    });
    expect(decision.track).toBeUndefined();
    if (decision.type === "redirect")
      expect(decision.rotationCookie).toBeUndefined();
  }
});

test("rotation validation, API views and prototype decoding are bounded and safe", () => {
  for (const rotation of [
    [],
    [{ url: "https://example.com", weight: 0 }],
    [{ url: "https://example.com", weight: Infinity }],
    [{ url: "http://127.0.0.1", weight: 1 }],
    Array.from({ length: 11 }, () => ({
      url: "https://example.com",
      weight: 1,
    })),
  ])
    expect(linkRulesInputSchema.safeParse({ rotation }).success).toBe(false);
  const compiled = compileRules({
    rotation: [{ destination: "https://example.com", weight: 1 }],
  })!;
  expect(compiled.rotation).toEqual([
    { url: "https://example.com", weight: 1 },
  ]);
  expect(compiled.rotationKey).toHaveLength(64);
  expect(compileRules({ rotation: [] })).toBeUndefined();
  expect(Object.hasOwn(rulesView(compiled)!, "rotationKey")).toBe(false);
});

test("maximum-click gates follow safety, password and time, and precede targeting", async () => {
  let reads = 0;
  const count = async () => {
    reads++;
    return 7;
  };
  const limited = link({
    maxClicks: 7,
    rotation: [{ url: "https://example.com/a", weight: 1 }],
  });
  expect(await decide({ ...input(limited), clickCount: count })).toMatchObject({
    type: "unavailable",
    reason: "limit",
    status: 410,
  });
  expect(reads).toBe(1);
  for (const value of [
    { ...limited, status: "blocked" as const },
    { ...limited, pwd: true },
    link({ maxClicks: 7, expiresAt: 0 }),
    link({ maxClicks: 7, activeFrom: Date.now() + 60000 }),
    link({ maxClicks: 0 }),
    link({ permanent: true }),
  ])
    await decide({ ...input(value), clickCount: count });
  expect(reads).toBe(1);
  const allowed = await decide({
    ...input(limited),
    clickCount: async () => 6,
  });
  expect(allowed).toMatchObject({
    type: "redirect",
    track: { counterBase: 6, branch: "rotation:0" },
  });
  await expect(decide(input(limited))).rejects.toThrow("counter");
  await expect(
    decide({ ...input(limited), clickCount: async () => NaN }),
  ).rejects.toThrow();
  for (const maxClicks of [-1, 0.1, Infinity, Number.MAX_SAFE_INTEGER + 1, "3"])
    expect(linkRulesInputSchema.safeParse({ maxClicks }).success).toBe(false);
  for (const maxClicks of [0, 10, Number.MAX_SAFE_INTEGER])
    expect(rulesView(storedRules({ maxClicks }))).toEqual({ maxClicks });
});

test("limited cache payloads seed from persisted clicks or scans without adding overlapping totals", () => {
  const base = {
    _id: { toHexString: () => "0123456789abcdef01234567" },
    longUrl: "https://example.com",
    clicks: { total: 9 },
    stats: { clicks: 4, scans: 8 },
  };
  expect(
    toCachedLink({ ...base, rules: { maxClicks: 15 } }, "x", null),
  ).toMatchObject({ hits: 12 });
  expect(
    toCachedLink({ ...base, rules: { maxClicks: 15 }, isQrCode: true }, "x", {
      _id: base._id,
      qrCodeId: "qr",
      clicks: { total: 20 },
    }),
  ).toMatchObject({ hits: 20 });
  expect(toCachedLink(base, "x", null)).not.toHaveProperty("hits");
});

test("deep links select by OS ahead of targeting and rotation, with query rules on both paths", async () => {
  const value = link({
    deepLink: {
      ios: "youtube://watch?v=123",
      android: "spotify:track:abc",
      fallback: "web",
    },
    device: [{ device: "mobile", url: "https://example.com/mobile" }],
    geo: [{ country: "PT", url: "https://example.com/pt" }],
    rotation: [{ url: "https://example.com/a", weight: 1 }],
    forwardQuery: true,
    utm: { source: "fixed" },
    permanent: true,
  });
  for (const [userAgent, os, scheme] of [
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
      "ios",
      "youtube:",
    ],
    [
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36",
      "android",
      "spotify:",
    ],
  ]) {
    const decision = await decide({
      ...input(value),
      userAgent,
      country: "PT",
      query: new URLSearchParams("x=1&token=secret&utm_source=incoming"),
    });
    expect(decision).toMatchObject({
      type: "redirect",

      deepLink: {
        fallback: "https://example.com/dest?x=1&utm_source=fixed",
        locale: "en",
        store: false,
      },
      track: { branch: `deep:${os}` },
    });
    expect(decision.location).toContain(scheme);
    expect(decision.location).toContain("utm_source=fixed");
    expect(decision.location).not.toContain("secret");
    expect(decision).not.toHaveProperty("rotationCookie");
    const bot = await decide({
      ...input(value),
      userAgent,
      bot: true,
      country: "PT",
    });
    expect(bot).not.toHaveProperty("deepLink");
    expect(bot).toMatchObject({ track: { branch: "device:0" } });
    for (const gate of [
      { ...value, status: "blocked" as const },
      { ...value, pwd: true },
      link({
        deepLink: { ios: "youtube://watch", fallback: "web" },
        expiresAt: 0,
      }),
      link({
        deepLink: { ios: "youtube://watch", fallback: "web" },
        maxClicks: 0,
      }),
    ])
      expect(await decide({ ...input(gate), userAgent })).not.toHaveProperty(
        "deepLink",
      );
  }
  expect(await decide({ ...input(value), country: "PT" })).toMatchObject({
    track: { branch: "geo:0" },
  });
  const stored = storedRules({
    deepLink: {
      ios: "youtube://watch",
      fallback: "store",
      store: { ios: "https://apps.apple.com/app/id123" },
    },
  });
  expect(rulesView(stored)?.deepLink).toEqual(stored.deepLink);
  expect(
    await decide({
      ...input(link(stored)),
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
    }),
  ).toMatchObject({
    deepLink: { fallback: "https://apps.apple.com/app/id123", store: true },
  });
});

test("deep links reject executable/system handlers, missing stores and unsafe public targets", () => {
  for (const ios of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "file:///tmp/x",
    "intent://x",
    "ms-settings:abc",
    "https://127.0.0.1/x",
    "https://user:pass@example.com",
    "unknown://x",
    "youtube://x\nheader",
    "http://example.com",
  ])
    expect(
      linkRulesInputSchema.safeParse({ deepLink: { ios, fallback: "web" } })
        .success,
    ).toBe(false);
  for (const deepLink of [
    { fallback: "web" },
    { ios: "youtube://x", fallback: "store" },
    { ios: "youtube://x", fallback: "store", store: { ios: "not-a-url" } },
    {
      ios: "youtube://x",
      fallback: "store",
      store: { ios: "https://apps.apple.com.evil.com/app" },
    },
    {
      android: "spotify:track:x",
      fallback: "store",
      store: { android: "https://example.com/app" },
    },
  ])
    expect(linkRulesInputSchema.safeParse({ deepLink }).success).toBe(false);
  expect(
    linkRulesInputSchema.safeParse({
      deepLink: { ios: "https://example.com/app", fallback: "web" },
    }).success,
  ).toBe(true);
});
