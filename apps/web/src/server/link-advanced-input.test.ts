import { expect, test } from "bun:test";
import { parseLinkAdvancedInput } from "./link-advanced-input";
const form = (values: Record<string, string>, marked = true) => {
  const data = new FormData();
  if (marked) data.set("advancedVersion", "1");
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};
test("basic-only submissions preserve all advanced state; explicit empty editor clears it", () => {
  expect(
    parseLinkAdvancedInput(form({ url: "https://example.com" }, false)),
  ).toEqual({ value: {} });
  expect(parseLinkAdvancedInput(form({}))).toEqual({
    value: { rules: null, og: null },
  });
});
test("all rule families and social preview reach canonical core validation without truncation", () => {
  const result = parseLinkAdvancedInput(
    form({
      "rule.activeFrom": "2026-10-16T07:05",
      "rule.expiresAt": "2027-10-16T07:05:10.123",
      "rule.maxClicks": "0",
      "rule.expiredUrl": "https://example.com/expired",
      "rule.forwardQuery": "on",
      "rule.permanent": "on",
      "rule.utm.source": " Newsletter ",
      "rule.utm.medium": "Email",
      "rule.utm.campaign": "Autumn",
      "rule.utm.term": "A",
      "rule.utm.content": "B",
      "rule.geo.count": "1",
      "rule.geo.0.country": "dk",
      "rule.geo.0.url": "https://example.com/dk",
      "rule.device.count": "1",
      "rule.device.0.os": "ios",
      "rule.device.0.device": "mobile",
      "rule.device.0.url": "https://example.com/ios",
      "rule.rotation.count": "2",
      "rule.rotation.0.url": "https://example.com/a",
      "rule.rotation.0.weight": "3",
      "rule.rotation.1.url": "https://example.com/b",
      "rule.rotation.1.weight": "1",
      "rule.deepLink.ios": "youtube://watch?v=1",
      "rule.deepLink.android": "https://example.com/app",
      "rule.deepLink.fallback": "store",
      "rule.deepLink.store.ios": "https://apps.apple.com/app/id123",
      "rule.deepLink.store.android":
        "https://play.google.com/store/apps/details?id=app",
      "og.title": "Social title",
      "og.description": "Social description",
      "og.image": "https://example.com/image.png",
    }),
  );
  expect(result.value).toEqual({
    rules: {
      activeFrom: "2026-10-16T07:05:00.000Z",
      expiresAt: "2027-10-16T07:05:10.123Z",
      maxClicks: 0,
      expiredUrl: "https://example.com/expired",
      forwardQuery: true,
      permanent: true,
      utm: {
        source: "Newsletter",
        medium: "Email",
        campaign: "Autumn",
        term: "A",
        content: "B",
      },
      geo: [{ country: "DK", url: "https://example.com/dk" }],
      device: [{ os: "ios", device: "mobile", url: "https://example.com/ios" }],
      rotation: [
        { url: "https://example.com/a", weight: 3 },
        { url: "https://example.com/b", weight: 1 },
      ],
      deepLink: {
        ios: "youtube://watch?v=1",
        android: "https://example.com/app",
        fallback: "store",
        store: {
          ios: "https://apps.apple.com/app/id123",
          android: "https://play.google.com/store/apps/details?id=app",
        },
      },
    },
    og: {
      title: "Social title",
      description: "Social description",
      image: "https://example.com/image.png",
    },
  });
});
test("UTC input rejects invalid calendar dates, offsets and reversed schedules", () => {
  for (const value of [
    "2026-02-30T09:00",
    "2026-10-16T25:00",
    "2026-10-16T09:00+02:00",
    "2026-10-16",
    "bad",
  ])
    expect(
      parseLinkAdvancedInput(form({ "rule.activeFrom": value })).error,
    ).toBe("invalid_input");
  expect(
    parseLinkAdvancedInput(
      form({
        "rule.activeFrom": "2026-10-16T09:00",
        "rule.expiresAt": "2026-10-16T08:00",
      }),
    ).error,
  ).toBe("invalid_input");
  expect(
    parseLinkAdvancedInput(form({ "rule.activeFrom": "2028-02-29T09:00" }))
      .value?.rules?.activeFrom,
  ).toBe("2028-02-29T09:00:00.000Z");
});
test("malformed or oversized targeting cannot be silently dropped into a successful save", () => {
  const invalid = [
    { "rule.geo.count": "11" },
    { "rule.geo.count": "1", "rule.geo.10.country": "US" },
    {
      "rule.geo.count": "0",
      "rule.geo.0.country": "US",
      "rule.geo.0.url": "https://example.com",
    },
    { "rule.geo.count": "1", "rule.geo.0.country": "US" },
    { "rule.device.count": "1", "rule.device.0.url": "https://example.com" },
    {
      "rule.rotation.count": "1",
      "rule.rotation.0.url": "https://example.com",
      "rule.rotation.0.weight": "0",
    },
    { "rule.unknown": "value" },
    { "rule.permanent": "true" },
    { "rule.maxClicks": "1.5" },
    { "rule.maxClicks": "9007199254740992" },
    {
      "rule.geo.count": "1",
      "rule.geo.0.country": "US",
      "rule.geo.0.url": "http://127.0.0.1/private",
    },
    { "rule.deepLink.ios": "javascript:alert(1)" },
    {
      "rule.deepLink.ios": "youtube://watch?v=1",
      "rule.deepLink.fallback": "store",
    },
    { "rule.utm.source": "x".repeat(201) },
  ];
  for (const fields of invalid)
    expect(
      parseLinkAdvancedInput(form(fields as Record<string, string>)).error,
    ).toBe("invalid_input");
  const duplicate = form({ "rule.maxClicks": "1" });
  duplicate.append("rule.maxClicks", "2");
  expect(parseLinkAdvancedInput(duplicate).error).toBe("invalid_input");
  const file = form({});
  file.append("og.image", new Blob(["payload"]), "file");
  expect(parseLinkAdvancedInput(file).field).toBe("og");
});
test("preview rejects unsafe/non-HTTPS images and overlong or unknown fields", () => {
  for (const fields of [
    { "og.image": "http://example.com/image.png" },
    { "og.image": "https://127.0.0.1/image.png" },
    { "og.title": "x".repeat(201) },
    { "og.description": "x".repeat(501) },
    { "og.secret": "ignored?" },
  ])
    expect(
      parseLinkAdvancedInput(form(fields as Record<string, string>)),
    ).toEqual({ error: "invalid_input", field: "og" });
});
