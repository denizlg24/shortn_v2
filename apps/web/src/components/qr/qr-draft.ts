import type { QrDesign, QrView } from "@shortn/core";

// qr-code-styling's own values; legacy offered these six for every part and
// "dot" is the library's circular corner.
export const dotStyles = [
  "square",
  "dots",
  "rounded",
  "extra-rounded",
  "classy",
  "classy-rounded",
] as const;
export const cornerStyles = [...dotStyles, "dot"] as const;
export type DotStyle = (typeof dotStyles)[number];
export type CornerStyle = (typeof cornerStyles)[number];

export const errorLevels = ["L", "M", "Q", "H"] as const;
export type ErrorLevel = (typeof errorLevels)[number];

/** Share of the modules each level can restore (qr-code-styling's table). */
export const errorCapacity: Record<ErrorLevel, number> = {
  L: 0.07,
  M: 0.15,
  Q: 0.25,
  H: 0.3,
};

// What qr-code-styling draws when the stored options leave a field out.
export const libraryDefaults = {
  foreground: "#000000",
  background: "#ffffff",
  errorLevel: "Q",
  logoSize: 0.4,
  dotStyle: "square",
} as const satisfies {
  foreground: string;
  background: string;
  errorLevel: ErrorLevel;
  logoSize: number;
  dotStyle: DotStyle;
};

export interface QrDraft {
  url: string;
  title: string;
  tags: string[];
  applyToLink: boolean;
  foreground: string;
  background: string;
  /** null draws that part of the corners in the code colour. */
  cornerSquareColor: string | null;
  cornerDotColor: string | null;
  /** Stored values the editor doesn't offer pass through untouched. */
  dotStyle: string;
  cornerSquareStyle: string | undefined;
  cornerDotStyle: string | undefined;
  errorLevel: ErrorLevel;
  logo: string;
  logoSize: number;
  hideDotsBehindLogo: boolean;
}

export function draftOf(qr: QrView): QrDraft {
  const { design } = qr;
  return {
    url: qr.url,
    title: qr.title,
    tags: qr.tags.map((tag) => tag.name),
    applyToLink: false,
    foreground: design.dotsOptions?.color ?? libraryDefaults.foreground,
    background: design.backgroundOptions?.color ?? libraryDefaults.background,
    cornerSquareColor: design.cornersSquareOptions?.color ?? null,
    cornerDotColor: design.cornersDotOptions?.color ?? null,
    dotStyle: design.dotsOptions?.type ?? libraryDefaults.dotStyle,
    cornerSquareStyle: design.cornersSquareOptions?.type,
    cornerDotStyle: design.cornersDotOptions?.type,
    errorLevel:
      design.qrOptions?.errorCorrectionLevel ?? libraryDefaults.errorLevel,
    logo: design.image ?? "",
    logoSize: design.imageOptions?.imageSize ?? libraryDefaults.logoSize,
    hideDotsBehindLogo: design.imageOptions?.hideBackgroundDots ?? true,
  };
}

const cornerOptions = (type: string | undefined, color: string | null) => ({
  ...(type ? { type } : {}),
  ...(color ? { color } : {}),
});

/** The stored design with the editor's fields applied over it. */
export function designOf(base: QrDesign, draft: QrDraft): QrDesign {
  const logo = draft.logo.trim();
  return {
    ...base,
    image: logo,
    dotsOptions: { color: draft.foreground.trim(), type: draft.dotStyle },
    backgroundOptions: { color: draft.background.trim() },
    cornersSquareOptions: cornerOptions(
      draft.cornerSquareStyle,
      draft.cornerSquareColor?.trim() || null,
    ),
    cornersDotOptions: cornerOptions(
      draft.cornerDotStyle,
      draft.cornerDotColor?.trim() || null,
    ),
    qrOptions: { ...base.qrOptions, errorCorrectionLevel: draft.errorLevel },
    imageOptions: {
      ...base.imageOptions,
      // Without it the logo can't be drawn into a PNG from another origin.
      crossOrigin: base.imageOptions?.crossOrigin ?? "anonymous",
      imageSize: draft.logoSize,
      hideBackgroundDots: draft.hideDotsBehindLogo,
    },
  };
}

// The server merges these onto the stored options key by key, so each one
// is sent whole or not at all.
const editorKeys = [
  "image",
  "dotsOptions",
  "backgroundOptions",
  "cornersSquareOptions",
  "cornersDotOptions",
  "qrOptions",
  "imageOptions",
] as const satisfies readonly (keyof QrDesign)[];

function copyKey<K extends keyof QrDesign>(
  target: QrDesign,
  source: QrDesign,
  key: K,
) {
  target[key] = source[key];
}

/** Only the option groups the user changed; legacy-only options survive. */
export function designPatch(before: QrDesign, after: QrDesign): QrDesign {
  const patch: QrDesign = {};
  for (const key of editorKeys)
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key]))
      copyKey(patch, after, key);
  return patch;
}

const sameTags = (a: string[], b: string[]) =>
  a.length === b.length && a.every((tag, at) => tag === b[at]);

export interface QrUpdate {
  url?: string;
  title?: string;
  tags?: string[];
  design?: QrDesign;
  applyToLink?: boolean;
}

/** What `updateQrAction` needs to turn `qr` into `draft`; empty when clean. */
export function qrUpdate(qr: QrView, initial: QrDraft, draft: QrDraft) {
  const update: QrUpdate = {};
  if (draft.url.trim() !== qr.url) update.url = draft.url.trim();
  if (draft.title.trim() !== qr.title) update.title = draft.title.trim();
  if (!sameTags(draft.tags, initial.tags)) update.tags = draft.tags;
  const design = designPatch(
    designOf(qr.design, initial),
    designOf(qr.design, draft),
  );
  if (Object.keys(design).length) update.design = design;
  if (
    draft.applyToLink &&
    (update.url !== undefined ||
      update.title !== undefined ||
      update.tags !== undefined)
  )
    update.applyToLink = true;
  return update;
}
