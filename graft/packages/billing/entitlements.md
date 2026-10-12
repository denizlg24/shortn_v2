# packages/billing/entitlements.ts

- Subscription · type · L11-L11 — type Subscription = Documents["subscriptions"];
- Period · interface · L16-L19 — interface Period
- Entitlements · interface · L21-L30 — interface Entitlements extends PlanDefinition
- calendarMonth · function · L32-L37 — function calendarMonth(now: Date): Period
- addMonths · function · L39-L43 — addMonths = (date: Date, months: number)
- billingPeriod · function · L47-L58 — function billingPeriod( sub: Pick<Subscription, "currentPeriodStart" | "currentPeriodEnd">, now: Date, ): Period
- resolveEntitlements · function · L60-L80 — function resolveEntitlements( subscriptions: Subscription[], now = new Date(), ): Entitlements
- loadEntitlements · function · L82-L87 — async function loadEntitlements(db: Db, workspaceId: ObjectId)
- hasFeature · function · L89-L92 — hasFeature = ( entitlements: Pick<Entitlements, "features">, feature: Feature, )
- minimumPlanFor · function · L94-L99 — function minimumPlanFor(feature: Feature): PlanId
