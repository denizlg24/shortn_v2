# apps/web/src/server/actions/qr.ts

- listQrsAction · function · L33-L40 — async function listQrsAction( workspace: string, search?: string, ): Promise<QrView[]>
- getQrAction · function · L42-L48 — async function getQrAction( workspace: string, id: string, ): Promise<ActionResult<QrView>>
- createQrAction · function · L50-L57 — async function createQrAction( workspace: string, input: z.input<typeof createInput>, ): Promise<ActionResult<QrView>>
- updateQrAction · function · L59-L69 — async function updateQrAction( workspace: string, id: string, input: z.input<typeof updateInput>, ): Promise<ActionResult<QrView>>
- deleteQrsAction · function · L71-L78 — async function deleteQrsAction( workspace: string, ids: string[], ): Promise<ActionResult<{ deleted: string[] }>>
