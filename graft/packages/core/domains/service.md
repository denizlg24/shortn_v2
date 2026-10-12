# packages/core/domains/service.ts

- HostnameState · interface · L13-L22 — interface HostnameState
- DomainProvider · interface · L23-L28 — interface DomainProvider
- cloudflareDomains · function · L29-L75 — function cloudflareDomains( zoneId: string, token: string, request: typeof fetch = fetch, ): DomainProvider
- call · function · L35-L55 — async function call(path: string, method: string, body?: unknown)
- normalizeDomain · function · L76-L99 — function normalizeDomain( input: string, platformDomain: string, ): string | null
- domainAllowance · function · L100-L108 — async function domainAllowance(db: Db, workspaceId: ObjectId)
- addDomain · function · L119-L194 — async function addDomain( ctx: ServiceContext, input: unknown, platformDomain: string, )
- listDomains · function · L195-L221 — async function listDomains( ctx: Pick<ServiceContext, "db" | "workspace">, )
- removeDomain · function · L222-L270 — async function removeDomain(ctx: ServiceContext, id: string)
- retryDomain · function · L271-L288 — async function retryDomain(ctx: ServiceContext, id: string)
- moveDomainLinks · function · L289-L337 — async function moveDomainLinks(ctx: ServiceContext, id: string)
- domainBackoff · function · L339-L340 — domainBackoff = (attempts: number)
- pollDomains · function · L341-L511 — async function pollDomains( db: Db, provider: DomainProvider, now = new Date(), )
- activeDomain · function · L512-L536 — async function activeDomain( db: Db, hostname: string, ): Promise<Document | null>
- assignDomainLink · function · L538-L619 — async function assignDomainLink( ctx: ServiceContext, domainId: string, linkId: string, )
