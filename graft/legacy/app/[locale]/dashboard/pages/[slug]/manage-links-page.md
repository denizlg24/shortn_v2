# legacy/app/[locale]/dashboard/pages/[slug]/manage-links-page.tsx

- LinkData · type · L55-L63 — type LinkData = { _id: string; shortUrl: string; title: string; createdAt: Date; addedAt: Date; image?: string; customTitle?: string; };
- LinkChanges · type · L65-L68 — type LinkChanges = { title?: string; image?: string; };
- ManageLinksPage · function · L70-L568 — ManageLinksPage = ({ initialLinks, slug, }: { initialLinks: LinkData[]; slug: string; })
- hasChanges · function · L87-L89 — hasChanges = (linkId: string)
- handleTitleChange · function · L92-L100 — handleTitleChange = (linkId: string, newTitle: string)
- handleSaveChanges · function · L102-L137 — handleSaveChanges = async (linkId: string)
- handleDiscardChanges · function · L139-L144 — handleDiscardChanges = (linkId: string)
- uploadFile · function · L146-L198 — uploadFile = async ( e: React.ChangeEvent<HTMLInputElement>, linkId: string, )
- removeFile · function · L200-L222 — removeFile = async (linkId: string, imageUrl: string)
- handleRemoveLink · function · L224-L235 — handleRemoveLink = async (linkId: string)
- handleReorder · function · L237-L250 — handleReorder = async (newOrder: LinkData[])
- handleSort · function · L252-L285 — handleSort = async (sortType: "addedAt" | "createdAt")
