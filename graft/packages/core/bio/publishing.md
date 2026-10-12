# packages/core/bio/publishing.ts

- pages · function · L21-L21 — pages = (db: Db)
- ownedBioDocument · function · L22-L31 — async function ownedBioDocument( ctx: Pick<ServiceContext, "db" | "workspace">, id: string, )
- readBioDraft · function · L32-L46 — async function readBioDraft( ctx: Pick<ServiceContext, "db" | "workspace">, id: string, )
- validateContent · function · L47-L68 — async function validateContent(ctx: ServiceContext, input: unknown)
- saveBioDraft · function · L69-L98 — async function saveBioDraft( ctx: ServiceContext, id: string, revision: number, input: unknown, )
- publishBioDraft · function · L99-L184 — async function publishBioDraft( ctx: ServiceContext, id: string, revision: number, )
- bioVersions · function · L185-L201 — async function bioVersions( ctx: Pick<ServiceContext, "db" | "workspace">, id: string, )
- restoreBioVersion · function · L202-L219 — async function restoreBioVersion( ctx: ServiceContext, id: string, revision: number, version: number, )
- shortenBioUrl · function · L220-L234 — async function shortenBioUrl( ctx: ServiceContext, id: string, url: string, title: string, )
- changeBioHandle · function · L235-L299 — async function changeBioHandle( ctx: ServiceContext, id: string, handle: string, )
- resolveBioDocument · function · L300-L308 — async function resolveBioDocument(db: Db, handle: string)
- resolveLegacyBio · function · L309-L317 — async function resolveLegacyBio(db: Db, slug: string)
- publicBioFromDocument · function · L318-L386 — async function publicBioFromDocument( db: Db, page: Document, rootOrigin: string, subdomains: boolean, ): Promise<PublicBio>
