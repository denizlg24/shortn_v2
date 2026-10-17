import { describe, expect, test } from "bun:test";
import { routeMarketing, sharedCookieDomain } from "./routes";
import { alternateUrls, pageMetadata } from "./seo";

const app = "https://app.shortn.at";
const route = (path: string, query = "") =>
  routeMarketing(path, new URLSearchParams(query), app);

describe("routeMarketing", () => {
  test("rewrites pages and unknown paths to the marketing tree", () => {
    expect(route("/en")).toEqual({
      kind: "rewrite",
      pathname: "/_marketing/en",
      locale: "en",
    });
    expect(route("/pt/pricing/")).toEqual({
      kind: "rewrite",
      pathname: "/_marketing/pt/pricing",
      locale: "pt",
    });
    expect(route("/es/whatever/deep")).toMatchObject({
      kind: "rewrite",
      pathname: "/_marketing/es/whatever/deep",
    });
  });

  test("leaves non-locale, safety and dashboard paths alone", () => {
    expect(route("/")).toBeNull();
    expect(route("/acme/links")).toBeNull();
    expect(route("/en/safety/abc")).toBeNull();
    expect(route("/pt/dashboard")).toBeNull();
    expect(route("/pt/dashboard/links")).toBeNull();
  });

  test("301s product pages to feature anchors in one hop", () => {
    expect(route("/en/products")).toMatchObject({
      status: 301,
      location: "/en/features",
    });
    expect(route("/pt/products/qr-code")).toMatchObject({
      location: "/pt/features",
      hash: "qr-codes",
    });
    expect(route("/es/products/pages")).toMatchObject({ hash: "bio-pages" });
    expect(route("/en/products/url-shortener")).toMatchObject({
      hash: "links",
    });
    expect(route("/en/products/analytics")).toMatchObject({
      hash: "analytics",
    });
  });

  test("301s the help centre to guides, and plans-pricing to pricing", () => {
    expect(route("/en/help")).toMatchObject({ location: "/docs/en/guides" });
    expect(route("/pt/help/articles/links/utm-parameters")).toMatchObject({
      location: "/docs/pt/guides/links/utm-parameters",
    });
    expect(route("/es/help/articles/billing/plans-pricing")).toMatchObject({
      location: "/es/pricing",
    });
    expect(route("/en/help/articles/nope")).toMatchObject({
      location: "/docs/en/guides",
    });
  });

  test("301s root-host auth screens to the app and keeps the token", () => {
    expect(route("/pt/login")).toEqual({
      kind: "redirect",
      status: 301,
      location: "https://app.shortn.at/login",
      keepQuery: true,
      locale: "pt",
    });
    expect(route("/en/reset", "token=abc")).toMatchObject({
      location: "https://app.shortn.at/reset",
      keepQuery: true,
    });
    expect(route("/es/verify/sent")).toMatchObject({
      location: "https://app.shortn.at/verify",
    });
    expect(route("/en/auth/error", "error=x")).toMatchObject({
      location: "https://app.shortn.at/login",
      keepQuery: true,
    });
    const change = route(
      "/en/verify/request-change",
      "token=t0k&email=a@b.c&new=d@e.f",
    );
    expect(change).toMatchObject({ keepQuery: false, locale: "en" });
    expect(change?.kind === "redirect" && change.location).toBe(
      "https://app.shortn.at/api/auth/verify-email?token=t0k&callbackURL=%2Fverify",
    );
  });

  test("moves locale-prefixed password pages to the unprefixed route", () => {
    expect(route("/en/authenticate/abc")).toMatchObject({
      location: "/authenticate/abc",
    });
  });
});

test("sharedCookieDomain spans root and app hosts", () => {
  expect(sharedCookieDomain("https://shortn.at")).toBe("shortn.at");
  expect(sharedCookieDomain("https://staging.shortn.at")).toBe("shortn.at");
  expect(sharedCookieDomain("http://localhost:3001")).toBeUndefined();
  expect(sharedCookieDomain(undefined)).toBeUndefined();
});

describe("seo", () => {
  const pathFor = (locale: string) => `/${locale}/pricing`;

  test("alternates are reciprocal with an English x-default", () => {
    expect(alternateUrls("https://shortn.at", pathFor)).toEqual({
      en: "https://shortn.at/en/pricing",
      pt: "https://shortn.at/pt/pricing",
      es: "https://shortn.at/es/pricing",
      "x-default": "https://shortn.at/en/pricing",
    });
  });

  test("every locale is self-canonical and indexable", () => {
    for (const locale of ["en", "pt", "es"] as const) {
      const metadata = pageMetadata({
        origin: "https://shortn.at",
        locale,
        pathFor,
        title: "Pricing",
        description: "d",
        siteName: "Shortn",
      });
      expect(metadata.alternates?.canonical).toBe(
        `https://shortn.at/${locale}/pricing`,
      );
      expect(metadata.robots).toEqual({ index: true, follow: true });
      expect(Object.keys(metadata.alternates?.languages ?? {})).toEqual([
        "en",
        "pt",
        "es",
        "x-default",
      ]);
    }
  });
});
