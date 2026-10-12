# legacy/components/dashboard/campaigns/campaign-link-utm-editor.tsx

- UtmLink · interface · L56-L65 — interface UtmLink
- CampaignLinkUtmEditorProps · interface · L67-L76 — interface CampaignLinkUtmEditorProps
- buildUrl · function · L78-L93 — function buildUrl(shortUrl: string, utm?: UtmLink): string
- CampaignLinkUtmEditor · function · L95-L707 — function CampaignLinkUtmEditor({ urlCode, linkTitle, longUrl, campaignId, campaignTitle, utmDefaults, initialUtmLinks, onSave, }: CampaignLinkUtmEditorProps)
- handleCopy · function · L139-L144 — handleCopy = async (index: number, url: string)
- getUtmLabel · function · L146-L155 — getUtmLabel = (utm: UtmLink, index: number): string
- hasUtmParams · function · L157-L159 — hasUtmParams = (utm: UtmLink): boolean
- updateUtmField · function · L161-L169 — updateUtmField = ( index: number, field: keyof Omit<UtmLink, "campaign">, value: string, )
- applyDefault · function · L171-L177 — applyDefault = ( index: number, field: keyof Omit<UtmLink, "campaign">, value: string, )
- addUtmVariant · function · L179-L184 — addUtmVariant = ()
- removeUtmVariant · function · L186-L192 — removeUtmVariant = (index: number)
- handleSave · function · L194-L242 — handleSave = async ()
- renderUtmForm · function · L251-L452 — renderUtmForm = (index: number)
