# packages/core/links/tokens.ts

- TokenSecrets · interface · L3-L9 — interface TokenSecrets
- encodeSecret · function · L11-L12 — encodeSecret = (secret: string)
- verifyWithAny · function · L14-L23 — async function verifyWithAny(token: string, secrets: Uint8Array[])
- verifyConfirmationToken · function · L25-L37 — async function verifyConfirmationToken( token: string, key: string, secrets: TokenSecrets, ): Promise<boolean>
- verifyLinkAccessCookie · function · L39-L51 — async function verifyLinkAccessCookie( cookie: string, key: string, secrets: TokenSecrets, ): Promise<boolean>
