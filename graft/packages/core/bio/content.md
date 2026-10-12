# packages/core/bio/content.ts

- BioLinkItem · type · L24-L24 — type BioLinkItem = z.infer<typeof bioLinkItemSchema>;
- BioBlock · type · L121-L121 — type BioBlock = z.infer<typeof bioBlockSchema>;
- newBioLinksSection · function · L123-L132 — function newBioLinksSection( id: string, ): Extract<BioBlock, { type: "links" }>
- BioThemeTokens · type · L167-L167 — type BioThemeTokens = z.infer<typeof bioThemeTokens>;
- BioContent · type · L236-L236 — type BioContent = z.infer<typeof bioContentSchema>;
- BioResolvedLink · type · L237-L237 — type BioResolvedLink = { href: string; title: string; qrImage?: string };
- PublicBio · type · L238-L245 — type PublicBio = { id: string; handle: string; content: BioContent; links: Record<string, BioResolvedLink>; canonical: string; revision: number; };
- luminance · function · L247-L252 — function luminance(hex: string)
- bioContrast · function · L253-L257 — function bioContrast(a: string, b: string)
- readableBioColor · function · L258-L264 — function readableBioColor(text: string, background: string)
- accessibleBioTheme · function · L265-L271 — function accessibleBioTheme(theme: BioThemeTokens): BioThemeTokens
- visibleBioBlock · function · L272-L281 — function visibleBioBlock( block: Pick<BioBlock, "visible" | "schedule">, now: number, )
- object · function · L283-L284 — object = (value: unknown): Record<string, unknown>
- str · function · L285-L285 — str = (value: unknown)
- legacyHex · function · L286-L304 — function legacyHex(value: unknown, fallback: string)
- migratedBioContent · function · L306-L418 — function migratedBioContent(page: Record<string, unknown>): BioContent
- bioLinkIds · function · L421-L433 — function bioLinkIds(content: BioContent)
- groupBioLinks · function · L435-L472 — function groupBioLinks(content: BioContent): BioContent
