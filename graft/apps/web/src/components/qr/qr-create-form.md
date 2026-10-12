# apps/web/src/components/qr/qr-create-form.tsx

- AttachableLink · type · L22-L25 — type AttachableLink = Pick< LinkView, "id" | "domain" | "key" | "url" | "qrCodeId" >;
- QrCreateForm · function · L28-L224 — function QrCreateForm({ base, previewData, allTags, logoGate, initialLink, workspace, action, cancelHref, }: { /** The design a new code starts from. */ base: QrDesign; /** A short URL of the real length, so the preview has the real density. */ previewData: string; allTags: string[]; logoGate: PlanId | null; /** From ?link=: the code is attached to this link and opens its URL. */ initialLink: AttachableLink | null; workspace: string; action: (state: FormState, form: FormData) => Promise<FormState>; cancelHref: string; })
