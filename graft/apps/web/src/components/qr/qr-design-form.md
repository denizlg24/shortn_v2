# apps/web/src/components/qr/qr-design-form.tsx

- QrDesignForm · function · L20-L102 — function QrDesignForm({ design: base, stored, shortUrl, linkLabel, logoGate, action, cancelHref, }: { design: QrDesign; stored: Record<string, unknown>; shortUrl: string; /** e.g. shortn.at/AbC123, for the preview's alt text. */ linkLabel: string; logoGate: PlanId | null; action: (state: FormState, form: FormData) => Promise<FormState>; cancelHref: string; })
