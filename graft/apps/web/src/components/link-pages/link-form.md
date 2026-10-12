# apps/web/src/components/link-pages/link-form.tsx

- LinkForm · function · L16-L266 — function LinkForm({ mode, domain, initial, allTags, gates, action, cancelHref, }: { mode: "create" | "edit"; domain: string; initial: LinkFormValues; allTags: string[]; // Cheapest plan with the feature, or null when this workspace has it. gates: { customKeys: PlanId | null; passwords: PlanId | null }; action: (state: FormState, form: FormData) => Promise<FormState>; cancelHref: string; })
- message · function · L43-L75 — message = (code: string)
- fieldError · function · L76-L77 — fieldError = (field: string)
- describe · function · L79-L84 — describe = (field: string, hint: boolean)
