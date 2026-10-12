# packages/ui/playground/src/links/link-sheet.tsx

- SheetTab · type · L44-L44 — type SheetTab = "overview" | "edit" | "qr" | "activity";
- LinkDraft · interface · L46-L52 — interface LinkDraft
- LinkSheetProps · interface · L54-L65 — interface LinkSheetProps
- LinkSheet · function · L74-L201 — function LinkSheet({ link, createDraft, tab, onTabChange, open, onOpenChange, canEdit, allTags, onSave, }: LinkSheetProps)
- SectionHeading · function · L203-L205 — function SectionHeading({ children }: { children: ReactNode })
- Overview · function · L207-L287 — function Overview({ link }: { link: LinkRow })
- EditForm · function · L289-L445 — function EditForm({ initial, canEdit, allTags, submitLabel, onCancel, onSave, }: { initial: LinkDraft; canEdit: boolean; allTags: string[]; submitLabel: string; onCancel: () => void; onSave: (draft: LinkDraft) => string | null; })
- QrPanel · function · L447-L478 — function QrPanel({ link }: { link: LinkRow })
- download · function · L450-L458 — download = ()
- Activity · function · L480-L532 — function Activity({ link }: { link: LinkRow })
- describe · function · L487-L500 — describe = (entry: ActivityEntry)
