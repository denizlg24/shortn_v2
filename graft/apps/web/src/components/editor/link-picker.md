# apps/web/src/components/editor/link-picker.tsx

- Search · type · L25-L28 — type Search = | { status: "idle" } | { status: "ready"; query: string; links: LinkView[] } | { status: "error"; query: string };
- LinkPicker · function · L31-L171 — function LinkPicker({ workspace, onSelect, exclude, suggestions, suggestionsLabel, trigger, disabled, }: { workspace: string; onSelect: (link: LinkView) => void; /** Ids already used, hidden from the results. */ exclude?: ReadonlySet<string>; /** Shown before typing, e.g. the campaign's own links. */ suggestions?: LinkView[]; suggestionsLabel?: string; /** The button that opens the picker; defaults to "Add link". */ trigger?: ReactNode; disabled?: boolean; })
- visible · function · L87-L88 — visible = (links: LinkView[])
- pick · function · L96-L100 — pick = (link: LinkView)
- item · function · L102-L116 — item = (link: LinkView)
