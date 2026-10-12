# packages/db/migrations/m0005-normalize-tags.ts

- Embedded · interface · L7-L11 — interface Embedded
- embeddedTags · function · L13-L24 — function embeddedTags(doc: Document): Embedded[]
- canonicalTags · function · L26-L46 — async function canonicalTags(ctx: MigrationContext, workspaceIds: ObjectId[])
- workspaceIdsOf · function · L48-L49 — workspaceIdsOf = (docs: Document[])
- ensureEmbeddedTags · function · L51-L78 — async function ensureEmbeddedTags(ctx: MigrationContext, collection: string)
- mapTagIds · function · L80-L114 — async function mapTagIds(ctx: MigrationContext, collection: string)
- up · method · L120-L173 — async up(ctx)
- verify · method · L174-L227 — async verify(ctx)
- down · method · L228-L276 — async down(ctx)
