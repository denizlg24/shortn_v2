# apps/web/src/server/actions/bio.ts

- listBioPagesAction · function · L18-L22 — async function listBioPagesAction( workspace: string, ): Promise<BioSummary[]>
- getBioPageAction · function · L24-L30 — async function getBioPageAction( workspace: string, id: string, ): Promise<ActionResult<BioEditable>>
- createBioPageAction · function · L32-L47 — async function createBioPageAction( workspace: string, input: { slug: string; title?: string; linkId?: string }, ): Promise<ActionResult<BioSummary>>
- updateBioPageAction · function · L50-L62 — async function updateBioPageAction( workspace: string, id: string, patch: unknown, ): Promise<ActionResult<BioSummary>>
- setBioLinksAction · function · L64-L72 — async function setBioLinksAction( workspace: string, id: string, links: unknown, ): Promise<ActionResult<BioSummary>>
- deleteBioPageAction · function · L74-L81 — async function deleteBioPageAction( workspace: string, id: string, ): Promise<ActionResult<{ slug: string }>>
