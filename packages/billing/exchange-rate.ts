export interface ExchangeRate {
  eurPerUsd: number;
  asOf: string;
}

export const fxKeys = {
  current: "fx:usd:eur",
  last: "fx:usd:eur:last",
  refresh: "fx:usd:eur:refresh",
} as const;
export const ecbFeed =
  "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

interface FxCache {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    seconds?: number,
    onlyIfMissing?: boolean,
  ): Promise<unknown>;
}

function validDate(value: unknown, now: Date): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(value);
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value <= now.toISOString().slice(0, 10)
  );
}

export function parseEcbRate(xml: string, now = new Date()): ExchangeRate {
  const asOf = xml.match(/<Cube\b[^>]*\btime=['"]([^'"]+)['"]/i)?.[1];
  const usd = xml.match(/<Cube\b(?=[^>]*\bcurrency=['"]USD['"])[^>]*>/i)?.[0];
  const usdPerEur = Number(usd?.match(/\brate=['"]([^'"]+)['"]/i)?.[1]);
  const eurPerUsd = 1 / usdPerEur;
  if (
    !validDate(asOf, now) ||
    !Number.isFinite(usdPerEur) ||
    usdPerEur <= 0 ||
    !Number.isFinite(eurPerUsd) ||
    eurPerUsd <= 0
  )
    throw new Error("Invalid ECB reference rate");
  // ECB quotes units of USD per EUR; USD prices require its reciprocal.
  return { eurPerUsd, asOf };
}

function cachedRate(value: string | null, now: Date): ExchangeRate | null {
  try {
    const rate = JSON.parse(value ?? "null");
    return rate &&
      validDate(rate.asOf, now) &&
      typeof rate.eurPerUsd === "number" &&
      Number.isFinite(rate.eurPerUsd) &&
      rate.eurPerUsd > 0
      ? { eurPerUsd: rate.eurPerUsd, asOf: rate.asOf }
      : null;
  } catch {
    return null;
  }
}

export async function loadExchangeRate({
  cache,
  fetcher = fetch,
  now = new Date(),
}: {
  cache: FxCache;
  fetcher?: (url: string, init?: RequestInit) => Promise<Response>;
  now?: Date;
}): Promise<ExchangeRate | null> {
  const [current, last] = await Promise.all([
    cache.get(fxKeys.current),
    cache.get(fxKeys.last),
  ]);
  const fresh = cachedRate(current, now);
  if (fresh) return fresh;
  const fallback = cachedRate(last, now);
  // Coalesce cold refreshes and retry outages at most once per five minutes.
  if (!(await cache.set(fxKeys.refresh, "1", 300, true))) return fallback;
  try {
    const response = await fetcher(ecbFeed, {
      signal: AbortSignal.timeout(2000),
      cache: "no-store",
    });
    if (!response.ok) return fallback;
    const xml = await response.text();
    if (xml.length > 64_000) return fallback;
    const rate = parseEcbRate(xml, now);
    // Keep a durable last-known value when the daily key expires.
    await Promise.all([
      cache.set(fxKeys.current, JSON.stringify(rate), 86400),
      cache.set(fxKeys.last, JSON.stringify(rate)),
    ]);
    return rate;
  } catch {
    return fallback;
  }
}
