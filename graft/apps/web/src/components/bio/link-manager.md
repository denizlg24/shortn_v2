# apps/web/src/components/bio/link-manager.tsx

- LibraryLink · type · L42-L44 — type LibraryLink = Awaited< ReturnType<typeof searchBioLinksAction> >["links"][number];
- LinkRow · function · L48-L79 — function LinkRow({ item, title, children, }: { item: BioLinkItem; title: string; children: React.ReactNode; })
- LinkManager · function · L80-L872 — function LinkManager({ workspace, bioId, items, links, onChange, onResolve, onBusyChange, uploading, chooseOnly = false, }: { workspace: string; bioId: string; items: BioLinkItem[]; links: Record<string, BioResolvedLink>; onChange: (items: BioLinkItem[]) => void; onResolve: (id: string, link: BioResolvedLink) => void; onBusyChange: (busy: boolean) => void; uploading: boolean; chooseOnly?: boolean; })
- navigate · function · L168-L177 — function navigate(next: typeof mode)
- add · function · L178-L192 — function add(link: { id: string; title: string; href: string })
- toggleLinks · function · L198-L211 — function toggleLinks(candidates: LibraryLink[], checked: boolean)
- selectAll · function · L212-L231 — async function selectAll()
- addSelected · function · L232-L248 — function addSelected()
- create · function · L249-L281 — async function create()
- update · function · L294-L297 — update = (patch: Partial<BioLinkItem>)
- move · function · L298-L302 — function move(id: string, delta: number)
