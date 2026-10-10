import { describe, expect, test } from "bun:test";
import type { BioEditable } from "@shortn/core";
import {
  appearanceOf,
  appearanceProblem,
  badSocial,
  linksInput,
  profileOf,
  profilePatch,
  socialsInput,
  themeOf,
} from "./bio-draft";

const bio: BioEditable = {
  id: "b1",
  slug: "ana",
  title: "Ana",
  linkCount: 1,
  avatarUrl: null,
  createdBy: null,
  updatedAt: "2026-01-01T00:00:00.000Z",
  description: "",
  avatarShape: "circle",
  theme: {
    buttonStyle: "rounded",
    titleFontSize: "1.5rem",
    header: { headerStyle: "centered", headerBackgroundColor: "#123456" },
  },
  socials: [],
  socialColor: "original",
  links: [
    {
      linkId: "l1",
      title: "",
      image: null,
      key: "menu",
      url: "https://example.com",
    },
  ],
};

describe("themeOf", () => {
  test("round-trips a stored theme, legacy-only fields included", () => {
    expect(themeOf(appearanceOf(bio))).toEqual(bio.theme);
  });

  test("leaves unset colours out and removes the header", () => {
    const draft = { ...appearanceOf(bio), header: "none" as const };
    expect(themeOf(draft)).toEqual({
      buttonStyle: "rounded",
      titleFontSize: "1.5rem",
    });
  });
});

describe("profilePatch", () => {
  test("sends only changed fields, trimmed", () => {
    const saved = profileOf(bio);
    expect(profilePatch(saved, { ...saved, description: "  Hello  " })).toEqual(
      { description: "Hello" },
    );
    expect(profilePatch(saved, saved)).toEqual({});
  });
});

describe("linksInput", () => {
  test("always stores a title, since legacy shows nothing without one", () => {
    expect(
      linksInput([
        { linkId: "l1", key: "menu", url: "", title: " ", image: "" },
      ]),
    ).toEqual([{ linkId: "l1", title: "menu" }]);
  });
});

describe("socials", () => {
  test("bare hosts get https:// like legacy did", () => {
    expect(
      socialsInput([{ id: "s", platform: "github", url: "github.com/ana" }]),
    ).toEqual([{ platform: "github", url: "https://github.com/ana" }]);
  });

  test("an empty URL is flagged", () => {
    expect(badSocial([{ id: "s", platform: "github", url: " " }])).toBe(0);
  });
});

describe("appearanceProblem", () => {
  test("rejects colours the server would refuse", () => {
    const draft = appearanceOf(bio);
    expect(appearanceProblem({ ...draft, textColor: "#123" })).toBeNull();
    expect(appearanceProblem({ ...draft, textColor: "#12" })).toBe("color");
    expect(appearanceProblem({ ...draft, textColor: "red;" })).toBe("color");
    expect(
      appearanceProblem({ ...draft, background: "linear-gradient(#fff,#000)" }),
    ).toBeNull();
  });
});
