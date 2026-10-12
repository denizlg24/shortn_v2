# apps/web/src/components/campaigns/utm-builder.tsx

- UtmBuilder · function · L33-L232 — function UtmBuilder({ workspace, campaign, links, initialLink, canSave, action, cancelHref, }: { workspace: string; campaign: Pick<CampaignView, "title" | "utmDefaults">; /** The campaign's links, offered first in the picker. */ links: LinkView[]; initialLink: LinkView | null; canSave: boolean; action: (state: FormState, form: FormData) => Promise<FormState>; cancelHref: string; })
- set · function · L93-L96 — set = (field: BuilderField, value: string)
