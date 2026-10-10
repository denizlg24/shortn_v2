import type { LinkView } from "@shortn/core";
import type {
  createLinkAction,
  setLinkUtmAction,
  updateLinkAction,
} from "@/server/actions/links";

export type CreateInput = Parameters<typeof createLinkAction>[1];
export type UpdateInput = Parameters<typeof updateLinkAction>[2];
export type UtmInput = Parameters<typeof setLinkUtmAction>[2];

export const utmFields = [
  "source",
  "medium",
  "campaign",
  "term",
  "content",
] as const;
export type UtmField = (typeof utmFields)[number];
export type UtmDraft = Record<UtmField, string>;

export const utmMaxLength: Record<UtmField, number> = {
  source: 100,
  medium: 100,
  campaign: 80,
  term: 100,
  content: 100,
};
export const maxUtmVariants = 50;

export interface LinkDraft {
  url: string;
  key: string;
  title: string;
  description: string;
  tags: string[];
  /** A new password; empty keeps the current one. */
  password: string;
  passwordHint: string;
  removePassword: boolean;
  utm: UtmDraft[];
}

export const emptyUtm: UtmDraft = {
  source: "",
  medium: "",
  campaign: "",
  term: "",
  content: "",
};

export function emptyDraft(seed: Partial<LinkDraft> = {}): LinkDraft {
  return {
    url: "",
    key: "",
    title: "",
    description: "",
    tags: [],
    password: "",
    passwordHint: "",
    removePassword: false,
    utm: [],
    ...seed,
  };
}

export function draftFromLink(link: LinkView): LinkDraft {
  return emptyDraft({
    url: link.url,
    key: link.key,
    title: link.title,
    description: link.description ?? "",
    tags: link.tags.map((tag) => tag.name),
    passwordHint: link.password?.hint ?? "",
    utm: link.utm.map((variant) => ({
      source: variant.source ?? "",
      medium: variant.medium ?? "",
      campaign: variant.campaign ?? "",
      term: variant.term ?? "",
      content: variant.content ?? "",
    })),
  });
}

const optional = (value: string) => value.trim() || undefined;

export function createInput(draft: LinkDraft): CreateInput {
  const password = draft.password || undefined;
  return {
    url: draft.url.trim(),
    key: optional(draft.key),
    title: optional(draft.title),
    description: optional(draft.description),
    tags: draft.tags.length ? draft.tags : undefined,
    password,
    passwordHint: password ? optional(draft.passwordHint) : undefined,
  };
}

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/** Only the fields that changed, so an untouched gated field never trips its plan check. */
export function linkPatch(link: LinkView, draft: LinkDraft): UpdateInput {
  const patch: UpdateInput = {};
  const url = draft.url.trim();
  if (url && url !== link.url) patch.url = url;
  const key = draft.key.trim();
  if (key && key !== link.key) patch.key = key;
  if (draft.title.trim() !== link.title.trim())
    patch.title = draft.title.trim();
  const description = draft.description.trim() || null;
  if (description !== (link.description ?? null))
    patch.description = description;
  if (
    !sameList(
      draft.tags,
      link.tags.map((tag) => tag.name),
    )
  )
    patch.tags = draft.tags;
  const hint = draft.passwordHint.trim() || null;
  if (draft.removePassword) patch.removePassword = true;
  else if (draft.password) {
    patch.password = draft.password;
    patch.passwordHint = hint;
  } else if (link.password && hint !== link.password.hint)
    patch.passwordHint = hint;
  return patch;
}

export function cleanUtm(variants: UtmDraft[]): UtmDraft[] {
  return variants
    .map((variant) => ({
      source: variant.source.trim(),
      medium: variant.medium.trim(),
      campaign: variant.campaign.trim(),
      term: variant.term.trim(),
      content: variant.content.trim(),
    }))
    .filter((variant) => utmFields.some((field) => variant[field]));
}

export function utmInput(variants: UtmDraft[]): UtmInput {
  return cleanUtm(variants).map((variant) => ({
    source: optional(variant.source),
    medium: optional(variant.medium),
    campaign: optional(variant.campaign),
    term: optional(variant.term),
    content: optional(variant.content),
  }));
}

export function utmChanged(link: LinkView | null, draft: LinkDraft): boolean {
  const before = link ? cleanUtm(draftFromLink(link).utm) : [];
  return JSON.stringify(before) !== JSON.stringify(cleanUtm(draft.utm));
}

export function utmView(variants: UtmDraft[]): LinkView["utm"] {
  return cleanUtm(variants).map((variant) => ({
    source: variant.source || null,
    medium: variant.medium || null,
    campaign: variant.campaign || null,
    term: variant.term || null,
    content: variant.content || null,
  }));
}

/** The query string a variant appends, e.g. `?utm_source=newsletter&utm_medium=email`. */
export function utmQuery(variant: UtmDraft): string {
  const params = new URLSearchParams();
  for (const field of utmFields) {
    const value = variant[field].trim();
    if (value) params.set(`utm_${field}`, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
