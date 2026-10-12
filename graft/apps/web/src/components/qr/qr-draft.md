# apps/web/src/components/qr/qr-draft.ts

- DotStyle · type · L14-L14 — type DotStyle = (typeof dotStyles)[number];
- CornerStyle · type · L15-L15 — type CornerStyle = (typeof cornerStyles)[number];
- ErrorLevel · type · L18-L18 — type ErrorLevel = (typeof errorLevels)[number];
- QrDraft · interface · L44-L58 — interface QrDraft
- draftOf · function · L60-L75 — function draftOf(design: QrDesign): QrDraft
- cornerOptions · function · L77-L80 — cornerOptions = (type: string | undefined, color: string | null)
- designOf · function · L83-L107 — function designOf(base: QrDesign, draft: QrDraft): QrDesign
- copyKey · function · L121-L127 — function copyKey<K extends keyof QrDesign>( target: QrDesign, source: QrDesign, key: K, )
- designPatch · function · L130-L136 — function designPatch(before: QrDesign, after: QrDesign): QrDesign
- designChanges · function · L139-L143 — designChanges = ( base: QrDesign, initial: QrDraft, draft: QrDraft, ): QrDesign
- DraftProblem · type · L147-L147 — type DraftProblem = "logoUrl" | "color";
- draftProblem · function · L150-L162 — function draftProblem(draft: QrDraft): DraftProblem | null
