# legacy/lib/authClient.ts

- ClientSession · type · L19-L19 — type ClientSession = typeof authClient.$Infer.Session;
- ClientUser · type · L20-L20 — type ClientUser = (typeof authClient.$Infer.Session)["user"];
- getClientSession · function · L22-L24 — async function getClientSession()
- getPlanFromSubscription · function · L26-L37 — function getPlanFromSubscription({ subscriptions, }: { subscriptions: CustomerStateSubscription[]; })
