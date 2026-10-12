# packages/db/migrations/m0012-assets-to-storage.ts

- Source · interface · L25-L28 — interface Source
- storage · function · L39-L56 — function storage()
- bioSources · function · L58-L71 — bioSources = (doc: Document): Source[]
- collectSources · function · L73-L87 — async function collectSources(ctx: MigrationContext)
- upload · function · L91-L112 — async function upload(source: Source, target: ReturnType<typeof storage>)
- up · method · L117-L201 — async up(ctx)
- record · function · L130-L146 — record = (docs: Document[], urlsOf: (doc: Document) => string[])
- verify · method · L202-L252 — async verify(ctx)
- down · method · L253-L265 — async down(ctx)
