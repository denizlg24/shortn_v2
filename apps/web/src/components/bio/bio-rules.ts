import type { BioEditable } from "@shortn/core";

export type BioTheme = BioEditable["theme"];
export type AvatarShape = BioEditable["avatarShape"];
export type ButtonStyle = NonNullable<BioTheme["buttonStyle"]>;
export type HeaderStyle = NonNullable<BioTheme["header"]>["headerStyle"];

// packages/core enforces the same (DNS-label rules, slugs become
// {handle}.shortn.at in P5) plus reserved words; it can't be imported here
// without pulling in Mongo.
const slugPattern = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/;
export const slugMaxLength = 63;
export const isBioSlug = (value: string) => slugPattern.test(value);

/** Lowercase while typing; spaces become hyphens so pasted names still fit. */
export const normalizeSlug = (value: string) =>
  value.toLowerCase().replace(/\s+/g, "-").slice(0, slugMaxLength);

export const publicPath = (slug: string) => `/b/${slug}`;

// bioPatchSchema's colour rule: hex, a CSS name or rgb()/rgba().
const colorPattern = /^(#[0-9a-fA-F]{3,8}|[a-z]+|rgba?\([\d\s.,%]+\))$/;
export const isColor = (value: string) =>
  value.length <= 32 && colorPattern.test(value);

export const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

/** Legacy accepted bare hosts for socials and prefixed https://. */
export const withScheme = (value: string) => {
  const trimmed = value.trim();
  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

// What legacy's public page draws when a field is unset (bio-page-display).
export const legacyDefaults = {
  background: "#ffffff",
  textColor: "#000000",
  primaryColor: "#0f172b",
  buttonTextColor: "#ffffff",
  headerBackgroundColor: "#0f172b",
} as const;

export const avatarShapes = [
  "circle",
  "rounded",
  "square",
] as const satisfies readonly AvatarShape[];
export const buttonStyles = [
  "rounded",
  "pill",
  "square",
] as const satisfies readonly ButtonStyle[];
export const headerStyles = [
  "centered",
  "left-aligned",
  "right-aligned",
] as const satisfies readonly HeaderStyle[];

/** Google Fonts families the public page loads by name. */
export const fonts = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "DM Sans",
  "Space Grotesk",
  "Nunito",
  "Raleway",
  "Playfair Display",
  "Merriweather",
  "Lora",
  "Oswald",
] as const;

export const platforms = [
  "instagram",
  "twitter",
  "github",
  "facebook",
  "youtube",
  "linkedin",
  "whatsapp",
  "website",
] as const;
export type Platform = (typeof platforms)[number];

export const maxBioLinks = 100;
export const maxSocials = 20;
