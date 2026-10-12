# packages/ui/playground/src/data/links.ts

- suggestKey · function · L79-L98 — function suggestKey(source: string): string
- longToken · function · L100-L110 — function longToken( random: ReturnType<typeof createRandom>, length: number, ): string
- clicksFor · function · L112-L118 — function clicksFor(random: ReturnType<typeof createRandom>): number
- trendFor · function · L120-L143 — function trendFor( random: ReturnType<typeof createRandom>, clicks: number, ageDays: number, weekdayHeavy: boolean, ): number[]
- generateLinks · function · L145-L255 — function generateLinks(count = 200): LinkRow[]
- uniqueKey · function · L151-L157 — uniqueKey = (base: string)
- addLongContent · function · L257-L297 — function addLongContent( links: LinkRow[], random: ReturnType<typeof createRandom>, uniqueKey: (base: string) => string, )
- isLongContent · function · L299-L301 — function isLongContent(link: LinkRow): boolean
