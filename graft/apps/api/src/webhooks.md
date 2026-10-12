# apps/api/src/webhooks.ts

- VerifiedEvent · interface · L7-L10 — interface VerifiedEvent
- Verify · type · L11-L15 — type Verify = ( body: string, headers: Record<string, string>, secret: string, ) => VerifiedEvent;
- field · function · L17-L17 — field = (data: object, name: string): unknown
- stringField · function · L18-L21 — stringField = (data: object, name: string)
- subscriptionIdsOf · function · L25-L39 — function subscriptionIdsOf(event: VerifiedEvent): string[]
- WebhookResult · type · L41-L44 — type WebhookResult = | { status: 403 } | { status: 200; duplicate: true } | { status: 202; id: string; subscriptionIds: string[] };
- receivePolarWebhook · function · L46-L85 — async function receivePolarWebhook( input: { body: string; headers: Record<string, string>; secret: string }, deps: { db: Db; verify?: Verify; log?: (message: string, error?: unknown) => void; }, ): Promise<WebhookResult>
