# apps/web/e2e/handoff.browser-flows.ts

- checkHandoffAndAddPassword · function · L9-L248 — async function checkHandoffAndAddPassword({ browser, db, origin, captureDir, clientIp, }: { browser: Browser; db: Db; origin: string; captureDir: string | undefined; clientIp: string; })
- mint · function · L53-L72 — mint = async ( options: { expiresAt?: Date; userId?: string; impersonatedBy?: string; } = {}, )
- endpoint · function · L85-L86 — endpoint = (token: string, next: string)
- denied · function · L87-L106 — denied = async ( token: string, next: string, expected: string | null, )
