# apps/web/src/server/actions/bio-pages.ts

- failed · function · L50-L53 — failed = ( error: string, detail?: Record<string, string | number | null>, ): FormState
- checkBioSlugAction · function · L55-L61 — async function checkBioSlugAction( workspace: string, slug: string, ): Promise<"available" | "invalid" | "taken">
- createBioPageAction · function · L63-L77 — async function createBioPageAction( workspace: string, _state: FormState, form: FormData, ): Promise<FormState>
- saved · function · L79-L87 — async function saved( workspace: string, id: string, slug: string, tab: string, ): Promise<never>
- saveBioProfileAction · function · L89-L114 — async function saveBioProfileAction( workspace: string, id: string, _state: FormState, form: FormData, ): Promise<FormState>
- saveBioLinksAction · function · L128-L150 — async function saveBioLinksAction( workspace: string, id: string, _state: FormState, form: FormData, ): Promise<FormState>
- saveBioSocialsAction · function · L162-L182 — async function saveBioSocialsAction( workspace: string, id: string, _state: FormState, form: FormData, ): Promise<FormState>
- saveBioAppearanceAction · function · L197-L223 — async function saveBioAppearanceAction( workspace: string, id: string, _state: FormState, form: FormData, ): Promise<FormState>
- deleteBioPageAction · function · L225-L233 — async function deleteBioPageAction( workspace: string, id: string, ): Promise<{ error: string | null }>
