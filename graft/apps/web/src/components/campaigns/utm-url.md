# apps/web/src/components/campaigns/utm-url.ts

- BuilderField · type · L4-L4 — type BuilderField = (typeof builderFields)[number];
- BuilderValues · type · L5-L5 — type BuilderValues = Record<BuilderField, string>;
- taggedUrl · function · L19-L35 — function taggedUrl( link: Pick<LinkView, "domain" | "key">, campaign: string, values: BuilderValues, ): string
- set · function · L25-L28 — set = (name: string, value: string)
- Variant · type · L37-L37 — type Variant = LinkView["utm"][number];
- same · function · L39-L39 — same = (a: string | null, b: string)
- hasVariant · function · L42-L55 — function hasVariant( link: Pick<LinkView, "utm">, campaign: string, values: BuilderValues, ): boolean
- VariantInput · type · L65-L65 — type VariantInput = Partial<Record<(typeof variantKeys)[number], string>>;
- toInput · function · L67-L74 — toInput = (variant: Variant): VariantInput
- withVariant · function · L77-L92 — function withVariant( link: Pick<LinkView, "utm">, campaign: string, values: BuilderValues, ): VariantInput[]
