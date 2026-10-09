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
4. **No external scheduler.** Cancellation uses Polar's native `cancel_at_period_end`. **Downgrades use `proration_behavior: "next_period"`** on `PATCH /v1/subscriptions/{id}`. Polar queues it as a `pending_update` (with `applies_at`) and applies it at the start of the next billing period, with no proration ([Polar proration docs](https://polar.sh/docs/features/subscriptions/proration), [manage subscriptions](https://polar.sh/docs/features/subscriptions/manage)). The UI reads `pending_update` from the mirror. Constraints: a subscription scheduled to cancel must be uncanceled before a plan change, and custom-priced products can't be change targets. Both are handled in `billing.changePlan()`. Verified on the Polar sandbox in P4 before the switch.
5. **Honest UX:** usage is always visible, limits are enforced with a clear message and an upgrade path, nothing is hidden, and cancellation takes 2 clicks.

## Catalog (decided 2026-10-09)

**Prices stay exactly as they are today.** Limits only go up, never down, so no existing customer loses anything. Enterprise is new. Link and QR limits are **monthly creation** limits (legacy semantics), and **Pro and Enterprise are unlimited**.

```ts
// packages/billing/catalog.ts
export const CATALOG_VERSION = 2;
export const plans = {
  //            links/mo qr/mo  bio  seats  workspaces  analytics window  api rate/min  mcp
  free:       { links: 5,   qr: 5,   bioPages: 1,  seats: 1, workspaces: 1,  analyticsDays: 30,   api: false, mcp: false },
  basic:      { links: 50,  qr: 50,  bioPages: 2,  seats: 1, workspaces: 1,  analyticsDays: 365,  api: 60,    mcp: true },
  plus:       { links: 150, qr: 150, bioPages: 5,  seats: 3, workspaces: 3,  analyticsDays: 730,  api: 300,   mcp: true },
  pro:        { links: ∞,   qr: ∞,   bioPages: 20, seats: 5, workspaces: 10, analyticsDays: ∞,    api: 1200,  mcp: true },
  enterprise: { links: ∞,   qr: ∞,   bioPages: ∞,  seats: contract, workspaces: ∞, analyticsDays: ∞, api: contract, mcp: true },
} as const;
```

| Plan                 | Price                   | What changed vs. today                                                                                                                                                                                                          |
| -------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Free                 | €0                      | 3 → **5** links and QR per month; bio page on `{handle}.shortn.at` with "Made with Shortn"                                                                                                                                      |
| Basic                | unchanged               | 25 → **50**; API + MCP                                                                                                                                                                                                          |
| Plus                 | unchanged               | 50 → **150**; 3 seats (team workspaces start here)                                                                                                                                                                              |
| Pro                  | unchanged               | still unlimited links/QR; 5 seats, 10 workspaces                                                                                                                                                                                |
| **Enterprise** (new) | quote, annual, invoiced | everything unlimited, contractual seats/API limits, **SSO** (better-auth SSO plugin, SAML/OIDC), audit-log export, custom IP-retention terms, 99.9% redirect SLA, priority support, custom domains included (contractual count) |

Enterprise is sold through a per-customer Polar product (`metadata.shortn_plan = "enterprise"`, contract values in metadata), created from an internal admin action. The checkout link goes by email; there's no self-serve checkout.

### Currency (decided 2026-10-09)

Polar products stay priced in **USD** (Basic $5, Plus $15, Pro $25 a month, identical in production and the `Shortn.at - Staging` sandbox org). The UI shows prices in **EUR using a live conversion**: a daily ECB reference-rate fetch cached in Redis (`fx:usd:eur`, 24 h TTL, last-known value kept if the fetch fails), labelled "≈ €X, billed as $Y" so the charged amount is never misstated. Checkout and invoices stay in USD.

### Add-ons (decided)

| Add-on                 | Price                 | Available on                              | Effect                                                                       |
| ---------------------- | --------------------- | ----------------------------------------- | ---------------------------------------------------------------------------- |
| **Custom domain**      | €5 / month per domain | Basic, Plus, Pro (included on Enterprise) | +1 domain slot for links and/or bio (07). Quantity-based                     |
| **Extra seat**         | €6 / month per seat   | Plus, Pro                                 | +1 member seat                                                               |
| **Extended analytics** | €4 / month            | Free, Basic                               | analytics window → 2 years (data is always kept; this only unlocks the view) |

Add-ons are separate Polar subscriptions with `metadata.shortn_addon` and a quantity, tied to the workspace via `metadata.workspaceId`. Cancelling a plan doesn't auto-cancel add-ons: the UI asks, and the default is to cancel them too. Add-on prices are the only new prices. Confirm them before creating the Polar products.

- The legacy **redirect meters** (`LINK_REDIRECT`, `QR_CODE_REDIRECT`) are **dropped**. Redirects are never limited.

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
