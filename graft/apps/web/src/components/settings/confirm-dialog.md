# apps/web/src/components/settings/confirm-dialog.tsx

- ConfirmDialog · function · L21-L110 — function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, typedConfirmation, onConfirm, }: { open: boolean; onOpenChange: (open: boolean) => void; title: ReactNode; description: ReactNode; confirmLabel: string; /** Require typing this exact text before the action unlocks. */ typedConfirmation?: { value: string; label: ReactNode }; onConfirm: () => Promise<string | null>; })
- change · function · L47-L54 — change = (next: boolean)
- submit · function · L56-L69 — submit = async (event: FormEvent<HTMLFormElement>)
