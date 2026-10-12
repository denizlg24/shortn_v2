# apps/web/e2e/analytics.browser-flows.ts

- csvRows · function · L8-L33 — function csvRows(text: string)
- checkAnalyticsBrowser · function · L35-L216 — async function checkAnalyticsBrowser({ page, go, db, workspaceId, linkId, linkKey, secondLinkId, secondLinkKey, qrId, qrKey, campaignId, }: { page: Page; go: (path: string) => Promise<unknown>; db: Db; workspaceId: ObjectId; linkId: string; linkKey: string; secondLinkId: string; secondLinkKey: string; qrId: string; qrKey: string; campaignId: string; })
- event · function · L64-L89 — event = ( id: ObjectId, key: string, source: string, country = "PT", campaign = "Autumn", kind = "click", owner = workspaceId, )
- stat · function · L108-L121 — stat = async (label: string, value: string)
- download · function · L122-L131 — download = async ()
