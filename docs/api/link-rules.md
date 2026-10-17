# Link rules

Link creation, bulk creation and editing accept a `rules` object. Link reads return
configured rules with UTC ISO timestamps. `PATCH /v1/links/{id}` replaces the whole
rules object when `rules` is supplied; send `rules: null` to clear it. Omit the
field to preserve existing rules. Link write scopes and current workspace roles apply.

```json
{
  "rules": {
    "activeFrom": "2026-11-01T08:00:00.000Z",
    "expiresAt": "2026-12-01T08:00:00.000Z",
    "expiredUrl": "https://example.com/campaign-ended",
    "maxClicks": 10000,
    "forwardQuery": true,
    "utm": { "source": "newsletter", "campaign": "November" },
    "permanent": false
  }
}
```

## Schedule and expiry

Activation is inclusive: the link starts redirecting at `activeFrom`. Expiry is
exclusive: at `expiresAt` it stops redirecting to its destination. When both are
present, activation must precede expiry. The redirect checks these timestamps
on every request, including a cache hit.

Rule mutations also persist versioned invalidation requests. The worker uses
BullMQ delayed jobs to evict canonical and alias cache entries at activation and
expiry boundaries. Edited or cleared rules supersede older jobs. Requests remain
in Mongo until invalidation succeeds, so queue publication and cache failures can
be retried. Timestamp checks remain authoritative during worker or Redis outages.

Safety and password checks run first. Without a fallback, scheduled links return
a branded 404 page and expired links return a branded 410 page in the visitor's
language. With `expiredUrl`, either time gate returns a 302 to that URL. Gate and
fallback responses do not count as destination clicks. Query forwarding, fixed
UTM and permanent redirect settings do not apply to the fallback.

Fallbacks must be public HTTP(S) destinations and pass the same structural
validation as a link destination. Safety scans include the fallback and keep the
highest risk verdict. Changing a fallback marks safety pending, preserves existing
blocks, and prevents a scan for the previous fallback from applying afterward.

## Approximate visit limit

`maxClicks` accepts an integer from zero through 9,007,199,254,740,991. It limits
lifetime non-bot destination visits, including QR scans and persisted visits from
before the limit was configured. Zero closes the link immediately. Safety, password and
time gates run before the count check; targeting and rotation run afterward.

The redirect reads a durable Redis hot counter seeded from persisted click and
scan totals. Tracked human visits increment it with the analytics stream write;
bots and gate responses do not increment it. Legacy QR links without an analytics
record still count allowed human visits. Counters have no idle expiry, including
when no analytics record exists to seed them again. After counter loss, tracked
links seed from their latest persisted totals. Untracked legacy QR visits from
before counting began, or lost counters without persisted history, cannot be
reconstructed.

This is an approximate limit: concurrent requests, queued analytics writes,
spool replay and persistence lag can overshoot it. Label it “about” in interfaces.
It does not count unique visitors. A missing counter service returns a retryable
503 for a limited destination rather than bypassing the limit. Existing safety,
password and time gates remain usable without that service.

At the limit, visitors receive a localized branded 410 page, or a 302 to
`expiredUrl` when configured. That fallback does not count, forward query
parameters, apply UTM settings or set a rotation cookie. Permanent redirects can
be cached by clients and bypass future server checks; use the default 302 for
links whose visit limit needs to be checked on returning visits.

## Query forwarding and UTM

`forwardQuery` defaults to false. When true, incoming parameters are appended to
the destination, with these rules:

- Existing destination parameters take precedence over incoming values.
- Repeated incoming values are preserved when the destination has no such key.
- `token`, `q`, `ref` and `block` are reserved for Shortn and are not forwarded.
- At most 50 parameters are appended, with keys capped at 100 characters and
  values at 500 characters.
- Fixed `utm.source`, `medium`, `campaign`, `term` and `content` overwrite both
  destination and incoming UTM values. Each configured value is capped at 200
  characters. Empty values do not add a parameter.

Destination fragments are preserved. Click events record the effective UTM
values applied to the redirect while retaining the existing attribution flow.

## App deep links

`deepLink` selects an app link for matching iOS or Android user agents, after
safety, password, time and visit-limit gates and before device/country targeting
or rotation:

```json
{
  "rules": {
    "deepLink": {
      "ios": "youtube://watch?v=123",
      "android": "https://www.youtube.com/watch?v=123",
      "fallback": "store",
      "store": {
        "ios": "https://apps.apple.com/app/youtube/id544007664",
        "android": "https://play.google.com/store/apps/details?id=com.google.android.youtube"
      }
    }
  }
}
```

Configure at least one OS target. App links accept public HTTPS URLs or these
app schemes: `youtube`, `spotify`, `whatsapp`, `tg`, `instagram`, `fb`, `twitter`,
`linkedin`, `slack`, `discord`, `zoomus`. Other handlers, executable schemes,
credentials, whitespace and control characters are rejected. App and store URLs
are capped at 2,048 characters. Public HTTPS app links and store URLs participate
in safety scans; custom app schemes cannot be inspected by HTTP safety providers.

`fallback: "web"` uses the link's main destination. `fallback: "store"` requires
an explicit HTTPS store URL for every configured OS, under `apps.apple.com` for
iOS and `play.google.com` for Android. It never guesses a store listing. Unknown
OS values and recognized bots continue through the ordinary targeting rules.

A matching visit returns a localized, private, non-cacheable HTML handoff with
an automatic app-open attempt and visible app/fallback links. If the page remains
visible, it navigates to the fallback after about 1.8 seconds. Becoming hidden,
losing focus or leaving the page cancels that timer; returning does not start it
again. The app button retries and starts a new timer. Without JavaScript both
links remain usable. Browsers may require a tap or confirmation before opening
an app; an installed app cannot be reliably detected from the web page. HTTPS
universal/app links navigate directly and use the OS/browser's handling.

Query forwarding and fixed UTM apply to the app and fallback URL. A handoff
records one click/scan with `m.branch` of `deep:ios` or `deep:android`; this measures
the handoff attempt, not confirmed app installation or launch. Browser fallback
and retry controls do not create extra Shortn events. Deep handoffs do not set a
rotation cookie or use a permanent redirect, regardless of `permanent`.

## Device and country targeting

Configure up to ten ordered `device` rules and ten ordered `geo` rules:

```json
{
  "rules": {
    "device": [
      { "os": "ios", "device": "mobile", "url": "https://example.com/ios" },
      { "device": "mobile", "url": "https://example.com/mobile" }
    ],
    "geo": [
      { "country": "PT", "url": "https://example.com/portugal" },
      { "country": "ES", "url": "https://example.com/spain" }
    ]
  }
}
```

Safety, password and time gates run before targeting. The first matching device
rule wins; if none matches, the first matching country rule wins. Otherwise the
link's main destination is used. An OS and device in the same rule must both
match. Each device rule must specify at least one of them. Supported OS values
are `ios`, `android`, `windows`, `macos`; devices are `mobile`, `tablet`, `desktop`.
Device/OS comes from the request user agent and country from the trusted
Cloudflare `CF-IPCountry` header. Country rules use uppercase two-letter codes.
Unknown OS/country values do not match those predicates.

Every target URL must pass public HTTP(S) structural validation. All configured
targets are included in safety scans, even when they are not selected for the
current visitor. Editing the destination set queues a new scan and supersedes
older scans. Query forwarding, fixed UTM and permanent redirect behavior apply
to the selected destination.

## Weighted rotation

A `rotation` list selects among one to ten public HTTP(S) destinations after
all gates and device/country rules:

```json
{
  "rules": {
    "rotation": [
      { "url": "https://example.com/a", "weight": 1 },
      { "url": "https://example.com/b", "weight": 3 }
    ]
  }
}
```

Weights are relative: this example assigns about one quarter of fresh selections
to A and three quarters to B. Each weight must be positive, finite and no greater
than 1,000,000. All rotation URLs are structurally validated and included in safety
scans. Changing only weights does not require rescanning the same destinations.

The first selection sets a host-only `_sr_{linkId}` cookie for one hour, with
`Secure`, `HttpOnly` and `SameSite=Lax`. It stores a configuration fingerprint and
option number rather than a visitor identifier. Subsequent visits reuse that
option without refreshing expiry. Changing URLs, option order or weights
invalidates the previous fingerprint and selects again. Malformed or out-of-range
cookie values are ignored. Without cookies, each request gets a fresh selection.

Device/country matches and safety/password/time gates do not create a rotation
cookie. Query forwarding, fixed UTM and permanent redirect settings apply to the
selected option. Use the default 302 when rotation changes should reach returning
visitors promptly; clients may remember permanent redirects.

## Branch analytics

Targeted destination clicks carry `m.branch`: `device:0`, `geo:0`, `rotation:0`, and so on,
or `destination` when no targeting rule matched. Numbers are zero-based rule
positions; editing or reordering rules changes what a position represents.
Links without targeting retain the existing event format, with no branch field.

The REST analytics endpoints accept `groupBy=branch` and `branch=geo:0` filters,
subject to the existing analytics-breakdown plan gate and workspace isolation.
The click pipeline preserves branch values during retries, and daily rollups
include `byBranch`. Safety/password/time gates produce no destination click.
The dashboard branch breakdown view remains part of the advanced management UI
work; the REST breakdown is available now.

## Permanent redirects

`permanent: true` uses HTTP 301 for the final destination hop. The default remains
HTTP 302. Destination clicks are still enqueued, and the server sends
`Cache-Control: private, max-age=0`. Permanent redirects can be remembered by
clients; prefer the default for links whose destination or rules may change.

## Social preview overrides

Link creation, bulk creation and editing accept a top-level `og` object:

```json
{
  "url": "https://example.com/article",
  "og": {
    "title": "The article title",
    "description": "A short description for a shared link.",
    "image": "https://images.example.com/article-card.png"
  }
}
```

Configure at least one field. Titles are capped at 200 characters, descriptions
at 500, and image URLs at 2,048. Empty fields and unknown keys are rejected. Images
must use public HTTPS URLs without credentials. Shortn does not fetch or upload
these images in the redirect path; social platforms fetch the configured URL.
Use a stable image URL accessible without authentication.

`PATCH /v1/links/{id}` replaces the whole `og` object when supplied. Send
`og: null` to clear it; omit it to preserve existing metadata. Reads return the
configured object. Creation and bulk creation share the same validation. Metadata
mutations invalidate canonical and historical-alias cache entries.

Recognized preview UAs include `facebookexternalhit`, `Facebot`, `Twitterbot`,
`LinkedInBot`, `Slackbot-LinkExpanding`, `Discordbot`, `TelegramBot`, `WhatsApp`,
`SkypeUriPreview`, `MicrosoftPreview`, `Pinterestbot` and `redditbot`. Matching is
case-insensitive and examines at most 2,000 characters. This is response selection,
not crawler authentication; user-agent strings can be copied. Search crawlers and
other automated clients retain normal redirects.

After safety, password, time and visit-limit gates, a preview bot gets private HTML
with escaped Open Graph/Twitter metadata and a meta refresh to the selected web
destination. The canonical `og:url` is the short URL without request query values.
An omitted preview title falls back to the link's title. An omitted image does
not invent an image URL. Device/country/rotation selection and query/UTM rules
still apply, but preview responses do not set rotation cookies or open native
apps. Humans keep normal redirect or deep-link behavior.

Recorded preview requests remain marked as bots in the click stream. They contribute
to bot volume rather than human click/scan analytics, click webhooks or the hot
visit count. Gate and fallback responses do not expose configured preview
metadata. Responses vary by user agent and are private with zero freshness;
platforms may keep their own preview cache and may require a fresh scrape after
an edit. The advanced in-page preview editor remains pending.

## Destination health

Link reads include read-only `health` results when a current check is scheduled.
`health.checks` contains individual destination results; `checkedAt` is the last
completed cycle and `nextCheckAt` is the next queued check time. An empty checks
list means the first check is pending. Queued checks may run after their due time
while a backlog drains.

The worker checks the main destination and configured web targets, including
fallback, device/country/rotation URLs, HTTPS app links and store URLs. Custom
app schemes are excluded. URLs differing only by fragment share a check. A cycle
runs weekly, with one target checked per job and bounded batches for large
libraries. Requests are limited per hostname across worker instances.

Checks use HEAD, falling back to GET with a one-byte Range request for HTTP 405
or 501. The connection closes after response headers, even if a server ignores
Range. Up to three redirects are followed, with public-address validation and
DNS pinning on every hop. Private, mixed public/private DNS and credential-bearing
targets are not requested. Redirect loops, DNS/network failures and timeouts
produce an unknown/unreachable result, not an assumed HTTP error.

Each check reports `status` (`ok`, `http_error`, `unreachable`, `blocked`), optional
HTTP status, check time, consecutive HTTP-error `streak`, and `failingSince`.
`health.flagged` becomes true after two consecutive 4xx/5xx checks of any target.
A healthy response clears that target's streak. Network/blocked outcomes do not
pretend that the page returned a 4xx/5xx status. Failure codes exclude remote
response bodies and credentials.

Health is informational: results never disable a link, change safety status or
modify its redirect. Websites may treat the checker differently from a browser.
The checker identifies itself as `Shortn-LinkHealth/1.0`, and Shortn treats its
requests as bots so checks of other Shortn links do not inflate human analytics.
Changing the destination set resets the check generation and hides old results;
late results cannot apply to an edited link. Metadata-only edits retain results.

The same workspace permissions and link-read API scopes apply. Health fields
cannot be written through link mutations. Active dashboard rows flag repeated
HTTP errors and open the link overview's Destination health section. It shows
per-target status and check dates, distinguishes blocked and unreachable results,
and hides stale results after a destination edit. Health remains informational.

Dashboard Links and QR selections persist across pages and filters, up to 500
items per action. Delete opens the existing permission-checked review page.
This dashboard limit is separate from the REST bulk-create limit of 1,000.

## Remaining rule features

Unsupported rule fields are rejected. The advanced
in-page rule editor also remains pending. Background safety scans for new or
changed link destinations are durable: the worker executes them through BullMQ,
retries failures with bounded exponential backoff, and rescans successful links
weekly. A destination edit supersedes any older queued or running request.
`WEB_RISK_API_KEY` must be configured in the worker for Google Web Risk checks;
without it the existing structural/domain-age checks still run. A configured
reputation-provider outage is retried rather than treated as a completed weekly scan.

Safety-provider results use shared Redis caching. RDAP registration timestamps
are cached per destination host for 24 hours; domain age is recalculated for
each scan. Web Risk threat matches remain specific to the exact URL and expire
at the provider's `expireTime`, following the
[Lookup API cache protocol](https://docs.cloud.google.com/web-risk/docs/caching).
Clean Lookup responses and provider failures are not cached. A clean path does
not establish trust for other URLs on that host. Cache outages fall through to
provider checks, and configured reputation outages retain durable retries.
