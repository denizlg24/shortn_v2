import { expect, test } from "bun:test";
import { socialPreviewSchema, readSocialPreview, isLinkPreviewBot } from "./og";
import {
  toCachedLink,
  encodeCachedLink,
  decodeCachedLink,
  type CachedLink,
} from "./cached-link";
import { decide } from "./decide";
import { encodeSecret } from "./tokens";
const id = "0123456789abcdef01234567";
const link: CachedLink = {
  kind: "link",
  id,
  key: "abc",
  dest: "https://example.com",
  status: "ok",
  pwd: false,
  og: { title: "A preview", image: "https://images.example.com/card.png" },
};
const input = {
  link,
  key: "abc",
  origin: "https://shortn.at",
  locale: "en" as const,
  secrets: { legacy: encodeSecret("test") },
  previewBot: true,
};

test("preview validation bounds metadata and image destinations, and safely ignores invalid legacy metadata", () => {
  expect(socialPreviewSchema.parse({ title: " Title " })).toEqual({
    title: "Title",
  });
  for (const value of [
    {},
    { title: " " },
    { title: "x".repeat(201) },
    { description: "x".repeat(501) },
    { unknown: "x" },
    { image: "http://example.com/a.png" },
    { image: "https://127.0.0.1/a" },
    { image: "https://user:pass@example.com/x" },
    { image: "javascript:alert(1)" },
    { image: "not-a-url" },
  ])
    expect(socialPreviewSchema.safeParse(value).success).toBe(false);
  expect(readSocialPreview({ title: undefined, description: "A" })).toEqual({
    description: "A",
  });
  expect(readSocialPreview({ image: "file:///tmp/x" })).toBeUndefined();
  const legacy = {
    _id: { toHexString: () => id },
    longUrl: "https://example.com",
    title: "Link title",
    og: { description: "Description" },
  };
  const cached = toCachedLink(legacy, "abc", null);
  expect(cached).toMatchObject({
    og: { title: "Link title", description: "Description" },
  });
  expect(decodeCachedLink(encodeCachedLink(cached))).toEqual(cached);
  expect(
    toCachedLink(
      { ...legacy, og: { image: "https://localhost/x" } },
      "abc",
      null,
    ),
  ).not.toHaveProperty("og");
});

test("only recognized social-preview UAs select metadata, excluding search crawlers and substring lookalikes", () => {
  for (const ua of [
    "facebookexternalhit/1.1",
    "Facebot",
    "Twitterbot/1.0",
    "Mozilla/5.0 (compatible; LinkedInBot/1.0)",
    "Slackbot-LinkExpanding 1.0",
    "Discordbot/2.0",
    "TelegramBot (like TwitterBot)",
    "WhatsApp/2.24",
    "SkypeUriPreview",
    "MicrosoftPreview/2.0",
    "Pinterestbot/1.0",
    "redditbot/1.0",
  ])
    expect(isLinkPreviewBot(ua)).toBe(true);
  for (const ua of [
    "",
    "Mozilla/5.0 Chrome/129.0",
    "Googlebot/2.1",
    "bingbot/2.0",
    "NotTwitterbot/1.0",
    "x".repeat(2000) + " Twitterbot/1.0",
  ])
    expect(isLinkPreviewBot(ua)).toBe(false);
});

test("previews stay behind every gate, select a web target, and never create rotation cookies", async () => {
  const decision = await decide({
    ...input,
    query: new URLSearchParams("token=secret&x=1"),
    link: {
      ...link,
      rules: {
        forwardQuery: true,
        rotation: [{ url: "https://example.com/a", weight: 1 }],
        deepLink: { ios: "youtube://watch", fallback: "web" },
      },
    },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
  });
  expect(decision).toMatchObject({
    socialPreview: { og: link.og, canonical: "https://shortn.at/abc" },
    location: "https://example.com/a?x=1",
  });
  expect(decision).not.toHaveProperty("deepLink");
  expect(decision).not.toHaveProperty("rotationCookie");
  for (const gated of [
    { ...link, status: "blocked" as const },
    { ...link, status: "interstitial" as const },
    { ...link, pwd: true },
    { ...link, rules: { activeFrom: Date.now() + 60000 } },
    { ...link, rules: { expiresAt: 0 } },
    { ...link, rules: { maxClicks: 0 } },
    { kind: "deleted" as const },
  ])
    expect(await decide({ ...input, link: gated })).not.toHaveProperty(
      "socialPreview",
    );
  expect(await decide({ ...input, previewBot: false })).not.toHaveProperty(
    "socialPreview",
  );
  expect(
    await decide({ ...input, link: { ...link, og: undefined } }),
  ).not.toHaveProperty("socialPreview");
});
