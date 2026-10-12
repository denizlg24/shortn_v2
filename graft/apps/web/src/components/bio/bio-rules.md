# apps/web/src/components/bio/bio-rules.ts

- BioTheme · type · L3-L3 — type BioTheme = BioEditable["theme"];
- AvatarShape · type · L4-L4 — type AvatarShape = BioEditable["avatarShape"];
- ButtonStyle · type · L5-L5 — type ButtonStyle = NonNullable<BioTheme["buttonStyle"]>;
- HeaderStyle · type · L6-L6 — type HeaderStyle = NonNullable<BioTheme["header"]>["headerStyle"];
- isBioSlug · function · L13-L13 — isBioSlug = (value: string)
- normalizeSlug · function · L16-L17 — normalizeSlug = (value: string)
- publicPath · function · L19-L19 — publicPath = (slug: string)
- isColor · function · L23-L24 — isColor = (value: string)
- isHttpUrl · function · L26-L33 — isHttpUrl = (value: string)
- withScheme · function · L36-L39 — withScheme = (value: string)
- Platform · type · L94-L94 — type Platform = (typeof platforms)[number];
