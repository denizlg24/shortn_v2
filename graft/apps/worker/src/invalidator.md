# apps/worker/src/invalidator.ts

- TokenStore · type · L14-L14 — type TokenStore = Pick<Redis, "get" | "set" | "del">;
- ScanStore · type · L16-L16 — type ScanStore = InvalidationStore & Pick<Redis, "scan">;
- stringValues · function · L20-L25 — function stringValues(value: unknown): string[]
- codesOf · function · L29-L37 — function codesOf(collection: string, doc: Document | undefined)
- InvalidationPlan · type · L39-L40 — type InvalidationPlan = { type: "keys"; keys: string[] } | { type: "flush" } | { type: "none" };
- planInvalidation · function · L42-L72 — function planInvalidation( change: ChangeStreamDocument, ): InvalidationPlan
- flushLinkCache · function · L74-L89 — async function flushLinkCache(store: ScanStore)
- createInvalidator · function · L92-L168 — function createInvalidator(options: { db: Db; cache: ScanStore; tokens: TokenStore; domain: string; log?: (message: string, error?: unknown) => void; })
- apply · function · L104-L108 — apply = async (plan: InvalidationPlan)
- watchOnce · function · L110-L137 — watchOnce = async ()
- lastEventAt · method · L140-L142 — get lastEventAt()
- run · method · L143-L162 — async run()
- stop · method · L163-L166 — async stop()
