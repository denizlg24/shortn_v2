# 06 — Billing & Entitlements (Polar)

## What's wrong today

| Problem                                                                                                                                                                                      | Where                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Plan is resolved by **calling Polar on every request** and **parsing the product name** (`product.name.toLowerCase().split(" ")`). Renaming a product in Polar silently downgrades everyone. | `app/actions/polarActions.ts#getUserPlan`, duplicated in `app/api/auth/user/subscription/route.ts#getPlan` |
| Limits defined twice with different values (`plan-utils.ts` has no redirect limits; `polar-usage.ts` has plus=10 redirects)                                                                  | `utils/plan-utils.ts`, `lib/polar-usage.ts`                                                                |
| Usage = live query to Polar's events API (`countEventsThisMonth`) on the request path, plus never-reset `user.*_this_month` counters                                                         | `lib/polar-usage.ts`, `models/auth/User.ts`                                                                |
| Downgrades via an **external scheduler service** + `ScheduledChange` collection, executed opportunistically inside a `subscription.active` webhook                                           | `lib/scheduler.ts`, `lib/auth.ts` ~L495                                                                    |
| Webhooks are not idempotent and have no ordering protection; side effects (emails) are inline                                                                                                | `lib/auth.ts` polar plugin `onSubscription*`                                                               |
| Hand-written `getRelativeOrder` switch for plan ordering                                                                                                                                     | `utils/plan-utils.ts`                                                                                      |
| Dead Stripe config, `LEVEL_*_UPGRADE_ID`                                                                                                                                                     | `.env.example`, CI                                                                                         |

## Principles

1. **Polar is the system of record for money. Shortn is the system of record for entitlements.** We mirror Polar state locally via webhooks and _never_ call Polar on a read path.
2. **Entitlements derive from product IDs and metadata, never names.** Each Polar product carries `metadata.shortn_plan = "pro"` / `metadata.shortn_addon = "custom_domains"`. The mapping lives in code (`packages/billing/catalog.ts`) and is cross-checked at boot against Polar.
3. **One limits table**, in code, versioned. Grandfathered workspaces pin a catalog version.
4. **No external scheduler.** Period-end cancellation uses Polar's native `cancel_at_period_end`. **Period-end downgrades: verify against Polar's current API before implementation.** Its product-change proration modes may only switch immediately, which is likely why the legacy scheduler exists. If Polar can't schedule a product change, the downgrade becomes a durable **BullMQ delayed job** at `currentPeriodEnd` in our own worker. That job is idempotent (it re-checks the subscription state before acting) and reconciled nightly. It replaces the external scheduler service and keeps the same semantics.
5. **Honest UX:** usage is always visible, limits are enforced with a clear message and an upgrade path, nothing is hidden, and cancellation takes 2 clicks.

## Catalog

```ts
// packages/billing/catalog.ts
export const CATALOG_VERSION = 2;
export const plans = {
  free:  { links: 3,  qr: 3,  bioPages: 1, seats: 1, workspaces: 1, domains: 0, analyticsWindowDays: 30,  api: false, mcp: false },
  basic: { links: 25, qr: 25, bioPages: 1, seats: 1, workspaces: 1, domains: 0, analyticsWindowDays: 365, api: true,  mcp: true },
  plus:  { links: 50, qr: 50, bioPages: 3, seats: 3, workspaces: 2, domains: 0, analyticsWindowDays: 730, api: true,  mcp: true },
  pro:   { links: ∞,  qr: ∞,  bioPages: 10,seats: 5, workspaces: 5, domains: 1, analyticsWindowDays: ∞,   api: true,  mcp: true },
} as const;   // ⚠ numbers other than links/qr are PROPOSALS (open decision #1)
export const addOns = {
  custom_domains: { domains: +3 },   // paid add-on (decided)
  extra_seats:    { seats: +1 },     // per unit
  extra_domains:  { domains: +1 },   // per unit
} as const;
```

- Link and QR limits are **monthly creation** limits, matching legacy semantics (`links_this_month`). Whether to switch to _active links_ limits is a product decision; the catalog supports both kinds.
- Legacy "redirect" meters (`LINK_REDIRECT`, `QR_CODE_REDIRECT`) were limits on _redirects per month_ for some plans. **Never break redirects for limit reasons.** Over-limit redirects keep working; analytics beyond the limit are recorded but hidden until upgrade, or the meter is dropped. Recommendation: drop it.

## Data

```ts
subscriptions {  // mirror, written only by webhook handler + reconciler
  _id: polarSubscriptionId, workspaceId, polarCustomerId, productId, plan | addOn, quantity,
  status: "trialing"|"active"|"past_due"|"canceled"|"unpaid"|"incomplete",
  currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, scheduledChange?: { productId, at },
  lastEventAt, lastEventId, raw (latest payload)
}
workspaces.entitlements  // materialized: computed from active subscriptions + catalog; cached in Redis `ent:{ws}`
billing_events { _id: webhookId, type, receivedAt, processedAt, error? }   // idempotency + audit (TTL 400d)
```

- **Customer mapping:** Polar `externalCustomerId` stays `user.id` (existing customers keep working). The subscription's `metadata.workspaceId` decides which workspace it funds. Checkout sessions set it. M11 sets it for existing subscriptions, which all belong to the personal workspace, via a Polar API metadata update.

## Webhook handling (`apps/api/webhooks/polar`)

1. Verify the signature (`POLAR_WEBHOOK_SECRET`) using `@polar-sh/sdk` webhook validation.
2. `insert billing_events {_id: webhook-id}`. A duplicate key means already processed → 200.
3. Enqueue a BullMQ job `billing.apply` (with the webhook id) and respond 200 fast.
4. Worker: **refetch the subscription from Polar** (the source of truth, which fixes ordering issues), upsert the mirror if `modifiedAt` is newer, recompute entitlements, `DEL ent:{ws}`, then emit domain events (`plan.changed`) that trigger emails, the audit log and outgoing webhooks.
5. A **nightly reconciler** lists all Polar subscriptions and diffs them against the mirror, auto-fixing and alerting on drift.

Better-auth's Polar plugin is kept for **checkout and portal** only (`checkout()`, `portal()`, customer creation on signup). Its `onSubscription*` hooks are removed in favor of the handler above.

## Enforcement & metering

- `entitlements.check(ws, "links.create")`: reads `ent:{ws}` (Redis, falling back to Mongo) and `usage:{ws}:{period}:links` (Redis). Atomic reservation uses a Lua script: `INCR` → if over the limit, `DECR` and reject. A failed create calls `release()`.
- Usage counters persist to `usage_periods` every 60 s and at period rollover. Redis loss → rebuilt from Mongo source data (`count links where createdAt in period`). That's reliable because the counters are a cache, not a ledger.
- Period = the workspace's billing period (`currentPeriodStart..End`) for paid plans, the calendar month UTC for free. This fixes the "never reset" bug structurally: the period key changes, so there's nothing to reset.
- Polar usage events (`events.ingest`) are only sent if we adopt metered pricing. Currently they aren't used for billing, so **ingestion is removed** (fewer moving parts). Usage is shown in-app.

## Downgrade & cancellation behavior

- Downgrade = Polar scheduled change at period end. The UI shows "Your plan changes to Basic on 12 Nov".
- Over-limit after a downgrade: **nothing is deleted or disabled.** Existing links keep redirecting. Creating new ones is blocked until usage is under the limit. Features beyond the plan (custom domains, extra workspaces) become read-only with a banner. A custom domain on a lapsed add-on keeps redirecting for a 30-day grace period, then serves a branded "domain inactive" page. Links are never silently broken.
- Past due: a banner and a 7-day grace period with full functionality, then creation is blocked (redirects still work).

## Migration (see 02 §M10–M11)

1. Create the new products in Polar **only if prices change**. Otherwise keep the existing product IDs and add `metadata.shortn_plan` to them. Note: product metadata writes don't fire subscription webhooks, but verify this on the Polar sandbox first.
2. Map **every** product ID that appears on a non-terminal subscription (M0 #11: archived, yearly and old products included) to a plan using the legacy name rule, into `catalog.legacyProductIds`. An unmapped ID blocks the switch. `past_due` counts as paid, as legacy does.
3. M11 builds the mirror **read-only** during P3 (no Polar writes while legacy hooks are live).
4. The new webhook handler runs in **shadow** (processing + diffing, no side effects) for ≥ 7 days with zero diffs.
5. **Billing switch**, in one maintenance window: freeze the external scheduler (stop accepting and executing) → move the Polar webhook URL to `api.shortn.at/webhooks/polar` (legacy hooks are now dead) → write `metadata.workspaceId` to subscriptions → convert pending `ScheduledChange`s into the new downgrade mechanism (principle 4) → verify each one → mark them migrated.
6. Decommission the scheduler service after confirming no pending schedules remain (`listSchedules`).

## UI (detail in 12)

- Settings → Billing: current plan, renewal date, usage meters with exact numbers, add-ons with quantity steppers, invoices (Polar portal link), and a plan comparison with real limits from the catalog.
- Upgrade prompts are inline at the point of limit ("You've created 25 of 25 links this period"), never modal ambushes.

## Acceptance

- Renaming a product in Polar changes nothing in Shortn.
- Replaying any webhook 10× produces the same state. Delivering webhooks out of order produces the correct final state.
- Load: entitlement check < 1 ms p95 (Redis).
- E2E on Polar sandbox: subscribe → upgrade → schedule downgrade → period end → downgraded; add-on purchase → domain slots.
