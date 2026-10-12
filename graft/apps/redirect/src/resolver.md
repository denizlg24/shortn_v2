# apps/redirect/src/resolver.ts

- LinkLoader · type · L21-L21 — type LinkLoader = (domain: string, key: string) => Promise<CachedLink>;
- mongoLinkLoader · function · L25-L59 — function mongoLinkLoader(db: Db, rootDomain = "shortn.at"): LinkLoader
- Entry · interface · L61-L64 — interface Entry
- MemoryLayer · class · L66-L98 — class MemoryLayer
- constructor · method · L68-L71 — constructor( private readonly maxEntries = 10_000, private readonly ttlMs = 10_000, )
- get · method · L72-L80 — get(cacheKey: string): CachedLink | undefined
- set · method · L81-L88 — set(cacheKey: string, value: CachedLink)
- delete · method · L89-L91 — delete(cacheKey: string)
- clear · method · L92-L94 — clear()
- size · method · L95-L97 — get size()
- createResolver · function · L100-L135 — function createResolver( store: CacheStore, load: LinkLoader, memory = new MemoryLayer(), )
- resolve · method · L112-L129 — async resolve(domain: string, key: string): Promise<CachedLink>
- evict · method · L130-L133 — evict(message: LinkInvalidation)
- Resolver · type · L136-L136 — type Resolver = ReturnType<typeof createResolver>;
- parseInvalidation · function · L143-L152 — function parseInvalidation( payload: string, ): LinkInvalidation | undefined
