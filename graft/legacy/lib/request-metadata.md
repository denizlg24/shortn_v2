# legacy/lib/request-metadata.ts

- HeaderReader · type · L1-L1 — type HeaderReader = Pick<Headers, "get">;
- HeaderSource · type · L2-L2 — type HeaderSource = HeaderReader | { headers: HeaderReader };
- RequestGeo · interface · L4-L14 — interface RequestGeo
- RequestMetadata · interface · L16-L20 — interface RequestMetadata
- sourceHeaders · function · L22-L24 — function sourceHeaders(source: HeaderSource): HeaderReader
- firstHeader · function · L26-L35 — function firstHeader( headers: HeaderReader, ...names: string[] ): string | undefined
- decodeLocation · function · L37-L45 — function decodeLocation(value: string | undefined): string | undefined
- normalizeIp · function · L47-L61 — function normalizeIp(value: string | undefined): string | undefined
- countryFlag · function · L63-L69 — function countryFlag(country: string | undefined): string | undefined
- getRequestIp · function · L77-L82 — function getRequestIp(source: HeaderSource): string | undefined
- getRequestGeo · function · L89-L123 — function getRequestGeo(source: HeaderSource): RequestGeo
- getRequestMetadata · function · L125-L133 — function getRequestMetadata(source: HeaderSource): RequestMetadata
