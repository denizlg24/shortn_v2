# apps/web/src/components/page/confirm-delete.tsx

- DeleteState · type · L7-L7 — type DeleteState = { error: string | null };
- ConfirmDelete · function · L11-L59 — function ConfirmDelete({ consequences, items, action, confirmLabel, cancelHref, errorMessage, }: { consequences: ReactNode[]; items?: ReactNode[]; action: (state: DeleteState, form: FormData) => Promise<DeleteState>; confirmLabel: string; cancelHref: string; errorMessage?: (code: string) => string; })
