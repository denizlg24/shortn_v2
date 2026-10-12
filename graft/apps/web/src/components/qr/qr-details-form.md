# apps/web/src/components/qr/qr-details-form.tsx

- QrDetailsForm · function · L13-L126 — function QrDetailsForm({ initial, attachedLink, allTags, action, cancelHref, }: { initial: { url: string; title: string; tags: string[] }; /** Key of the link the code is attached to, e.g. "menu". */ attachedLink: string | null; allTags: string[]; action: (state: FormState, form: FormData) => Promise<FormState>; cancelHref: string; })
