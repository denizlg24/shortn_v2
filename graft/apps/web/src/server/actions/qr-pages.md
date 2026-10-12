# apps/web/src/server/actions/qr-pages.ts

- failed · function · L28-L31 — failed = ( error: string, detail?: Record<string, string | number | null>, ): FormState
- colorsOf · function · L35-L40 — colorsOf = (design: QrDesign)
- designFrom · function · L44-L55 — function designFrom( form: FormData, ): { ok: true; design: QrDesign } | { ok: false; error: string }
- linkId · function · L57-L57 — linkId = (form: FormData)
- createQrPageAction · function · L59-L78 — async function createQrPageAction( workspace: string, _state: FormState, form: FormData, ): Promise<FormState>
- sameTags · function · L80-L81 — sameTags = (a: string[], b: string[])
- updateQrDetailsPageAction · function · L83-L110 — async function updateQrDetailsPageAction( workspace: string, id: string, _state: FormState, form: FormData, ): Promise<FormState>
- saveQrDesignPageAction · function · L112-L127 — async function saveQrDesignPageAction( workspace: string, id: string, _state: FormState, form: FormData, ): Promise<FormState>
- deleteQrsPageAction · function · L129-L139 — async function deleteQrsPageAction( workspace: string, ids: string[], ): Promise<{ error: string | null }>
