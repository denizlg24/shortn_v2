# packages/db/migrations/m0010-usage-periods.ts

- periodOf · function · L7-L7 — periodOf = (date: Date)
- lastPeriods · function · L9-L15 — function lastPeriods(now: Date, count: number)
- Metric · type · L17-L17 — type Metric = "links" | "qrCodes" | "bioPages";
- derivedCounts · function · L21-L61 — async function derivedCounts(ctx: MigrationContext, from: Date)
- plan · function · L63-L118 — function plan(ctx: MigrationContext, now: Date)
- up · method · L123-L130 — async up(ctx)
- verify · method · L131-L175 — async verify(ctx)
- down · method · L176-L184 — async down(ctx)
