import type { BioBlock } from "@shortn/core/bio-content";

type LinksBlock = Extract<BioBlock, { type: "links" }>;

/** The fields a style preset sets; layout and pagination stay as they are. */
export type LinkStyle = Pick<
  LinksBlock,
  | "cardStyle"
  | "cardContent"
  | "cardRadius"
  | "imageFit"
  | "linkSurface"
  | "linkBorder"
  | "linkWeight"
  | "linkSpacing"
  | "showLinkArrow"
>;

const list = {
  cardStyle: "list",
  cardContent: "image-text",
  imageFit: "cover",
  linkSpacing: "comfortable",
  showLinkArrow: true,
} as const;
const cards = {
  cardContent: "image-text",
  cardRadius: "rounded",
  imageFit: "cover",
  linkWeight: "medium",
  linkSpacing: "comfortable",
  showLinkArrow: false,
} as const;

/** Ready-made looks, in the order the picker shows them. "buttons" is the
 * section default, so untouched sections show it as selected. */
export const linkStylePresets = {
  buttons: {
    ...list,
    cardRadius: "theme",
    linkSurface: "theme",
    linkBorder: "theme",
    linkWeight: "theme",
  },
  outline: {
    ...list,
    cardRadius: "theme",
    linkSurface: "outline",
    linkBorder: "theme",
    linkWeight: "medium",
  },
  soft: {
    ...list,
    cardRadius: "theme",
    linkSurface: "soft",
    linkBorder: "none",
    linkWeight: "medium",
  },
  minimal: {
    ...list,
    cardRadius: "theme",
    linkSurface: "minimal",
    linkBorder: "divider",
    linkWeight: "regular",
    linkSpacing: "compact",
  },
  cards: {
    ...cards,
    cardStyle: "small-grid",
    linkSurface: "soft",
    linkBorder: "none",
  },
  largeCards: {
    ...cards,
    cardStyle: "large-grid",
    linkSurface: "soft",
    linkBorder: "subtle",
  },
  gallery: {
    ...cards,
    cardStyle: "image-grid",
    linkSurface: "soft",
    linkBorder: "none",
  },
  imageOnly: {
    ...cards,
    cardStyle: "large-grid",
    cardContent: "image-only",
    linkSurface: "soft",
    linkBorder: "none",
  },
} as const satisfies Record<string, LinkStyle>;

export type LinkStylePreset = keyof typeof linkStylePresets;
export const linkStylePresetNames = Object.keys(
  linkStylePresets,
) as LinkStylePreset[];

/** The preset a section currently matches exactly, if any. */
export function matchingLinkStyle(block: LinksBlock): LinkStylePreset | null {
  return (
    linkStylePresetNames.find((name) => {
      const preset: LinkStyle = linkStylePresets[name];
      return (Object.keys(preset) as (keyof LinkStyle)[]).every(
        (key) => block[key] === preset[key],
      );
    }) ?? null
  );
}
