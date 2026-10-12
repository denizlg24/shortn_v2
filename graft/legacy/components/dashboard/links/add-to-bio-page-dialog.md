# legacy/components/dashboard/links/add-to-bio-page-dialog.tsx

- BioPage · type · L42-L47 — type BioPage = { _id: string; slug: string; title: string; avatarUrl?: string; };
- AddToBioPageDialog · function · L49-L328 — AddToBioPageDialog = ({ linkId, linkTitle, trigger, onSuccess, }: { linkId: string; linkTitle: string; trigger?: ReactNode; onSuccess?: (_slug: string) => void; })
- loadBioPages · function · L87-L94 — loadBioPages = async ()
- handleCreateNew · function · L101-L163 — handleCreateNew = async ()
- handleAddToExisting · function · L165-L185 — handleAddToExisting = async (slug: string)
