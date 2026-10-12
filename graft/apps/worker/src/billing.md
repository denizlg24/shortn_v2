# apps/worker/src/billing.ts

- BillingDeps · interface · L17-L30 — interface BillingDeps
- legacyPlanOf · function · L37-L40 — function legacyPlanOf(sub: SubscriptionLike)
- recordShadowDiff · function · L42-L65 — async function recordShadowDiff( deps: BillingDeps, eventId: string, sub: SubscriptionLike, outcome: ApplyOutcome, )
- claim · function · L69-L82 — async function claim(db: Db, now: Date)
- processBillingEvents · function · L84-L124 — async function processBillingEvents(deps: BillingDeps, limit = 50)
- runReconcile · function · L126-L138 — async function runReconcile(deps: BillingDeps & { polar: Polar })
- billingMailer · function · L142-L190 — function billingMailer(deps: { db: Db; mailer: Pick<Mailer, "billing">; appUrl: string; log: (message: string, error?: unknown) => void; }): NonNullable<BillingDeps["onApplied"]>
- date · function · L164-L169 — date = (at: Date)
