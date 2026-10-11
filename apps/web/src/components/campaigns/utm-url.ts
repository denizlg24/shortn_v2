import type { LinkView } from "@shortn/core";

export const builderFields = ["source", "medium", "term", "content"] as const;
export type BuilderField = (typeof builderFields)[number];
export type BuilderValues = Record<BuilderField, string>;

export const emptyBuilder: BuilderValues = {
  source: "",
  medium: "",
  term: "",
  content: "",
};

/**
 * The short link with UTM tags, in legacy's order. The redirect forwards
 * them, and analytics counts the click for the campaign whose title is
 * utm_campaign.
 */
export function taggedUrl(
  link: Pick<LinkView, "domain" | "key">,
  campaign: string,
  values: BuilderValues,
): string {
  const params = new URLSearchParams();
  const set = (name: string, value: string) => {
    const clean = value.trim();
    if (clean) params.set(name, clean);
  };
  set("utm_source", values.source);
  set("utm_medium", values.medium);
  set("utm_campaign", campaign);
  set("utm_term", values.term);
  set("utm_content", values.content);
  return `https://${link.domain}/${link.key}?${params}`;
}

type Variant = LinkView["utm"][number];

const same = (a: string | null, b: string) => (a ?? "") === b.trim();

/** Whether the link already carries exactly this variant. */
export function hasVariant(
  link: Pick<LinkView, "utm">,
  campaign: string,
  values: BuilderValues,
): boolean {
  return link.utm.some(
    (variant: Variant) =>
      same(variant.campaign, campaign) &&
      same(variant.source, values.source) &&
      same(variant.medium, values.medium) &&
      same(variant.term, values.term) &&
      same(variant.content, values.content),
  );
}

const variantKeys = [
  "source",
  "medium",
  "campaign",
  "term",
  "content",
] as const satisfies readonly (keyof Variant)[];

type VariantInput = Partial<Record<(typeof variantKeys)[number], string>>;

const toInput = (variant: Variant): VariantInput => {
  const input: VariantInput = {};
  for (const key of variantKeys) {
    const value = variant[key]?.trim();
    if (value) input[key] = value;
  }
  return input;
};

/** The link's variants plus a new one, in the shape setLinkUtmAction takes. */
export function withVariant(
  link: Pick<LinkView, "utm">,
  campaign: string,
  values: BuilderValues,
): VariantInput[] {
  return [
    ...link.utm.map(toInput),
    toInput({
      source: values.source,
      medium: values.medium,
      campaign,
      term: values.term,
      content: values.content,
    }),
  ];
}
