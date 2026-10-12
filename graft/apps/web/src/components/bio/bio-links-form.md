# apps/web/src/components/bio/bio-links-form.tsx

- BioLinksForm · function · L26-L310 — function BioLinksForm({ workspace, linkDomain, bio, action, cancelHref, }: { workspace: string; /** Short link domain, for showing each link's key. */ linkDomain: string; bio: BioEditable; action: (state: FormState, form: FormData) => Promise<FormState>; cancelHref: string; })
- titleOf · function · L70-L70 — titleOf = (item: LinkItem)
- move · function · L72-L85 — move = (from: number, to: number)
- moveBy · function · L89-L98 — moveBy = (index: number, delta: -1 | 1)
- update · function · L100-L103 — update = (index: number, patch: Partial<LinkItem>)
- remove · function · L105-L112 — remove = (index: number)
- add · function · L114-L126 — add = (link: LinkView)
- endDrag · function · L128-L132 — endDrag = ()
- dragHandlers · function · L134-L153 — dragHandlers = (index: number)
- register · function · L155-L158 — register = (key: string)
