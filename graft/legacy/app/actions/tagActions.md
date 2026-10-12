# legacy/app/actions/tagActions.ts

- createAndAddTagToUrl · function · L11-L54 — async function createAndAddTagToUrl(tagName: string, urlCode: string)
- createAndAddTagToQRCode · function · L56-L107 — async function createAndAddTagToQRCode( tagName: string, qrCodeId: string, )
- addTagToLink · function · L109-L124 — async function addTagToLink(urlCode: string, tagId: string)
- addTagToQRCode · function · L126-L144 — async function addTagToQRCode(qrCodeId: string, tagId: string)
- removeTagFromLink · function · L146-L178 — async function removeTagFromLink( urlCode: string, tagId: string, ): Promise<{ success: boolean; message?: string }>
- removeTagFromQRCode · function · L180-L212 — async function removeTagFromQRCode( qrCodeId: string, tagId: string, ): Promise<{ success: boolean; message?: string }>
- createTag · function · L214-L252 — async function createTag(tagName: string)
