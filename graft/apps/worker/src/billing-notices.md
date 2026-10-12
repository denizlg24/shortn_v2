# apps/worker/src/billing-notices.ts

- Mirror · type · L4-L4 — type Mirror = Documents["subscriptions"];
- PlanId · type · L5-L5 — type PlanId = Mirror["plan"];
- Notice · type · L7-L12 — type Notice = | { kind: "started"; plan: PlanId } | { kind: "changed"; plan: PlanId } | { kind: "scheduled"; plan: PlanId; at: Date } | { kind: "canceled"; at: Date } | { kind: "payment_failed" };
- paid · function · L14-L17 — paid = (mirror: Mirror | null)
- noticesFor · function · L22-L44 — function noticesFor(before: Mirror | null, after: Mirror): Notice[]
