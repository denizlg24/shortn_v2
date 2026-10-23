"use client";
import { useId, useSyncExternalStore, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import {
  bioPresets,
  newBioLinksSection,
  type BioBlock,
  type BioContent,
  type BioLinkItem,
  type BioResolvedLink,
} from "@shortn/core/bio-content";
import { BioRenderer } from "./public/bio-renderer";
import {
  linkStylePresetNames,
  linkStylePresets,
  matchingLinkStyle,
  type LinkStyle,
} from "./link-style";

type LinksBlock = Extract<BioBlock, { type: "links" }>;

const sampleId = (n: number) => `00000000000000000000000${n}`;
const sampleHref = "https://shortn.at/";
const sampleImages = [1, 2, 3, 4].map((n) => `/bio-samples/sample-${n}.svg`);

/** Bio images must be absolute URLs, so samples wait for the client origin. */
const useOrigin = () =>
  useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );

/**
 * A small live render of what a choice looks like on the page: the real
 * renderer, the page's theme and the section's own links, scaled down.
 */
function StyleTile({
  label,
  checked,
  content,
  links,
  onSelect,
}: {
  label: string;
  checked: boolean;
  content: BioContent;
  links: Record<string, BioResolvedLink>;
  onSelect: () => void;
}) {
  const p = useTranslations("bio.public");
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className="studio-style-tile"
    >
      <span
        className="studio-style-thumb"
        style={{ background: content.theme.background } as CSSProperties}
        aria-hidden
        inert
      >
        <span className="studio-style-render">
          <BioRenderer
            content={content}
            links={links}
            preview
            labels={{
              branding: "",
              loadEmbed: p.raw("loadEmbed"),
              embedConsent: p.raw("embedConsent"),
              unavailable: p("unavailable"),
            }}
          />
        </span>
      </span>
      <span className="studio-style-name">
        <span className="min-w-0 truncate">{label}</span>
        {checked ? <Check aria-hidden className="size-3.5 shrink-0" /> : null}
      </span>
    </button>
  );
}

/**
 * Up to `count` of the section's visible links, padded with samples. With an
 * image origin, links without an image borrow a sample so image layouts
 * show what they do.
 */
function sampleLinks(
  block: LinksBlock,
  links: Record<string, BioResolvedLink>,
  count: number,
  fallback: string,
  imageOrigin = "",
) {
  const items: BioLinkItem[] = block.items
    .filter((item) => item.visible && links[item.linkId])
    .slice(0, count);
  const resolved: Record<string, BioResolvedLink> = {};
  for (const item of items) resolved[item.linkId] = links[item.linkId]!;
  for (let n = items.length; n < count; n++) {
    items.push({
      id: `sample-${n}`,
      linkId: sampleId(n),
      title: "",
      visible: true,
      image: "",
      highlight: false,
    });
    resolved[sampleId(n)] = { href: sampleHref, title: fallback };
  }
  return {
    items: imageOrigin
      ? items.map((item, at) =>
          item.image
            ? item
            : { ...item, image: `${imageOrigin}${sampleImages[at % 4]}` },
        )
      : items,
    resolved,
  };
}

const tileCount = (style: LinkStyle) =>
  style.cardContent === "image-only"
    ? 4
    : style.cardStyle === "large-grid" || style.cardStyle === "image-grid"
      ? 2
      : 3;

export function LinkStylePicker({
  block,
  content,
  links,
  onSelect,
}: {
  block: LinksBlock;
  content: BioContent;
  links: Record<string, BioResolvedLink>;
  onSelect: (style: LinkStyle) => void;
}) {
  const t = useTranslations("bio.editor.style");
  const labelId = useId();
  const origin = useOrigin();
  const current = matchingLinkStyle(block);
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span id={labelId} className="text-small font-medium">
          {t("title")}
        </span>
        {current ? null : (
          <span className="text-meta text-fg-muted">{t("custom")}</span>
        )}
      </div>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="studio-style-grid"
      >
        {linkStylePresetNames.map((name) => {
          const style: LinkStyle = linkStylePresets[name];
          const { items, resolved } = sampleLinks(
            block,
            links,
            tileCount(style),
            t("sampleLink"),
            style.cardStyle === "list" ? "" : origin,
          );
          return (
            <StyleTile
              key={name}
              label={t(`presets.${name}`)}
              checked={current === name}
              links={resolved}
              content={{
                ...content,
                hideBranding: true,
                blocks: [
                  {
                    ...block,
                    ...style,
                    title: "",
                    layout: "vertical",
                    showLinkCount: false,
                    items,
                  },
                ],
              }}
              onSelect={() => onSelect(style)}
            />
          );
        })}
      </div>
    </div>
  );
}

const colorKeys = ["background", "surface", "text", "accent"] as const;
const paletteNames = [
  "paper",
  "ink",
  "clay",
  "forest",
  "ocean",
  "plum",
  "rose",
  "sand",
  "slate",
  "cobalt",
  "charcoal",
  "mint",
] as const;

/** Colour palettes keep the page's font, corners and button style. */
export function ThemePalettePicker({
  content,
  links,
  onSelect,
}: {
  content: BioContent;
  links: Record<string, BioResolvedLink>;
  onSelect: (
    colors: Pick<BioContent["theme"], (typeof colorKeys)[number]>,
  ) => void;
}) {
  const t = useTranslations("bio.editor.style");
  const labelId = useId();
  const section =
    content.blocks.find(
      (block): block is LinksBlock => block.type === "links",
    ) ?? newBioLinksSection("palette-links");
  const profile = content.blocks[0];
  const sample = sampleLinks(section, links, 2, t("sampleLink"));
  return (
    <div className="grid gap-2">
      <span id={labelId} className="text-small font-medium">
        {t("palette")}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="studio-style-grid"
      >
        {paletteNames.map((name) => {
          const preset = bioPresets[name]!;
          const colors = {
            background: preset.background,
            surface: preset.surface,
            text: preset.text,
            accent: preset.accent,
          };
          return (
            <StyleTile
              key={name}
              label={t(`palettes.${name}`)}
              checked={colorKeys.every(
                (key) => content.theme[key] === colors[key],
              )}
              links={sample.resolved}
              content={{
                ...content,
                theme: { ...content.theme, ...colors },
                hideBranding: true,
                blocks: [
                  ...(profile?.type === "profile"
                    ? [{ ...profile, avatar: "", description: "" }]
                    : []),
                  {
                    ...section,
                    title: "",
                    layout: "vertical",
                    showLinkCount: false,
                    items: sample.items,
                  },
                ],
              }}
              onSelect={() => onSelect(colors)}
            />
          );
        })}
      </div>
    </div>
  );
}

type ProfileBlock = Extract<BioBlock, { type: "profile" }>;
export type ProfileLayout = Pick<ProfileBlock, "align" | "avatarShape">;

export const profileLayouts = {
  centered: { align: "center", avatarShape: "circle" },
  centeredRounded: { align: "center", avatarShape: "rounded" },
  left: { align: "left", avatarShape: "circle" },
  leftSquare: { align: "left", avatarShape: "square" },
  right: { align: "right", avatarShape: "rounded" },
} as const satisfies Record<string, ProfileLayout>;
const profileLayoutNames = Object.keys(
  profileLayouts,
) as (keyof typeof profileLayouts)[];

/** Profile header layouts, drawn with the page's own name, bio and avatar. */
export function ProfileLayoutPicker({
  profile,
  content,
  onSelect,
}: {
  profile: ProfileBlock;
  content: BioContent;
  onSelect: (layout: ProfileLayout) => void;
}) {
  const t = useTranslations("bio.editor.style");
  const labelId = useId();
  const origin = useOrigin();
  const sample: ProfileBlock = {
    ...profile,
    avatar: profile.avatar || (origin ? `${origin}${sampleImages[1]}` : ""),
    description: profile.description || t("sampleBio"),
  };
  return (
    <div className="grid gap-2">
      <span id={labelId} className="text-small font-medium">
        {t("layout")}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="studio-style-grid"
      >
        {profileLayoutNames.map((name) => {
          const layout: ProfileLayout = profileLayouts[name];
          return (
            <StyleTile
              key={name}
              label={t(`profiles.${name}`)}
              checked={
                profile.align === layout.align &&
                profile.avatarShape === layout.avatarShape
              }
              links={{}}
              content={{
                ...content,
                hideBranding: true,
                blocks: [{ ...sample, ...layout }],
              }}
              onSelect={() => onSelect(layout)}
            />
          );
        })}
      </div>
    </div>
  );
}

type ThemeStyle = Pick<
  BioContent["theme"],
  "buttonStyle" | "radius" | "font" | "density"
>;
export const themeStyles = {
  classic: {
    buttonStyle: "fill",
    radius: 12,
    font: "Geist",
    density: "comfortable",
  },
  pill: {
    buttonStyle: "fill",
    radius: 999,
    font: "Inter",
    density: "comfortable",
  },
  outline: {
    buttonStyle: "outline",
    radius: 6,
    font: "DM Sans",
    density: "comfortable",
  },
  soft: {
    buttonStyle: "soft",
    radius: 12,
    font: "Poppins",
    density: "comfortable",
  },
  sharp: {
    buttonStyle: "fill",
    radius: 0,
    font: "Space Grotesk",
    density: "compact",
  },
  editorial: {
    buttonStyle: "outline",
    radius: 0,
    font: "Source Serif 4",
    density: "comfortable",
  },
} as const satisfies Record<string, ThemeStyle>;
const themeStyleNames = Object.keys(
  themeStyles,
) as (keyof typeof themeStyles)[];

/**
 * Button shape, corners, font and spacing together. Previews use plain
 * buttons, since section styles other than "Buttons" ignore the theme's
 * button style.
 */
export function ThemeStylePicker({
  content,
  links,
  onSelect,
}: {
  content: BioContent;
  links: Record<string, BioResolvedLink>;
  onSelect: (style: ThemeStyle) => void;
}) {
  const t = useTranslations("bio.editor.style");
  const labelId = useId();
  const section =
    content.blocks.find(
      (block): block is LinksBlock => block.type === "links",
    ) ?? newBioLinksSection("style-links");
  const profile = content.blocks[0];
  const sample = sampleLinks(section, links, 2, t("sampleLink"));
  return (
    <div className="grid gap-2">
      <span id={labelId} className="text-small font-medium">
        {t("themeStyle")}
      </span>
      <p className="text-small text-fg-muted">{t("themeStyleHint")}</p>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="studio-style-grid"
      >
        {themeStyleNames.map((name) => {
          const style: ThemeStyle = themeStyles[name];
          return (
            <StyleTile
              key={name}
              label={t(`themes.${name}`)}
              checked={(Object.keys(style) as (keyof ThemeStyle)[]).every(
                (key) => content.theme[key] === style[key],
              )}
              links={sample.resolved}
              content={{
                ...content,
                theme: { ...content.theme, ...style, legacyFont: undefined },
                hideBranding: true,
                blocks: [
                  ...(profile?.type === "profile"
                    ? [{ ...profile, avatar: "", description: "" }]
                    : []),
                  {
                    ...section,
                    ...linkStylePresets.buttons,
                    title: "",
                    layout: "vertical",
                    showLinkCount: false,
                    items: sample.items,
                  },
                ],
              }}
              onSelect={() => onSelect(style)}
            />
          );
        })}
      </div>
    </div>
  );
}
