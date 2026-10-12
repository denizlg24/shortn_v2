# packages/billing/exchange-rate.ts

- ExchangeRate · interface · L1-L4 — interface ExchangeRate
- FxCache · interface · L14-L22 — interface FxCache
- validDate · function · L24-L33 — function validDate(value: unknown, now: Date): value is string
- parseEcbRate · function · L35-L50 — function parseEcbRate(xml: string, now = new Date()): ExchangeRate
- cachedRate · function · L52-L65 — function cachedRate(value: string | null, now: Date): ExchangeRate | null
- loadExchangeRate · function · L67-L103 — async function loadExchangeRate({ cache, fetcher = fetch, now = new Date(), }: { cache: FxCache; fetcher?: (url: string, init?: RequestInit) => Promise<Response>; now?: Date; }): Promise<ExchangeRate | null>
