# apps/web/src/components/bio/bio-appearance-form.tsx

- ColorKey · type · L34-L39 — type ColorKey = | "background" | "textColor" | "primaryColor" | "buttonTextColor" | "headerBackgroundColor";
- BioAppearanceForm · function · L42-L228 — function BioAppearanceForm({ bio, action, cancelHref, }: { bio: BioEditable; action: (state: FormState, form: FormData) => Promise<FormState>; cancelHref: string; })
- set · function · L62-L63 — set = (patch: Partial<AppearanceDraft>)
- setColor · function · L64-L68 — setColor = (key: ColorKey, value: string)
- color · function · L74-L89 — color = (key: ColorKey, placeholder: string)
