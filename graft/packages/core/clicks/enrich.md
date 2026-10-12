# packages/core/clicks/enrich.ts

- Enriched · interface · L5-L20 — interface Enriched
- ipPrefix · function · L22-L28 — function ipPrefix(ip: string | undefined): string
- hashIp · function · L30-L32 — function hashIp(ip: string | undefined, secret: string): string
- refDomain · function · L34-L41 — function refDomain(referrer: string | undefined)
- utm · function · L45-L52 — function utm(query: Record<string, string> | undefined)
- enrich · function · L54-L72 — function enrich(message: ClickMessage, ipSecret: string): Enriched
