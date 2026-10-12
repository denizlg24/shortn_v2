# apps/web/src/server/bio-page.ts

- bioPublicUrl · function · L18-L21 — bioPublicUrl = (slug: string)
- BioTab · type · L23-L30 — type BioTab = | "overview" | "profile" | "links" | "socials" | "appearance" | "editor" | "analytics";
- bioTabs · function · L33-L53 — bioTabs = ( workspace: string, id: string, editable: boolean, label: (key: BioTab) => string, )
