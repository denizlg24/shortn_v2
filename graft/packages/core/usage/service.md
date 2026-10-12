# packages/core/usage/service.ts

- UsageMetric · type · L7-L7 — type UsageMetric = "links" | "qrCodes" | "bioPages";
- countUsage · function · L11-L33 — async function countUsage( db: Db, workspace: Workspace, period: Period, ): Promise<Record<UsageMetric, number>>
- limitFor · function · L35-L37 — function limitFor(entitlements: Entitlements, metric: UsageMetric)
