# apps/web/src/components/editor/option-group.tsx

- Option · interface · L6-L11 — interface Option<T extends string>
- OptionGroup · function · L24-L95 — function OptionGroup<T extends string>({ labelledBy, options, value, onValueChange, disabled, className, }: { labelledBy: string; options: Option<T>[]; /** May be a stored value the editor doesn't offer; then nothing is checked. */ value: string | undefined; onValueChange: (value: T) => void; disabled?: boolean; className?: string; })
- onKeyDown · function · L44-L53 — onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, at: number)
- ChoiceField · function · L98-L131 — function ChoiceField<T extends string>({ label, hint, options, value, onValueChange, disabled, }: { label: ReactNode; hint?: ReactNode; options: Option<T>[]; value: string | undefined; onValueChange: (value: T) => void; disabled?: boolean; })
