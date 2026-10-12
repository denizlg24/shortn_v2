# legacy/app/actions/bioPageActions.ts

- createBioPage · function · L13-L55 — async function createBioPage({ title, slug, urlCode, }: { title: string | undefined; slug: string; urlCode?: string; })
- updateBioPage · function · L57-L120 — async function updateBioPage({ bio, }: { bio: { userId: string; slug: string; title: string; description?: string; avatarUrl?: string; theme?: { primaryColor?: string; buttonTextColor?: string; background?: string; textColor?: string; buttonStyle?: "rounded" | "square" | "pill"; font?: string; titleFontSize?: string; titleFontWeight?: string; descriptionFontSize?: string; descriptionFontWeight?: string; buttonFontSize?: string; buttonFontWeight?: string; header?: { headerStyle: "centered" | "left-aligned" | "right-aligned"; headerBackgroundImage?: string; headerBackgroundColor?: string; }; }; links?: { link: { shortUrl: string; title: string }; image?: string; title?: string; }[]; socials?: { url: string; platform: string }[]; socialColor: string | "original"; createdAt: Date; updatedAt: Date; }; })
- updateBioLink · function · L122-L177 — async function updateBioLink({ slug, linkId, title, image, }: { slug: string; linkId: string; title?: string; image?: string; })
- removeLinkFromBio · function · L179-L223 — async function removeLinkFromBio({ slug, linkId, }: { slug: string; linkId: string; })
- reorderBioLinks · function · L225-L278 — async function reorderBioLinks({ slug, linkIds, }: { slug: string; linkIds: string[]; })
- addLinkToBioPage · function · L280-L343 — async function addLinkToBioPage({ slug, linkId, }: { slug: string; linkId: string; })
- getUserBioPages · function · L345-L374 — async function getUserBioPages()
- deleteBioPage · function · L376-L416 — async function deleteBioPage({ slug }: { slug: string })
