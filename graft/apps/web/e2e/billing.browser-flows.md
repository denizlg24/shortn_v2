# apps/web/e2e/billing.browser-flows.ts

- BillingFixture · interface · L8-L12 — interface BillingFixture
- BillingRequest · interface · L14-L18 — interface BillingRequest
- checkBillingFailures · function · L20-L293 — async function checkBillingFailures({ page, go, db, workspaceId, userId, requests, writesEnabled, captureDir, fixture, }: { page: Page; go: (path: string) => Promise<unknown>; db: Db; workspaceId: ObjectId; userId: string; requests: BillingRequest[]; writesEnabled: boolean; captureDir: string | undefined; fixture: BillingFixture; })
- failedForm · function · L49-L54 — failedForm = async (name: string)
