# packages/core/links/public.ts

- PublicLink · interface · L10-L21 — interface PublicLink
- publicLinkQuery · function · L22-L36 — function publicLinkQuery( key: string, domain = "shortn.at", rootDomain = "shortn.at", )
- publicLink · function · L38-L80 — async function publicLink( db: Db, key: string, domain = "shortn.at", rootDomain = "shortn.at", ): Promise<PublicLink | null>
- CounterStore · interface · L82-L86 — interface CounterStore
- bump · function · L88-L92 — async function bump(store: CounterStore, key: string, seconds: number)
- PasswordResult · type · L94-L99 — type PasswordResult = | { ok: true; token: string } | { ok: false; error: "not_found" | "not_protected" | "rate_limited" | "wrong_password"; };
- verifyLinkPassword · function · L103-L140 — async function verifyLinkPassword( deps: { db: Db; counters: CounterStore; linkAccessSecret: string; rootDomain?: string; }, input: { key: string; password: string; ipHash: string; domain?: string }, ): Promise<PasswordResult>
- confirmationToken · function · L144-L150 — function confirmationToken(key: string, secret: string)
- ReportReason · type · L159-L159 — type ReportReason = (typeof reportReasons)[number];
- reportLink · function · L163-L225 — async function reportLink( deps: { db: Db; counters: CounterStore; cache: InvalidationStore; linkDomain: string; rootDomain?: string; }, input: { key: string; reason: ReportReason; details?: string | undefined; ipHash: string; }, ): Promise<{ ok: true } | { ok: false; error: "not_found" | "rate_limited" }>
