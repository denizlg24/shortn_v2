# packages/db/migrations/m0011-subscriptions-mirror.ts

- PolarSubscription · type · L24-L24 — type PolarSubscription = z.infer<typeof subscription>;
- planFromProductName · function · L27-L34 — function planFromProductName(name: string)
- fetchSubscriptions · function · L38-L66 — async function fetchSubscriptions(): Promise<PolarSubscription[]>
- statusOf · function · L68-L79 — statusOf = (status: string)
- up · method · L84-L164 — async up(ctx)
- verify · method · L165-L247 — async verify(ctx)
- down · method · L248-L269 — async down(ctx)
