# apps/web/src/components/page/filters.tsx

- FilterBar · function · L29-L139 — function FilterBar({ children, applied, normalize, clearParams = {}, }: { children: ReactNode; /** Page-owned scope retained when clearing filters. */ clearParams?: Record<string, string> | undefined; // Human-readable summary of what is filtered, e.g. ["Tags: Print", "Last 30 days"]. applied: string[]; // Rewrites the submitted params before navigating, given the current ones // (e.g. fill in dates when "Custom" is picked, drop defaults). normalize?: ( next: URLSearchParams, current: URLSearchParams, ) => URLSearchParams; })
- apply · function · L56-L75 — apply = (override?: { name: string; values: string[] })
- FilterGroup · function · L144-L159 — function FilterGroup({ label, children, }: { label: string; children: ReactNode; })
- FilterField · function · L161-L179 — function FilterField({ label, children, className, }: { label: string; children: (id: string) => ReactNode; className?: string; })
- FilterSearch · function · L181-L206 — function FilterSearch({ label, name, placeholder, }: { label: string; name: string; placeholder?: string; })
- FilterSelect · function · L208-L246 — function FilterSelect({ label, name, options, allLabel, value: selected, }: { label: string; name: string; options: { value: string; label: string }[]; // The "no filter" choice; omit when the select always has a value (sort). allLabel?: string; // The effective choice when it isn't simply the URL param (derived defaults). value?: string; })
- FilterDate · function · L248-L264 — function FilterDate({ label, name }: { label: string; name: string })
- FilterCombobox · function · L267-L287 — function FilterCombobox({ label, name, options, allLabel, multiple = false, }: { label: string; name: string; options: { value: string; label: string }[]; allLabel: string; multiple?: boolean; })
- FilterChoices · function · L289-L369 — function FilterChoices({ label, name, options, allLabel, multiple, initial, }: { label: string; name: string; options: { value: string; label: string }[]; allLabel: string; multiple: boolean; initial: string[]; })
- setValues · function · L314-L314 — setValues = (values: string[])
- FilterLink · function · L372-L445 — function FilterLink({ workspace, label, allLabel, options, }: { workspace: string; label: string; allLabel: string; options: { value: string; label: string }[]; })
