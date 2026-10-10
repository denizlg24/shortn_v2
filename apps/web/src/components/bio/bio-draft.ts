import type { BioEditable } from "@shortn/core";
import {
  isColor,
  isHttpUrl,
  withScheme,
  type AvatarShape,
  type BioTheme,
  type ButtonStyle,
  type HeaderStyle,
} from "./bio-rules";

export interface ProfileDraft {
  title: string;
  description: string;
  avatarUrl: string;
  avatarShape: AvatarShape;
}

export interface LinkItem {
  linkId: string;
  key: string;
  url: string;
  title: string;
  image: string;
}

export interface SocialItem {
  /** Client-side identity for list keys; never saved. */
  id: string;
  platform: string;
  url: string;
}

export interface AppearanceDraft {
  background: string;
  textColor: string;
  primaryColor: string;
  buttonTextColor: string;
  buttonStyle: ButtonStyle | undefined;
  font: string;
  header: HeaderStyle | "none";
  headerBackgroundColor: string;
  headerBackgroundImage: string;
  socialColor: string;
  /** Theme fields the editor doesn't show (legacy font sizes), kept on save. */
  rest: BioTheme;
}

let socialSeed = 0;
export const socialId = () => `social-${++socialSeed}`;

export const profileOf = (bio: BioEditable): ProfileDraft => ({
  title: bio.title,
  description: bio.description,
  avatarUrl: bio.avatarUrl ?? "",
  avatarShape: bio.avatarShape,
});

export const linksOf = (bio: BioEditable): LinkItem[] =>
  bio.links.map((link) => ({
    linkId: link.linkId,
    key: link.key,
    url: link.url,
    title: link.title,
    image: link.image ?? "",
  }));

export const socialsOf = (bio: BioEditable): SocialItem[] =>
  bio.socials.map((social) => ({ id: socialId(), ...social }));

export function appearanceOf(bio: BioEditable): AppearanceDraft {
  const {
    background,
    textColor,
    primaryColor,
    buttonTextColor,
    buttonStyle,
    font,
    header,
    ...rest
  } = bio.theme;
  return {
    background: background ?? "",
    textColor: textColor ?? "",
    primaryColor: primaryColor ?? "",
    buttonTextColor: buttonTextColor ?? "",
    buttonStyle,
    font: font ?? "",
    header: header?.headerStyle ?? "none",
    headerBackgroundColor: header?.headerBackgroundColor ?? "",
    headerBackgroundImage: header?.headerBackgroundImage ?? "",
    socialColor: bio.socialColor || "original",
    rest,
  };
}

const json = (value: unknown) => JSON.stringify(value);
export const sameProfile = (a: ProfileDraft, b: ProfileDraft) =>
  json(a) === json(b);
export const sameLinks = (a: LinkItem[], b: LinkItem[]) =>
  json(a.map(({ linkId, title, image }) => [linkId, title, image])) ===
  json(b.map(({ linkId, title, image }) => [linkId, title, image]));
export const sameSocials = (a: SocialItem[], b: SocialItem[]) =>
  json(a.map(({ platform, url }) => [platform, url])) ===
  json(b.map(({ platform, url }) => [platform, url]));
export const sameAppearance = (a: AppearanceDraft, b: AppearanceDraft) =>
  json(a) === json(b);

/** Only what changed; an empty description or avatar clears it. */
export function profilePatch(saved: ProfileDraft, draft: ProfileDraft) {
  const patch: Partial<ProfileDraft> = {};
  if (draft.title.trim() !== saved.title) patch.title = draft.title.trim();
  if (draft.description.trim() !== saved.description)
    patch.description = draft.description.trim();
  if (draft.avatarUrl.trim() !== saved.avatarUrl)
    patch.avatarUrl = draft.avatarUrl.trim();
  if (draft.avatarShape !== saved.avatarShape)
    patch.avatarShape = draft.avatarShape;
  return patch;
}

// Legacy's public page shows the stored per-link title and nothing else,
// so every link is saved with one.
export const linksInput = (items: LinkItem[]) =>
  items.map((item) => ({
    linkId: item.linkId,
    title: item.title.trim() || item.key,
    ...(item.image.trim() ? { image: item.image.trim() } : {}),
  }));

export const socialsInput = (items: SocialItem[]) =>
  items.map((item) => ({
    platform: item.platform,
    url: withScheme(item.url),
  }));

/** The whole theme: the server replaces it, and unset values are left out. */
export function themeOf(draft: AppearanceDraft): BioTheme {
  const theme: BioTheme = { ...draft.rest };
  const background = draft.background.trim();
  const textColor = draft.textColor.trim();
  const primaryColor = draft.primaryColor.trim();
  const buttonTextColor = draft.buttonTextColor.trim();
  const font = draft.font.trim();
  if (background) theme.background = background;
  if (textColor) theme.textColor = textColor;
  if (primaryColor) theme.primaryColor = primaryColor;
  if (buttonTextColor) theme.buttonTextColor = buttonTextColor;
  if (font) theme.font = font;
  if (draft.buttonStyle) theme.buttonStyle = draft.buttonStyle;
  if (draft.header !== "none") {
    const color = draft.headerBackgroundColor.trim();
    const image = draft.headerBackgroundImage.trim();
    theme.header = {
      headerStyle: draft.header,
      ...(color ? { headerBackgroundColor: color } : {}),
      ...(image ? { headerBackgroundImage: image } : {}),
    };
  }
  return theme;
}

export type ProfileProblem = "titleRequired" | "avatarUrl";
export function profileProblem(draft: ProfileDraft): ProfileProblem | null {
  if (!draft.title.trim()) return "titleRequired";
  const avatar = draft.avatarUrl.trim();
  if (avatar && !isHttpUrl(avatar)) return "avatarUrl";
  return null;
}

/** Index of the first link whose image isn't a web URL. */
export const badLinkImage = (items: LinkItem[]) =>
  items.findIndex(
    (item) => item.image.trim() !== "" && !isHttpUrl(item.image.trim()),
  );

/** Index of the first social without a usable URL. */
export const badSocial = (items: SocialItem[]) =>
  items.findIndex(
    (item) => !item.url.trim() || !isHttpUrl(withScheme(item.url)),
  );

export type AppearanceProblem = "color" | "headerImage" | "background";
export function appearanceProblem(
  draft: AppearanceDraft,
): AppearanceProblem | null {
  const colors = [
    draft.textColor,
    draft.primaryColor,
    draft.buttonTextColor,
    draft.header === "none" ? "" : draft.headerBackgroundColor,
    draft.socialColor === "original" ? "" : draft.socialColor,
  ];
  if (colors.some((color) => color.trim() && !isColor(color.trim())))
    return "color";
  if (draft.background.trim().length > 512) return "background";
  const image = draft.headerBackgroundImage.trim();
  if (draft.header !== "none" && image && !isHttpUrl(image))
    return "headerImage";
  return null;
}
