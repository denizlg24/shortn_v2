// Redis owns both the decision and increment, across every web instance.
// Keep the window anchored to its first request; rejected requests do not
// extend it. Redis TIME avoids clock skew between application instances.
const consumeScript = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local window = tonumber(ARGV[1]) * 1000
local maximum = tonumber(ARGV[2])
local entry = redis.call('HMGET', KEYS[1], 'started', 'count')
local started = tonumber(entry[1])
local count = tonumber(entry[2])
if not started or not count or now - started >= window then
  redis.call('HSET', KEYS[1], 'started', now, 'count', 1)
  redis.call('PEXPIRE', KEYS[1], window)
  return {1, 0}
end
if count >= maximum then
  return {0, math.max(1, math.ceil((window - (now - started)) / 1000))}
end
redis.call('HINCRBY', KEYS[1], 'count', 1)
return {1, 0}
`;

export interface AuthRateLimitRedis {
  eval(
    script: string,
    numberOfKeys: number,
    ...args: (string | number)[]
  ): Promise<unknown>;
}

export async function consumeAuthRateLimit(
  redis: AuthRateLimitRedis,
  key: string,
  rule: { window: number; max: number },
): Promise<{ allowed: boolean; retryAfter: number | null }> {
  // A new namespace avoids interpreting old JSON counters as Redis hashes.
  const result = await redis.eval(
    consumeScript,
    1,
    `auth-rl:v2:${key}`,
    rule.window,
    rule.max,
  );
  if (
    !Array.isArray(result) ||
    result.length !== 2 ||
    ![0, 1].includes(result[0]) ||
    !Number.isInteger(result[1]) ||
    result[1] < 0
  )
    throw new Error("Invalid auth rate-limit result");
  return {
    allowed: result[0] === 1,
    retryAfter: result[0] === 1 ? null : result[1],
  };
}
