import { describe, expect, test } from "bun:test";
import type { QrView } from "@shortn/core";
import { designOf, draftOf, qrUpdate } from "./qr-draft";

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
  attachedLinkKey: "menu",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("qrUpdate", () => {
  test("an untouched draft changes nothing", () => {
    const initial = draftOf(qr);
    expect(qrUpdate(qr, initial, initial)).toEqual({});
  });

  test("sends only the option group that changed", () => {
    const initial = draftOf(qr);
    const update = qrUpdate(qr, initial, { ...initial, background: "#fafafa" });
    expect(update).toEqual({
      design: { backgroundOptions: { color: "#fafafa" } },
    });
  });

  test("keeps the rest of a changed group", () => {
    const initial = draftOf(qr);
    const update = qrUpdate(qr, initial, { ...initial, dotStyle: "dots" });
    expect(update.design?.dotsOptions).toEqual({
      color: "#1e90ff",
      type: "dots",
    });
  });

  test("applies to the attached link only with a content change", () => {
    const initial = draftOf(qr);
    expect(qrUpdate(qr, initial, { ...initial, applyToLink: true })).toEqual(
      {},
    );
    expect(
      qrUpdate(qr, initial, {
        ...initial,
        applyToLink: true,
        url: "https://example.com/new",
      }),
    ).toEqual({ url: "https://example.com/new", applyToLink: true });
  });

  test("a logo keeps the stored image options", () => {
    const initial = draftOf(qr);
    const update = qrUpdate(qr, initial, {
      ...initial,
      logo: "https://example.com/logo.png",
    });
    expect(update.design?.image).toBe("https://example.com/logo.png");
    expect(update.design?.imageOptions).toBeUndefined();
  });
});

describe("designOf", () => {
  test("renders a stored design as stored", () => {
    const design = designOf(qr.design, draftOf(qr));
    expect(design.margin).toBe(8);
    expect(design.dotsOptions).toEqual(qr.design.dotsOptions);
    expect(design.cornersSquareOptions).toEqual({});
  });
});
