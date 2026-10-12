# apps/web/src/components/page/suggestion-input.tsx

- SuggestionInput · function · L10-L64 — function SuggestionInput({ label, suggestions, value, onValueChange, ...input }: Omit< InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className" > & { label: string; suggestions: readonly string[]; value: string; onValueChange: (value: string) => void; })
