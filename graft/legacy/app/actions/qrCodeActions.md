# legacy/app/actions/qrCodeActions.ts

- generateQRCodeBase64 · function · L28-L37 — async function generateQRCodeBase64( options: Partial<Options>, ): Promise<string>
- CreateUrlInput · interface · L39-L45 — interface CreateUrlInput
- fetchPageTitle · function · L47-L56 — async function fetchPageTitle(url: string): Promise<string | null>
- formatFallbackDate · function · L58-L65 — function formatFallbackDate(): string
- createQrCode · function · L67-L200 — async function createQrCode({ longUrl, title, attachedUrl, tags = [], options, }: CreateUrlInput)
- updateQRCodeOptions · function · L202-L229 — updateQRCodeOptions = async ( codeId: string, options: Partial<Options>, )
- updateQRCodeData · function · L231-L316 — updateQRCodeData = async ({ qrCodeId, title, tags, applyToLink, longUrl, }: { qrCodeId: string; title: string; tags: TagT[]; applyToLink: boolean; longUrl: string; })
- attachShortnToQR · function · L318-L346 — attachShortnToQR = async (urlCode: string, qrCodeId: string)
- deleteQRCode · function · L348-L391 — deleteQRCode = async (qrCodeId: string)
