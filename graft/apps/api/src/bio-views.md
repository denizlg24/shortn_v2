# apps/api/src/bio-views.ts

- receiveBioView · function · L13-L110 — async function receiveBioView( request: Request, deps: { db: Db; durable: Pick<Redis, "eval" | "set" | "xadd">; secret: string; rootOrigin: string; webOrigin?: string | undefined; subdomains: boolean; }, )
