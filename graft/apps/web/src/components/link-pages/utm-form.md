# apps/web/src/components/link-pages/utm-form.tsx

- UtmValues · type · L19-L19 — type UtmValues = Record<(typeof fields)[number][0], string>;
- UtmForm · function · L21-L99 — function UtmForm({ initial, campaigns, action, cancelHref, }: { initial: UtmValues; campaigns: Pick<CampaignView, "title" | "utmDefaults">[]; action: (state: FormState, form: FormData) => Promise<FormState>; cancelHref: string; })
