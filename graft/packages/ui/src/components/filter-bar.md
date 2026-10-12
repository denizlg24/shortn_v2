# packages/ui/src/components/filter-bar.tsx

- FilterField · interface · L19-L25 — interface FilterField
- FilterValue · type · L27-L27 — type FilterValue = Record<string, string[]>;
- FilterBarProps · interface · L29-L36 — interface FilterBarProps
- FilterBar · function · L38-L82 — function FilterBar({ fields, value, onValueChange, pickerPlaceholder, className, }: FilterBarProps)
- setField · function · L47-L52 — setField = (fieldId: string, next: string[])
- summarize · function · L84-L90 — function summarize(field: FilterField, selected: string[]): string
- FilterChip · function · L92-L133 — function FilterChip({ field, selected, onChange, }: { field: FilterField; selected: string[]; onChange: (next: string[]) => void; })
- OptionList · function · L135-L221 — function OptionList({ field, selected, onChange, onBack, }: { field: FilterField; selected: string[]; onChange: (next: string[]) => void; onBack?: () => void; })
- handleKeyDown · function · L149-L154 — handleKeyDown = (event: KeyboardEvent<HTMLDivElement>)
- AddFilter · function · L223-L299 — function AddFilter({ fields, value, onPick, placeholder, compact, }: { fields: FilterField[]; value: FilterValue; onPick: (fieldId: string, next: string[]) => void; placeholder: string; compact: boolean; })
