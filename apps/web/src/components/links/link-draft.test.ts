import { describe, expect, test } from "bun:test";
import type { LinkView } from "@shortn/core";
import {
  createInput,
  draftFromLink,
  emptyDraft,
  linkPatch,
  utmChanged,
  utmInput,
  utmQuery,
} from "./link-draft";

const link: LinkView = {
  id: "652f1c2e8b3a4d0012345678",
  domain: "shortn.at",
  key: "launch",
  url: "https://example.com/launch",
  title: "Launch",
  description: null,
  tags: [{ id: "t1", name: "news" }],
  clicks: 12,
  lastClickAt: null,
  createdAt: "2026-10-01T10:00:00.000Z",
  createdBy: "u1",
  password: { hint: "pet" },
  safety: { status: "safe", disabled: false, interstitial: false },
  qrCodeId: null,
  utm: [
    {
      source: "newsletter",
      medium: "email",
      campaign: null,
      term: null,
      content: null,
    },
  ],
};

describe("linkPatch", () => {
  test("an untouched draft changes nothing", () => {
    expect(linkPatch(link, draftFromLink(link))).toEqual({});
    expect(utmChanged(link, draftFromLink(link))).toBe(false);
  });

  test("sends only edited fields", () => {
    const draft = { ...draftFromLink(link), title: " Launch day ", tags: [] };
    expect(linkPatch(link, draft)).toEqual({ title: "Launch day", tags: [] });
  });

  test("clears the description with null", () => {
    const withDescription = { ...link, description: "Old" };
    const draft = { ...draftFromLink(withDescription), description: "  " };
    expect(linkPatch(withDescription, draft)).toEqual({ description: null });
  });

  test("password changes, hint edits and removal", () => {
    const base = draftFromLink(link);
    expect(linkPatch(link, { ...base, password: "s3cret" })).toEqual({
      password: "s3cret",
      passwordHint: "pet",
    });
    expect(linkPatch(link, { ...base, passwordHint: "" })).toEqual({
      passwordHint: null,
    });
    expect(
      linkPatch(link, { ...base, removePassword: true, password: "x" }),
    ).toEqual({ removePassword: true });
  });

  test("an emptied key keeps the current one", () => {
    expect(linkPatch(link, { ...draftFromLink(link), key: " " })).toEqual({});
  });
});

describe("create and UTM inputs", () => {
  test("omits empty optional fields", () => {
    expect(
      createInput(emptyDraft({ url: " example.com ", passwordHint: "x" })),
    ).toEqual({
      url: "example.com",
      key: undefined,
      title: undefined,
      description: undefined,
      tags: undefined,
      password: undefined,
      passwordHint: undefined,
    });
  });

  test("drops empty variants and trims values", () => {
    const draft = draftFromLink(link);
    draft.utm.push({
      source: " ",
      medium: "",
      campaign: "",
      term: "",
      content: "",
    });
    draft.utm.push({
      source: "x",
      medium: "",
      campaign: " Fall ",
      term: "",
      content: "",
    });
    expect(utmInput(draft.utm)).toEqual([
      {
        source: "newsletter",
        medium: "email",
        campaign: undefined,
        term: undefined,
        content: undefined,
      },
      {
        source: "x",
        medium: undefined,
        campaign: "Fall",
        term: undefined,
        content: undefined,
      },
    ]);
    expect(utmChanged(link, draft)).toBe(true);
  });

  test("builds the appended query", () => {
    expect(
      utmQuery({
        source: "news letter",
        medium: "email",
        campaign: "",
        term: "",
        content: "",
      }),
    ).toBe("?utm_source=news+letter&utm_medium=email");
  });
});
