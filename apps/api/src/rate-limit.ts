import type { Entitlements } from "@shortn/billing";

export const rateScript = `
local now = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - 60000)
local used = redis.call('ZCARD', KEYS[1])
local first = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
local reset = 60
if #first > 0 then reset = math.max(1, math.ceil((tonumber(first[2]) + 60000 - now) / 1000)) end
if used >= limit then return {0, 0, reset} end
redis.call('ZADD', KEYS[1], now, ARGV[3])
redis.call('PEXPIRE', KEYS[1], 60000)
return {1, limit - used - 1, reset}
`;

/** A plan without a catalog rate (Free, reaching the API through the rollout
 * flag or an added feature) keeps the 30/min the old table enforced. */
export const rolloutApiPerMinute = 30;

/** Enterprise is "unlimited" in the catalog, but the limiter still runs as a
 * safety ceiling against runaway clients. */
export const enterpriseApiCeiling = 6000;

/** Requests per minute for an API key or MCP grant (doc 23 §6 Q6, §7 A5).
 * Catalog numbers apply, so staff limit overrides do too. Null — no limit —
 * only when a staff override sets `apiPerMinute: null` explicitly. */
export function apiRateLimit(
  entitlements: Pick<Entitlements, "plan" | "limits" | "sources">,
): number | null {
  const limit = entitlements.limits.apiPerMinute;
  if (entitlements.sources.overriddenLimits.includes("apiPerMinute"))
    return limit;
  if (limit !== null) return limit;
  return entitlements.plan === "enterprise"
    ? enterpriseApiCeiling
    : rolloutApiPerMinute;
}
