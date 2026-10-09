# 09 — Link Features & QR Codes

All link features are compiled into the cached redirect payload (`CompiledRules`, 03). Evaluation happens **in memory** with no extra I/O per request.

## Link rules

```ts
type LinkRules = {
  activeFrom?: Date;                       // before → "not yet active" page (or fallback URL)
  expiresAt?: Date;  maxClicks?: number;   // after → expired page (or fallback URL)
  expiredUrl?: string;
  geo?: { country: CC; url: string }[];    // first match wins (CF-IPCountry)
  device?: { os?: "ios"|"android"|"windows"|"macos"; device?: "mobile"|"tablet"|"desktop"; url: string }[];
  rotation?: { url: string; weight: number }[]; // A/B; sticky per visitor via short-lived cookie `_sr_{id}`
  deepLink?: { ios?: string; android?: string; fallback: "web"|"store" }; // app links (youtube://, etc.)
  forwardQuery?: boolean;                  // append incoming query params to destination
  utm?: {...};                             // appended at redirect time (not baked into destination)
  permanent?: boolean;                     // 301
};
```

- **Evaluation order:** status gates (03) → schedule/expiry → deep link (on matching OS UA) → device → geo → rotation → destination. The chosen branch is recorded on the click event (`m.branch`) so A/B and targeting get their own analytics.
- **maxClicks** uses the Redis counter (`stats` hot counter), and the check is approximate within the flush window. The UI labels it "about".
- **Expiry and schedule** also run as BullMQ delayed jobs that invalidate the cache at the exact time, so a cached payload never outlives `expiresAt` by more than L1 TTL. As a belt-and-braces measure, the payload carries the timestamps and the redirect checks them itself.
- **OG override:** `og.title/description/image` → when the UA is a known link-preview bot, the redirect service returns a minimal HTML page with OG tags and `<meta http-equiv="refresh">` to the destination. Humans always get the 302.
- **Link health:** a weekly job does HEAD/GET of destinations (rate-limited per host). A 4xx/5xx streak → flagged in the UI ("destination returns 404 since 3 Oct"). It's informational only.
- **Safety** (kept from legacy `lib/safety/*`): Web Risk + RDAP domain age + structural heuristics → `riskScore`. It runs in the worker on create/update and periodically re-scans. It's cached per destination host.

## Dashboard UX for links (see 12)

- **Create** from anywhere with ⌘K → "New link" or paste a URL into the links page. The paste is detected, the title is fetched (worker, `og:title`), and a key is suggested. Enter creates the link, and the link is copied to the clipboard.
- **Advanced options** live in one side panel with sections (Basics, UTM, Targeting, Schedule & expiry, Password, Social preview, QR). Every section shows its effect summary when collapsed ("Expires 31 Dec · 2 geo rules").
- **Bulk actions** on table selection: tag, move to campaign, archive, export, delete (soft, 30-day trash).
- **Trash:** deleted links stop redirecting (branded 404) but are restorable for 30 days. Keys stay reserved during that period. Hard delete keeps aggregated analytics in workspace totals.

## QR codes

### Problems today

- A QR "code" is a hidden backing link (`isQrCode`) **plus** a `QRCodeV2` doc pointing to it by string code. Scans are attributed by checking `isQrCode` on the link, so a QR-backing link can't also be used as a normal link without polluting scans.
- Server QR generation uses `canvas` (native dep) + `qr-code-styling-node`.

### Target

- **QR codes are a view onto a link.** `qr_codes.linkId` references any link. One link can have several QR designs, e.g. a flyer and a poster, each with its own `qrId`.
- **Scan attribution** for newly created QR codes (**decided: option A**):
  - **Option A (chosen):** the encoded URL is `https://shortn.at/{key}?q={qrPublicId}` with a 4–6 char id. The redirect service strips `q`, attributes `kind:"scan", qrId`, and forwards the remaining params. It's still a short, scan-friendly URL, and it gives per-design attribution.
  - Option B: each QR gets its own dedicated key → bigger link table and more keys.
- **Legacy QR codes keep working forever:** links with `qr.legacyBacking:true` attribute all hits as scans to their QR doc. `/qr/{key}` URLs resolve as before.
- **Rendering:** the client-side editor keeps `qr-code-styling` (dots, corners, colors, logo, frame + caption). The design JSON is stored as-is (shape compatible with legacy `options`). Server-side export (PNG/SVG/PDF) renders **SVG** in the worker via `qrcode` (matrix) + our own SVG styling renderer that applies the same design JSON. It's converted to PNG with `resvg-js` (WASM, no native canvas) and to PDF for print. Exports are cached in R2 by design hash.
- **Print correctness:** error correction defaults to `Q`, raised to `H` when a logo is present. Quiet zone ≥ 4 modules is enforced. A contrast check refuses designs with module/background contrast below 3:1 (they won't scan). Size guidance shows the minimum print size for the encoded data at 300 dpi.
- **QR library UI:** a dense grid of QR thumbnails with key, title and scans. Selection allows bulk export as a ZIP of SVG/PNG/PDF.

## Acceptance

- Each rule type has golden tests in the redirect suite, including combined rules and evaluation order.
- Every legacy QR in a prod sample still scans to the same destination and counts as a scan.
- Exported SVG/PNG/PDF from the server matches the client preview (pixel diff < 1% at 1024px).
