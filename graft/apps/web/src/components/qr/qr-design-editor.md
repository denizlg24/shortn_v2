# apps/web/src/components/qr/qr-design-editor.tsx

- QrEdit · type · L48-L48 — type QrEdit = (patch: Partial<QrDraft>) => void;
- QrDesignError · interface · L50-L53 — interface QrDesignError
- useQrDesign · function · L61-L120 — function useQrDesign({ base, stored, data, whole, }: { base: QrDesign; stored: Record<string, unknown>; data: string; whole: boolean; })
- QrDesignState · type · L122-L122 — type QrDesignState = ReturnType<typeof useQrDesign>;
- QrSplit · function · L125-L140 — function QrSplit({ children, preview, }: { children: ReactNode; preview: ReactNode; })
- QrDesignPreview · function · L143-L175 — function QrDesignPreview({ state, alt, caption, }: { state: QrDesignState; alt: string; caption?: ReactNode; })
- QrDesignSections · function · L178-L226 — function QrDesignSections({ state, logoGate, error, }: { state: QrDesignState; /** Plan that unlocks logos (qrLogo); null when included. */ logoGate: PlanId | null; /** A server or pre-submit error, on the section it concerns. */ error: QrDesignError | null; })
- ColorsSection · function · L228-L346 — function ColorsSection({ draft, edit, gradients, error, }: { draft: QrDraft; edit: QrEdit; gradients: boolean; error: string | undefined; })
- PatternSection · function · L348-L387 — function PatternSection({ draft, edit }: { draft: QrDraft; edit: QrEdit })
- styleLabel · function · L350-L350 — styleLabel = (style: CornerStyle)
- LogoSection · function · L389-L482 — function LogoSection({ draft, edit, gate, error, onBusyChange, }: { onBusyChange: (busy: boolean) => void; draft: QrDraft; edit: QrEdit; gate: PlanId | null; error: string | undefined; })
