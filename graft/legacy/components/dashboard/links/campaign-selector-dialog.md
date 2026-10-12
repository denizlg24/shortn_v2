# legacy/components/dashboard/links/campaign-selector-dialog.tsx

- Campaign · type · L44-L50 — type Campaign = { _id: string; title: string; linksCount: number; description?: string; utmDefaults?: IUtmDefaults; };
- getUtmDefaultsCount · function · L52-L60 — getUtmDefaultsCount = (utmDefaults?: IUtmDefaults): number
- CampaignSelectorDialog · function · L62-L399 — CampaignSelectorDialog = ({ selectedCampaign, onSelect, trigger, }: { selectedCampaign?: { _id: unknown; title: string }; onSelect: (campaign: { _id: string; title: string } | undefined) => void; trigger?: ReactNode; })
- loadCampaigns · function · L93-L100 — loadCampaigns = async ()
- handleCreateNew · function · L107-L158 — handleCreateNew = async ()
- handleSelectExisting · function · L160-L170 — handleSelectExisting = (campaign: Campaign)
