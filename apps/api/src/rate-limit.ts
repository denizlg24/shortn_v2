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
