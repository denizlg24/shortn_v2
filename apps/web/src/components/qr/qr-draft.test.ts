import { describe, expect, test } from "bun:test";
import type { QrView } from "@shortn/core";
import { designChanges, designOf, draftOf, draftProblem } from "./qr-draft";

const qr: QrView = {
  id: "q1",
  publicId: "AbC123",
  key: "xYz789",
  shortUrl: "https://shortn.at/xYz789",
  url: "https://example.com/menu",
  title: "Menu",
  tags: [{ id: "t1", name: "print" }],
  scans: 12,
  lastScanAt: null,
  design: {
    width: 300,
    height: 300,
    type: "svg",
    data: "https://shortn.at/xYz789",
    margin: 8,
    image: "",
    dotsOptions: { color: "#1e90ff", type: "rounded" },
    backgroundOptions: { color: "#ffffff" },
    imageOptions: { crossOrigin: "anonymous", margin: 5 },
  },
  storedDesign: {},
  createdBy: null,
  attachedLinkKey: "menu",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("designChanges", () => {
  const initial = draftOf(qr.design);

  test("an untouched draft changes nothing", () => {
    expect(designChanges(qr.design, initial, initial)).toEqual({});
  });

  test("sends only the option group that changed", () => {
    expect(
      designChanges(qr.design, initial, { ...initial, background: "#fafafa" }),
    ).toEqual({ backgroundOptions: { color: "#fafafa" } });
  });

  test("keeps the rest of a changed group", () => {
    const changes = designChanges(qr.design, initial, {
      ...initial,
      dotStyle: "dots",
    });
    expect(changes.dotsOptions).toEqual({ color: "#1e90ff", type: "dots" });
  });

  test("a logo keeps the stored image options", () => {
    const changes = designChanges(qr.design, initial, {
      ...initial,
      logo: "https://example.com/logo.png",
    });
    expect(changes.image).toBe("https://example.com/logo.png");
    expect(changes.imageOptions).toBeUndefined();
  });
});

describe("draftProblem", () => {
  test("refuses a logo that isn't a web URL", () => {
    expect(draftProblem({ ...draftOf(qr.design), logo: "logo.png" })).toBe(
      "logoUrl",
    );
  });

  test("refuses an empty colour", () => {
    expect(draftProblem({ ...draftOf(qr.design), foreground: " " })).toBe(
      "color",
    );
  });
});

describe("designOf", () => {
  test("renders a stored design as stored", () => {
    const design = designOf(qr.design, draftOf(qr.design));
    expect(design.margin).toBe(8);
    expect(design.dotsOptions).toEqual(qr.design.dotsOptions);
    expect(design.cornersSquareOptions).toEqual({});
  });
});
