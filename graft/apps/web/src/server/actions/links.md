# apps/web/src/server/actions/links.ts

- LinkListItem · interface · L22-L24 — interface LinkListItem extends LinkView
- optionalText · function · L27-L27 — optionalText = (max: number)
- withTrends · function · L69-L76 — async function withTrends(db: Db, links: LinkView[]): Promise<LinkListItem[]>
- scanLater · function · L78-L89 — function scanLater(workspace: string, id: string)
- listLinksAction · function · L91-L114 — async function listLinksAction( workspace: string, input: z.input<typeof listInput> = {}, ): Promise< ActionResult<{ links: LinkListItem[]; nextCursor: string | null; total: number | null; }> >
- getLinkAction · function · L116-L123 — async function getLinkAction( workspace: string, id: string, ): Promise<ActionResult<LinkView>>
- createLinkAction · function · L125-L139 — async function createLinkAction( workspace: string, input: z.input<typeof createInput>, ): Promise<ActionResult<LinkListItem>>
- updateLinkAction · function · L141-L152 — async function updateLinkAction( workspace: string, id: string, input: z.input<typeof updateInput>, ): Promise<ActionResult<LinkView>>
- deleteLinksAction · function · L154-L162 — async function deleteLinksAction( workspace: string, ids: string[], ): Promise<ActionResult<{ deleted: string[] }>>
- setLinkUtmAction · function · L164-L173 — async function setLinkUtmAction( workspace: string, id: string, variants: z.input<typeof utmInput>, ): Promise<ActionResult<null>>
- listTagsAction · function · L175-L178 — async function listTagsAction(workspace: string)
