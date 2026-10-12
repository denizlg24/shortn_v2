# packages/core/links/cached-link.ts

- CachedLink · type · L23-L23 — type CachedLink = z.infer<typeof cachedLinkSchema>;
- encodeCachedLink · function · L25-L25 — encodeCachedLink = (link: CachedLink)
- decodeCachedLink · function · L26-L27 — decodeCachedLink = (encoded: string)
- cacheTtlSeconds · function · L29-L30 — cacheTtlSeconds = (link: CachedLink)
- LegacyLinkFields · interface · L32-L44 — interface LegacyLinkFields
- LegacyQrFields · interface · L46-L49 — interface LegacyQrFields
- isLegacyQrBacked · function · L65-L67 — function isLegacyQrBacked(link: LegacyLinkFields): boolean
- toCachedLink · function · L69-L94 — function toCachedLink( link: LegacyLinkFields, requestedKey: string, qr: LegacyQrFields | null, ): CachedLink
