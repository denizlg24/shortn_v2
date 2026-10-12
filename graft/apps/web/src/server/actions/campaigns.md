# apps/web/src/server/actions/campaigns.ts

- listCampaignsAction · function · L27-L31 — async function listCampaignsAction( workspace: string, ): Promise<CampaignView[]>
- getCampaignAction · function · L33-L50 — async function getCampaignAction( workspace: string, id: string, ): Promise<ActionResult<{ campaign: CampaignView; links: LinkView[] }>>
- createCampaignAction · function · L52-L66 — async function createCampaignAction( workspace: string, input: { title: string; description?: string }, ): Promise<ActionResult<CampaignView>>
- updateCampaignAction · function · L68-L78 — async function updateCampaignAction( workspace: string, id: string, input: z.input<typeof updateInput>, ): Promise<ActionResult<CampaignView>>
- deleteCampaignAction · function · L80-L85 — async function deleteCampaignAction( workspace: string, id: string, ): Promise<ActionResult<null>>
