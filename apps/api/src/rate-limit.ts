import type { Entitlements, Feature } from "@shortn/billing";

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

/** Free has no API in the catalog, so its `apiPerMinute` is null; a free
 * workspace can still reach the API through the platform rollout flag, and
 * keeps the 30/min it had before catalog rates were used. */
export const rolloutApiPerMinute = 30;

/** Requests per minute for an API key or MCP grant (doc 23 §6 Q6), or null
 * for no limit. Catalog numbers apply, so a staff limit override does too. A
 * null limit means unlimited only when the plan (or an override) grants the
 * transport or a staff override set it explicitly; enterprise is unlimited. */
export function apiRateLimit(
  entitlements: Pick<Entitlements, "limits" | "features" | "sources">,
  transport: Extract<Feature, "api" | "mcp">,
): number | null {
  const limit = entitlements.limits.apiPerMinute;
  if (limit !== null) return limit;
  return entitlements.sources.overriddenLimits.includes("apiPerMinute") ||
    entitlements.features.includes(transport)
    ? null
    : rolloutApiPerMinute;
}
