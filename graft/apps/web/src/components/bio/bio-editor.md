# apps/web/src/components/bio/bio-editor.tsx

- CanvasSection · function · L63-L113 — function CanvasSection({ block, children, label, edit, }: { block: BioBlock; children: ReactNode; label: string; edit: () => void; })
- BioEditor · function · L114-L1479 — function BioEditor({ workspace, id, initial, initialRevision, initialHandle, links: initialLinks, versions, paid, }: { workspace: string; id: string; initial: BioContent; initialRevision: number; initialHandle: string; links: Record<string, BioResolvedLink>; versions: { revision: number; createdAt: string }[]; paid: boolean; })
- beforeUnload · function · L245-L250 — beforeUnload = (event: BeforeUnloadEvent)
- update · function · L257-L264 — function update(blockId: string, patch: Record<string, unknown>)
- move · function · L265-L273 — function move(blockId: string, delta: number)
- field · function · L274-L289 — field = ( label: string, value: string, onChange: (value: string) => void, type = "text", )
- select · function · L290-L349 — select = ( label: string, value: string, options: string[], onChange: (value: string) => void, )
- add · function · L350-L370 — add = (type: BioBlock["type"])
- publish · function · L371-L393 — async function publish()
- open · function · L396-L399 — open = (block: BioBlock)
