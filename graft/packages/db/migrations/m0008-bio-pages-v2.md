# packages/db/migrations/m0008-bio-pages-v2.ts

- normalizeHandle · function · L42-L53 — function normalizeHandle(slug: string)
- isUsableHandle · function · L55-L56 — isUsableHandle = (handle: string)
- mapAsset · function · L58-L59 — mapAsset = (url: string | undefined, assets: Map<string, string>)
- buildBio · function · L62-L128 — function buildBio(doc: Document, assets: Map<string, string>)
- takenHandles · function · L130-L142 — async function takenHandles(ctx: MigrationContext)
- up · method · L148-L217 — async up(ctx)
- verify · method · L218-L261 — async verify(ctx)
- down · method · L262-L296 — async down(ctx)
