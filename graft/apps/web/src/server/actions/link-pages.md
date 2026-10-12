# apps/web/src/server/actions/link-pages.ts

- FormState · interface · L22-L26 — interface FormState
- text · function · L28-L31 — text = (form: FormData, name: string)
- tagsFrom · function · L34-L43 — tagsFrom = (form: FormData)
- scanLater · function · L53-L64 — function scanLater(workspace: string, id: string)
- createLinkPageAction · function · L66-L91 — async function createLinkPageAction( workspace: string, _state: FormState, form: FormData, ): Promise<FormState>
- updateLinkPageAction · function · L93-L130 — async function updateLinkPageAction( workspace: string, id: string, _state: FormState, form: FormData, ): Promise<FormState>
- deleteLinksPageAction · function · L137-L145 — async function deleteLinksPageAction( workspace: string, linkIds: string[], ): Promise<{ error: string | null }>
- utmField · function · L147-L148 — utmField = (form: FormData, name: string, max: number)
- saveUtmVariantAction · function · L151-L198 — async function saveUtmVariantAction( workspace: string, id: string, index: number | null, expected: UtmVariant[] | null, _state: FormState, form: FormData, ): Promise<FormState>
- removeUtmVariantAction · function · L200-L219 — async function removeUtmVariantAction( workspace: string, id: string, index: number, expected: UtmVariant[], _state: FormState, ): Promise<FormState>
