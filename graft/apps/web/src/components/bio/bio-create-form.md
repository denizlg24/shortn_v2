# apps/web/src/components/bio/bio-create-form.tsx

- Availability · type · L18-L20 — type Availability = | { slug: string; status: "available" | "taken" | "invalid" } | { slug: string; status: "failed" };
- BioCreateForm · function · L23-L207 — function BioCreateForm({ workspace, host, action, cancelHref, }: { workspace: string; /** Public host the slug sits under, e.g. shortn.at. */ host: string; action: (state: FormState, form: FormData) => Promise<FormState>; cancelHref: string; })
