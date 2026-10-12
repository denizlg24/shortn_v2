# apps/web/src/components/bio/public/bio-renderer.tsx

- InlineText · function · L16-L34 — function InlineText({ text }: { text: string })
- BioRenderer · function · L35-L322 — function BioRenderer({ content, links, now = 0, preview = false, labels, renderSection, }: { content: BioContent; links: Record<string, BioResolvedLink>; now?: number; preview?: boolean; renderSection?: (block: BioBlock, children: ReactNode) => ReactNode; labels: { branding: string; loadEmbed: string; embedConsent: string; unavailable: string; }; })
- render · function · L67-L275 — function render(block: BioBlock): ReactNode
