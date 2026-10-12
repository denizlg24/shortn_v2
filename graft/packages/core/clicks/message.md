# packages/core/clicks/message.ts

- ClickMessage · type · L30-L30 — type ClickMessage = z.infer<typeof clickMessageSchema>;
- encodeClickMessage · function · L32-L34 — function encodeClickMessage(message: ClickMessage): string[]
- decodeClickMessage · function · L36-L41 — function decodeClickMessage(fields: string[]): ClickMessage
- boundedQuery · function · L44-L51 — function boundedQuery(params: URLSearchParams): Record<string, string>
- HeaderReader · interface · L53-L55 — interface HeaderReader
- first · function · L57-L63 — function first(headers: HeaderReader, ...names: string[])
- decodeLocation · function · L65-L72 — function decodeLocation(value: string | undefined)
- normalizeIp · function · L74-L83 — function normalizeIp(value: string | undefined)
- cut · function · L85-L86 — cut = (value: string | undefined, length: number)
- RequestField · type · L88-L99 — type RequestField = | "ip" | "ua" | "referrer" | "lang" | "country" | "regionCode" | "region" | "city" | "continent" | "tz" | "requestId";
- requestClickFields · function · L102-L127 — function requestClickFields( headers: HeaderReader, ): Partial<Record<RequestField, string>>
