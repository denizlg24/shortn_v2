# 02 — Data Model & Migrations

The rule: **data cannot be lost.** Every change below is additive until the final contract phase. Every migration is idempotent, resumable and verified. Each has a written rollback.

## 1. Current state (as read from `legacy/models`)

| Mongoose model    | Collection (verify in M0)                                                                    | Owner key | Notes                                                                                                                                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `UrlV3`           | `urlv3s`                                                                                     | `sub`     | `urlCode` **not unique**; embedded `tags[]`; `utmLinks[]` with embedded `campaign {_id,title}`; `clicks.total` updated with `save()` (racy); password bcrypt hash; safety fields; `isQrCode` + `qrCodeId` for QR-backing links |
| `QRCodeV2`        | `qrcodesv2`                                                                                  | `sub`     | `qrCodeId` (public id), `urlId` = **urlCode** of backing link (string, not ObjectId); `options` = qr-code-styling blob; own `clicks.total`                                                                                     |
| `Clicks`          | `clicks`                                                                                     | `sub`     | `urlCode` = link code, **or qrCodeId when `type: "scan"`**; raw `ip`; geo; UA fields; `queryParams` mixed                                                                                                                      |
| `BioPage`         | `biopages`                                                                                   | `userId`  | `slug` unique; `links[].link` → UrlV3 ObjectId; theme blob; socials                                                                                                                                                            |
| `Campaigns`       | `campaigns`                                                                                  | `sub`     | `links[]` ObjectIds **and** links hold `utmLinks[].campaign` copies                                                                                                                                                            |
| `Tag`             | `tags`                                                                                       | `sub`     | plus copies embedded in every link/QR                                                                                                                                                                                          |
| `LinkReport`      | `linkreports`                                                                                | —         | keyed by `urlCode`                                                                                                                                                                                                             |
| `ScheduledChange` | `scheduledchanges`                                                                           | `userId`  | downgrade/cancel queue for the external scheduler                                                                                                                                                                              |
| `Contact`         | `contacts`                                                                                   | —         | contact form submissions                                                                                                                                                                                                       |
| `RateLimit`       | `ratelimits`                                                                                 | —         | TTL 24h, ephemeral                                                                                                                                                                                                             |
| better-auth       | `user`, `session`, `account`, `verification`, `impersonation_nonce`, `impersonation_backref` | —         | `user.sub` (unique), `user.*_this_month` counters, `session.geo_*`, `impersonatedBy`                                                                                                                                           |

Polar is keyed by `externalCustomerId = user.id`.

## 2. Target model

Names in **bold** are new collections. Existing collections keep their physical names until P7. A rename is a cheap metadata operation, and doing it last means legacy code never sees a renamed collection.

```ts
// workspaces  (new)
{ _id, slug, name, logo?, ownerUserId, personal: boolean, plan: PlanId, addOns: AddOnId[],
  defaultDomain: "shortn.at", createdAt, updatedAt, legacySub?: string }

// workspace_members (new)  unique {workspaceId,userId}
{ _id, workspaceId, userId, role: "owner"|"admin"|"member"|"viewer", invitedBy?, createdAt }
// invitations: better-auth organization plugin tables (05)

// links  (= urlv3s expanded in place, renamed at P7)
{ _id, workspaceId, domain, key,                 // unique {domain,key}; key case-sensitive
  destination,                                   // was longUrl
  title?, description?, tagIds: ObjectId[], campaignId?: ObjectId,
  utm?: { source?, medium?, campaign?, term?, content? },
  password?: { hash, hint? },                    // was passwordProtected/passwordHash/passwordHint
  safety: { status, riskScore, flagged, disabled, disabledReason?, reportCount,
            lastScannedAt?, provider?, interstitial },
  rules?: LinkRules,                              // 09: expiry, schedule, geo/device targeting, rotation, deep links
  og?: { title?, description?, image? },
  qr: { legacyBacking: boolean },                 // was isQrCode: hits count as scans
  previousKeys: string[],                         // renamed keys keep resolving (alias); never reassigned to another workspace
  attachedQrId?: ObjectId,                        // legacy attachedUrl / qrCodeId relation
  stats: { clicks: number, scans: number, lastClickAt?: Date },  // maintained by worker via $inc
  createdBy?: userId, createdAt, updatedAt, archivedAt?, deletedAt?,
  // legacy, kept until contract: sub, urlCode, longUrl, tags, utmLinks, clicks, isQrCode, qrCodeId, ...
}

// qr_codes (= qrcodesv2 expanded, renamed at P7)
{ _id, workspaceId, linkId, publicId /* was qrCodeId */, title?, tagIds, design: QrDesign,
  stats: { scans, lastScanAt? }, createdAt, updatedAt, legacy fields… }

// click_events  (new, TIME-SERIES: timeField "ts", metaField "m", granularity "minutes")
{ ts, m: { workspaceId, linkId, qrId?, kind: "click"|"scan", domain },
  key, country?, region?, city?, continent?, tz?, lang?, browser?, os?, device?, bot: false,
  referrer?, refDomain?, utm?: {...}, ipHash, ipPrefix /* /24 or /48 */, uaHash, legacyId?: ObjectId }

// click_rollups (new)  unique {linkId, day}
{ linkId, workspaceId, day: Date, clicks, scans, byCountry: {CC: n}, byDevice, byBrowser, byOs, byRefDomain, byHour[24] }

// tags (existing collection, expanded)   unique {workspaceId, nameLower}
{ _id, workspaceId, name, color, legacyIds: string[], createdAt }

// campaigns (existing, expanded)
{ _id, workspaceId, title, description?, utmDefaults, createdAt, updatedAt, legacy links[] until contract }

// bio_pages (= biopages expanded)  unique {handle}
{ _id, workspaceId, handle /* DNS label */, customDomain?, title, description?, avatar?,
  theme: BioTheme, blocks: BioBlock[], seo?, published: boolean, legacySlug, ... }

// bio_aliases (new)  unique {slug}:  legacy /b/{slug} → handle when they differ

// domains (new)  unique {hostname}
{ _id, workspaceId, hostname, kind: "links"|"bio"|"both", cfCustomHostnameId, status, verification, createdAt }

// subscriptions (new) — mirror of Polar, written only by webhooks/reconciler (06)
// usage_periods (new) unique {workspaceId, period}
// api_keys (new), webhooks (new), webhook_deliveries (new, TTL 30d), imports (new), audit_log (new)
// link_reports, contacts: unchanged + workspaceId where applicable
// asset_migrations (new): Pinata URL → R2 URL map
```

### Key indexes

| Collection    | Index                                                                     | Purpose                                    |
| ------------- | ------------------------------------------------------------------------- | ------------------------------------------ |
| links         | `{domain:1,key:1}` unique, **partial** on `key:{$type:"string"}` (§3a)    | redirect resolution                        |
| links         | `{urlCode:1}` (non-unique, until C3)                                      | legacy-field resolution during coexistence |
| links         | `{domain:1,previousKeys:1}`                                               | alias resolution (multikey)                |
| links         | `{workspaceId:1,createdAt:-1,_id:-1}`                                     | dashboard list, keyset pagination          |
| links         | `{workspaceId:1,tagIds:1}`, `{workspaceId:1,campaignId:1}`                | filters                                    |
| links         | Atlas Search index on title/key/destination/tags                          | search (replaces text indexes)             |
| click_events  | time-series auto index on `m` + `ts`; secondary `{ "m.linkId":1, ts:-1 }` | per-link ranges                            |
| click_rollups | `{linkId:1,day:1}` unique, `{workspaceId:1,day:1}`                        | dashboards                                 |
| bio_pages     | `{handle:1}` unique, `{customDomain:1}` unique sparse                     | host routing                               |
| domains       | `{hostname:1}` unique                                                     | host routing                               |
| api_keys      | `{hashedKey:1}` unique                                                    | API auth                                   |

The existing text indexes on `urlv3s`, `qrcodesv2`, `biopages`, `campaigns` and `tags`, and the single-field boolean indexes (`flagged`, `disabled`, `passwordProtected`, …), are dropped in the contract phase. Each one costs write I/O on every redirect `save()` today.

## 3. Migration runner (`packages/db/migrations`)

```ts
export const migration: Migration = {
  id: "0003-link-domain-key",
  phase: "expand" | "backfill" | "contract",
  continuous?: true,        // re-run on a schedule while legacy app still writes (catch-up)
  async up(ctx)  {},        // batched, idempotent ($set only where field missing)
  async verify(ctx) {},     // returns { ok, counts, samples, discrepancies }
  async down(ctx) {},       // reverses expand/backfill; contract migrations have no down (see archive)
};
```

- **State:** a `_migrations` collection with `{ id, status, startedAt, finishedAt, checkpoint, verifyReport }`.
- **Lock:** `findOneAndUpdate({_id:"lock", holder:null})` with a lease; a crashed runner's lease expires.
- **Batching:** iterate by `_id` ascending in batches of 1–5k with `bulkWrite` (ordered:false), and checkpoint the last `_id` after each batch. Bounded concurrency keeps Atlas IOPS in check, and rate is configurable.
- **Modes:** `--dry-run` (counts and sample diffs, no writes), `--verify-only`, `--until <id>`.
- **Continuous migrations:** while legacy keeps writing (P2–P4), backfill migrations marked `continuous` run every minute in the worker, processing only `{ newField: { $exists:false } }`. This avoids patching legacy write paths except where unavoidable (cache invalidation, see 03).
- **Contract migrations:** each first copies affected docs or fields into `archive_<collection>_<migrationId>` (or `mongodump` to R2 for whole collections). Then it verifies the archive count, then unsets or drops. They run only in P7 with an explicit `--confirm-contract` flag.
- **Rehearsal:** every migration runs against a fresh restore of the latest prod snapshot in staging, and its `verify` output is attached to the PR. CI runs up→verify→down→up on an anonymized fixture.

## 3a. Coexistence rules (P2 → P4, while legacy and new code both write)

These rules override anything below that conflicts with them.

1. **Legacy fields are authoritative until legacy is retired.** Legacy writes only `urlCode`, `longUrl`, `disabled`, `safetyStatus`, `requiresInterstitial`, `passwordProtected`/`passwordHash`, `tags`, `utmLinks`, `clicks`. Readers on the hot path (the redirect service) resolve from those fields: the query is `{domain,key}` **or** `{urlCode:key}` for `shortn.at`, and the decision is projected from the legacy fields. New fields are derived data until P4's default switch.
2. **Every new unique index on a collection legacy writes to is partial.** For example `{domain:1,key:1}` uses `partialFilterExpression:{key:{$type:"string"}}`; the same applies to `bio_pages.handle` and `tags.nameLower`. A non-partial unique index makes the second legacy-created doc that lacks the field fail with E11000.
3. **Sync is driven by change streams, not polling.** The worker tails `urlv3s`, `qrcodesv2`, `biopages`, `campaigns` and `tags` with `fullDocument: "updateLookup"` and `fullDocumentBeforeChange: "whenAvailable"`. `changeStreamPreAndPostImages` must be enabled on these collections in P1. The `$exists:false` sweep remains only as a safety net for missed events. The resume token is persisted. On `ChangeStreamHistoryLost`, the worker runs a full re-sync and flushes the link cache.
4. **Last-writer tracking.** Each doc carries `_sync: { rev, lastWriter: "legacy"|"v2", legacyHash }`. Legacy→new derivation runs only when `legacyHash` changed since the last sync. When new code writes, it also writes the deterministic legacy projection (`urlCode`, `longUrl`, `tags`, `utmLinks`, …) and the matching `legacyHash`, so the sync doesn't reapply it. Data only the new model can express (variant `campaignId`, new block types, merged tags) is kept in new-only fields that legacy→new derivation never overwrites.
5. **Writes that cause E11000 during sync** (legacy created a duplicate code) go to the `code_conflicts` flow. They're never retried in a loop.

## 4. Pre-flight: M0 audit (read-only, P0)

Script `bun run db:audit` → markdown report committed to `docs/rebuild/audit/`:

1. Real collection names and document counts, data and index sizes.
2. **Duplicate `urlCode`s** in `urlv3s` (group by code, count>1). This blocks the unique index.
3. `urlCode`s that collide with reserved words (current `PUBLIC_PATHS` + the new reserved list in 07) or contain characters outside `[A-Za-z0-9_-]`.
4. Clicks whose `urlCode` matches no link or QR (orphans from renames or deletes). Count and size.
5. QR codes whose `urlId` matches no link; links with `isQrCode` but no QR doc.
6. Bio page links pointing at missing links; bio slugs that aren't valid DNS labels (uppercase, `_`, length >63, leading `-`) or that collide with reserved subdomains.
7. Users without `sub`; docs whose `sub` matches no user.
8. `clicks.total` vs `count(clicks where urlCode)` per link (quantifies the lost-update race).
9. Campaign `links[]` vs links whose `utmLinks.campaign._id` points back (bidirectional drift).
10. Image URLs by host (Pinata gateway vs others) for M12.
11. Active Polar subscriptions per user vs any local signal, and pending `ScheduledChange`s. List **every distinct `productId`** across all non-terminal subscriptions (archived, yearly and old products included) and map each one using the legacy name rule.
12. **Origins encoded in printed QR codes:** group `qrcodesv2.options.data` by origin + path shape. Legacy builds it from `BASEURL`, which can fall back to `VERCEL_URL` or `window.location.origin` (`lib/utils.ts:111-127`), and the client can save arbitrary `options`. Every origin found must keep resolving with its path preserved (07). Test 100% of these URLs, not a sample.
13. QR docs whose `longUrl` differs from their backing link's `longUrl`. The backing link is what scanners actually hit, so it's the truth. Report this, and never reconcile toward the QR doc.
14. Atlas server version (time-series update/delete capabilities need ≥ 7.0; target 8.x) and whether `changeStreamPreAndPostImages` can be enabled.
15. Keys outside `[A-Za-z0-9_-]` and keys that differ only by case from a reserved path.

**Gate:** P1 doesn't start until the audit is reviewed and every blocking item (2, 3, 6, 7, 11, 12, 14) has a resolution recorded.

**P0 legacy hotfix (blocking, ships before anything else):** `deleteShortn` runs `Clicks.deleteMany({urlCode, type:"click"})` **before** its ownership check and without a `sub` filter (`linkActions.ts:298-299`). `deleteQRCode` (`qrCodeActions.ts:354`) and the rename `Clicks.updateMany` (`linkActions.ts:483`) have the same problem. Any logged-in user can wipe another user's click history, and duplicate codes cross-contaminate. Fix: check ownership first and scope every `Clicks` mutation by `sub`. From then until P7, legacy deletes **archive** click docs into `clicks_deleted` instead of removing them.

## 5. Migrations

Order matters. Each line has its phase, what it does, how it's verified, and how it's rolled back.

### M1 · `0001-resolve-duplicate-codes` (backfill + continuous, manual review)

Legacy can keep creating duplicates (find-then-create custom codes at `linkActions.ts:103`, unchecked `nanoid(6)` for QR at `qrCodeActions.ts:87`), so M1 also runs continuously and feeds `code_conflicts` until P4.

- For each duplicate `urlCode` group, keep the oldest doc as the owner of the code. Newer duplicates get `key = <code>-<n>` and an entry in a `code_conflicts` report. Their redirect behavior is unchanged today, since `findOne` already returns the first match, which is effectively the oldest by natural order. **Verify** this assumption per group against prod before running.
- Owners of renamed duplicates get an email from a template.
- **Verify:** zero duplicate `key` within the domain. **Down:** restore `key` from `code_conflicts`.

### M2 · `0002-workspaces` (expand + continuous backfill)

- For every `user`: upsert a personal workspace `{ ownerUserId, personal:true, legacySub: user.sub, slug: derived, plan: from subscription (M11) or "free" }` and an `owner` membership.
- Set `workspaceId` on `urlv3s`, `qrcodesv2`, `campaigns`, `tags`, `biopages`, `linkreports` (via link) and `scheduledchanges` (via userId). **Note:** `BioPage.userId` stores the user's **`sub`**, not `user.id` (`bioPageActions.ts:42,358`), so bio pages map by `sub`. Legacy `clicks` are left alone; their events get `workspaceId` in M7.
- Docs with a `sub` that has no user go to an `orphan` system workspace and are listed in the report. They are not deleted.
- **Verify:** `count({workspaceId:{$exists:false}}) == 0` per collection; the orphan workspace's count **equals the M0 orphan count** (a mapping bug would otherwise pass silently); and for every workspace, `count(links)` equals the legacy `count({sub})`. **Down:** `$unset workspaceId`, delete the created workspaces and members.

### M3 · `0003-link-domain-key` (expand + continuous)

- `$set { domain:"shortn.at", key: urlCode, destination: longUrl, previousKeys: [], qr.legacyBacking: isQrCode, password: {...}, safety: {...} }` where missing.
- Build index `{domain:1,key:1}` **unique** (after M1).
- **Verify:** for 100% of docs `key === urlCode && destination === longUrl`. Re-verified continuously until legacy is retired, because legacy edits update only `urlCode`/`longUrl`. Re-sync is driven by the change stream (§3a.3). Until then, the redirect service resolves from the legacy fields anyway (§3a.1), so lag in this derivation can never serve a stale destination.
- **Down:** `$unset` new fields, drop index.

### M4 · `0004-qr-link-ref` (expand + continuous)

- `qrcodesv2.linkId = urlv3s._id`, matched on `{urlCode: qr.urlId, isQrCode: true, qrCodeId: qr.qrCodeId}` (matching on the code alone is ambiguous when codes are duplicated); `publicId = qrCodeId`; `attachedLinkId` from `attachedUrl` / `link.qrCodeId` (the "QR attached to an existing link" relation, which must survive C2); `design = options` (shape unchanged, validated by zod; invalid blobs are stored as-is under `designLegacy`).
- **Verify:** every QR has `linkId` or is listed as orphan (M0 #5). **Down:** unset.

### M5 · `0005-normalize-tags` (backfill + continuous)

- From the `tags` collection plus every embedded tag in links and QRs: upsert a tag per `(workspaceId, lower(tagName))` and collect the embedded `id`s into `legacyIds`.
- `links.tagIds` and `qr_codes.tagIds` are mapped from embedded tags.
- **Verify:** for each link, the set of tag names from `tagIds` equals the set of embedded names. **Down:** unset `tagIds`, remove created tags (those with a `createdBy: "migration"` marker).

### M6 · `0006-normalize-campaigns-utm` (backfill + continuous)

- Each `utmLinks[]` entry was a _variant_ of a link (same short link, different UTM params, shown in UI as separate URLs). The new model makes variants explicit: `links.utmVariants: [{ vid, source, medium, term, content, campaignId }]`. The campaign title is no longer copied. `vid` is a **content hash** of the params, because legacy replaces `utmLinks` wholesale with fresh subdocument `_id`s on every edit (`linkActions.ts:841`).
- `campaigns.links[]` is kept, then compared with the reverse lookup. Discrepancies are reported, and the union is taken as truth (no association lost).
- **Verify:** `count(utmVariants) == count(utmLinks)` per link; each campaign's derived link set ⊇ legacy `links[]`. **Down:** unset.

> UTM variants still resolve through the same short key today (legacy appends params client-side when copying). The redirect service keeps that behavior and adds an optional per-variant key later (09).

### M7 · `0007-click-events-backfill` (backfill; live dual-write starts in P2)

- Create the time-series collection `click_events` with `expireAfterSeconds` **unset** (no automatic deletion; retention is a product decision, see below). Requires Atlas ≥ 7.0 (target 8.x). Use `bucketMaxSpanSeconds = bucketRoundingSeconds = 86400` rather than minute granularity: long-tail links get very few events per bucket, so per-minute buckets would inflate storage instead of compressing it. Benchmark size on the staging restore before committing. Put `key` and `legacyCode` **in the meta field `m`**, so orphans can be re-attached with meta-only updates.
- Copy `clicks` → `click_events` in `_id` order. Store `legacyId: clicks._id` and resolve `linkId`/`qrId`:
  - `type:"click"` → link by `urlCode`; if none, check `previousKeys` (none yet); else **orphan**.
  - `type:"scan"` → QR by `qrCodeId` = `urlCode` → `linkId` via M4.
  - Orphans are still copied, with `m.linkId: null, key` preserved, so they can be re-attached later. They're excluded from dashboards.
- IP handling: `ipHash = HMAC(ip, IP_HASH_SECRET)` and `ipPrefix` truncated. **The raw IP is not copied** into the new store. The original `clicks` collection is kept untouched as the archive until the retention decision, so no data is lost.
- Live: starting in P2, the worker writes **both** a legacy `clicks` doc (tagged `src:"v2"`) and a `click_events` doc. It also does `$inc clicks.total` + `$max clicks.lastClick` on the legacy link **or QR doc**, using the same scan-vs-click rule as legacy (`linkActions.ts:577-602`), so the legacy dashboard, which reads and sorts by `clicks.total`, keeps moving. The backfill is bounded to `clicks._id < P2 cutoff ObjectId` and skips `src:"v2"`, so live dual-writes are never copied twice. `legacy_click_map {legacyId → eventStreamId}` is permanent (no TTL), because time-series collections can't hold unique indexes. Known drift: during canary, legacy `doc.save()` still writes absolute `clicks.total` values. This is documented and doesn't matter, because new totals derive from events.
- Then `click_rollups` is computed from events, and `links.stats` is recomputed from rollups. A nightly job recomputes rollups for closed days from events, to repair any counter drift.
- **Verify:** **set-based**, not count-based: every `clicks._id` below the cutoff appears in `legacy_click_map`, or is listed as excluded with a reason. Legacy deletes make plain counts diverge forever, and they're archived after the P0 hotfix. Also check per-link set equality for a 1% random sample plus the top 500 links, and daily sums for the last 90 days.
- **Down:** drop `click_events`, `click_rollups`, `click_event_ids`. The source is untouched.
- **Totals:** `clicks.total` has drifted from the real event count (the race). The new UI shows event-derived counts. Each link keeps `stats.legacyTotal` from `clicks.total`, so nothing is discarded, and M0 #8 quantifies the gap. If any link shows a _lower_ number after cutover, the UI shows `max(events, legacyTotal)` with a footnote. That's a product call, flagged in 14.

### M8 · `0008-bio-pages-v2` (expand + continuous)

- `handle = slug` if it's a valid DNS label (1–63 chars; grandfathered even though new handles need 3–30) and not reserved. Otherwise `handle = normalize(slug)` with a numeric suffix on collision, plus a `bio_aliases {slug → bioPageId}` entry. Aliases reference the **page id**, never a handle string, so a later handle change or release can't redirect `/b/{slug}` to someone else's page. **Every old `/b/{slug}` keeps working** via a 301 to the page's current handle.
- `blocks` are built from `links[]` (type `link`, `{linkId, title?, image?}`, order preserved), `socials[]` (one `socials` block), and header/avatar (`profile` block). `theme` is mapped 1:1 to tokens (fonts are mapped to the curated list, and an unmapped font is kept as `customFontFamily`).
- **Verify:** block count == links + (socials?1:0) + 1; render snapshot test of 50 random pages, old vs new, compared on text content. **Down:** unset.

### M9 · `0009-link-password-secrets` (expand)

- **While legacy `/authenticate` + `/api/verify-link-password` are live, they stay the only password verifier**: bcrypt on `passwordHash`, minting `AUTH_SECRET` JWT cookies with a 24 h lifetime. The redirect service only _checks_ cookies, accepting `AUTH_SECRET` tokens.
- When the new web app takes over `/authenticate` (P4), it verifies bcrypt and mints `LINK_ACCESS_SECRET` tokens, and the redirect accepts both. Only **after** legacy password endpoints are retired: argon2id rehash-on-verify starts, and the 30-day `AUTH_SECRET` grace window begins. Rehashing earlier would let a stale argon2 hash win over a password the owner changed in legacy.
- **Verify:** e2e on a protected link with both cookie kinds. **Down:** n/a (no schema change beyond prefix-tolerant reader).

### M10 · `0010-usage-periods` (backfill)

- For the current month, copy `user.links_this_month`, `qr_codes_this_month` etc. into `usage_periods {workspaceId, period:"2026-10"}`, then seed the Redis counters from it (06).
- Old months aren't reconstructable from counters, but they _are_ derivable from `createdAt` and click events. The job backfills `usage_periods` for the last 12 months from source data (the source of truth), not from the counters.
- **Verify:** current-month numbers match the legacy counters or the derived counts, whichever is higher, and both are logged. **Down:** drop the collection.

### M11 · `0011-subscriptions-mirror` (backfill + reconciler)

- For each user, call Polar to get subscriptions by `externalCustomerId = user.id` → upsert `subscriptions` and set `workspaces.plan` for the personal workspace.
- **During P3 this migration is read-only against Polar.** Writing to Polar while the legacy hooks are live would fire them: `subscription.updated` re-sends payment-failed emails to past_due customers (`lib/auth.ts:456-472`), `subscription.canceled` creates new ScheduledChanges and scheduler jobs, and `subscription.active` executes pending downgrades in a race with the scheduler. The mirror is built locally only.
- At the **billing switch** (06 Migration step 5), in this order: freeze the external scheduler → disable the legacy Polar hooks → set `metadata.workspaceId` → migrate pending `scheduledchanges` into the new mechanism (06) → mark them `status:"migrated"`. The collection is archived at P7, never deleted before.
- Product→plan mapping covers **every** distinct product id found in M0 #11 using the legacy name rule. `past_due` counts as paid, as legacy does. An unmapped product blocks the migration.
- **Verify:** every active Polar subscription maps to exactly one workspace plan, and every non-free local plan has an active Polar subscription. **Down:** drop the mirror (legacy reads Polar live anyway).

### M12 · `0012-assets-to-r2` (backfill)

- Find every URL on the Pinata gateway (avatars, bio header backgrounds, link block images, `user.image`). Download each, upload it to R2 (`assets.shortn.at/{workspaceId}/{sha256}.{ext}`), and record it in `asset_migrations`. Then write the new URL into the **new** fields (`bio_pages.blocks[].image`, `avatar`, …). Legacy fields keep the Pinata URL.
- Pinata pins are **not** removed until P7 + 30 days.
- **Verify:** every migrated object's sha256 matches, and HEAD of every new URL returns 200. **Down:** delete the R2 objects listed in `asset_migrations`.

### M13 · misc

- `ratelimits` is replaced by Redis. It's ephemeral (24h TTL) and not user data, so it's dropped at P7 without an archive.
- `contacts`, `link_reports`: add `workspaceId` where derivable. No other change.
- `session.geo_*` is kept (better-auth additionalFields), and `impersonatedBy` is kept.

## 6. Contract phase (P7 only)

Each step archives first (§3), and each runs only after: the legacy app has been switched off for ≥14 days, a PITR restore drill has passed, and a final full `mongodump` of the affected collections is in R2 with its checksum recorded.

| C#  | Action                                                                                                                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Rename `urlv3s`→`links`, `qrcodesv2`→`qr_codes`, `biopages`→`bio_pages` (point apps to the new names in the same deploy; the readers accept both for one release)                                           |
| C2  | `$unset` legacy fields on links: `sub, urlCode, longUrl, tags, utmLinks, clicks, isQrCode, qrCodeId, passwordProtected, passwordHash, passwordHint, riskScore, safetyStatus, …` (archived copy first)       |
| C3  | Drop legacy text and boolean indexes                                                                                                                                                                        |
| C4  | `clicks` → renamed `clicks_archive_legacy`. Raw-IP retention: **decision needed** (GDPR suggests anonymizing after 12–24 months; keep hashed events forever). Nothing is deleted without explicit sign-off. |
| C5  | Drop `scheduledchanges` (archived), `ratelimits`, the `user.*_this_month` fields, `campaigns.links[]`                                                                                                       |
| C6  | Remove `sub` from `user` only after all code paths use `workspaceId`. The value is kept in `workspaces.legacySub` forever.                                                                                  |

## 7. Backups & drills (also in 13)

- Atlas continuous backup with **PITR ≥ 7 days** must be enabled before M1. If the tier doesn't support it, a nightly `mongodump --gzip` to R2 with 30-day retention is the P0 deliverable.
- Before every backfill on prod: an on-demand snapshot, with its ID recorded in the migration's `_migrations` doc.
- A quarterly restore drill to staging, with an attached verify report.
