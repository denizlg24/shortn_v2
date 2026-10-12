# apps/worker/src/bio-delivery.ts

- deliverBioInvalidations · function · L6-L120 — async function deliverBioInvalidations( db: Db, config: { webOrigin: string; secret: string; rootOrigin: string; subdomains: boolean; zoneId?: string | undefined; token?: string | undefined; }, request: typeof fetch = fetch, now = new Date(), )
